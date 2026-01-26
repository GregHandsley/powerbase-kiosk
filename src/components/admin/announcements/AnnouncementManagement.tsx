import { useState } from 'react';
import { useAnnouncementManagement } from '../../../hooks/useAnnouncementManagement';
import { format } from 'date-fns';
import { ConfirmationDialog } from '../../shared/ConfirmationDialog';
import { RichTextEditor } from '../../shared/RichTextEditor';
import { Modal } from '../../shared/Modal';

export function AnnouncementManagement() {
  const {
    announcements,
    isLoading,
    createAnnouncement,
    updateAnnouncement,
    toggleActive,
    deleteAnnouncement,
    isCreating,
    isUpdating,
    isToggling,
    isDeleting,
  } = useAnnouncementManagement();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [active, setActive] = useState(true);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setPublishNow(true);
    setActive(true);
    setHasExpiry(false);
    setExpiresAt('');
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Strip HTML tags to check actual text content
    const textContent = message.replace(/<[^>]*>/g, '').trim();
    if (!title.trim() || !textContent) {
      return;
    }
    // Check max length (2000 characters of text, not HTML)
    if (textContent.length > 2000) {
      return;
    }

    await createAnnouncement({
      title,
      message,
      published_at: publishNow ? undefined : new Date().toISOString(),
      active,
      expires_at: hasExpiry && expiresAt ? expiresAt : null,
    });

    resetForm();
    setShowCreateForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Strip HTML tags to check actual text content
    const textContent = message.replace(/<[^>]*>/g, '').trim();
    if (!title.trim() || !textContent || !editingId) {
      return;
    }
    // Check max length (2000 characters of text, not HTML)
    if (textContent.length > 2000) {
      return;
    }

    await updateAnnouncement({
      id: editingId,
      updates: {
        title,
        message,
        active,
        expires_at: hasExpiry && expiresAt ? expiresAt : null,
      },
    });

    resetForm();
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startEdit = (announcement: (typeof announcements)[0]) => {
    setTitle(announcement.title);
    setMessage(announcement.message);
    setActive(announcement.active);
    setPublishNow(false);
    setEditingId(announcement.id);
    setHasExpiry(!!announcement.expires_at);
    setExpiresAt(
      announcement.expires_at
        ? format(new Date(announcement.expires_at), "yyyy-MM-dd'T'HH:mm")
        : ''
    );
    setShowCreateForm(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteAnnouncement(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-slate-400 text-sm">Loading announcements...</div>
    );
  }

  return (
    <>
      <style>{`
        .announcement-preview ul,
        .announcement-preview ol {
          margin-left: 1.5rem;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }
        .announcement-preview ul {
          list-style-type: disc;
        }
        .announcement-preview ol {
          list-style-type: decimal;
        }
        .announcement-preview li {
          margin-bottom: 0.25rem;
          display: list-item;
        }
      `}</style>
      <div className="space-y-4">
        {/* Create/Edit Form Modal */}
        <Modal
          isOpen={showCreateForm}
          onClose={() => {
            resetForm();
            setShowCreateForm(false);
          }}
          maxWidth="2xl"
          className="!p-0 !overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-xl font-semibold text-slate-100">
              {editingId ? 'Edit Announcement' : 'Create Announcement'}
            </h2>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreateForm(false);
              }}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form
            onSubmit={editingId ? handleUpdate : handleCreate}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Announcement title"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Message
                </label>
                <RichTextEditor
                  value={message}
                  onChange={setMessage}
                  placeholder="Type your announcement message here..."
                  maxLength={2000}
                />
              </div>

              {!editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="publishNow"
                    checked={publishNow}
                    onChange={(e) => setPublishNow(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="publishNow"
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Publish immediately
                  </label>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="active"
                  className="text-sm text-slate-300 cursor-pointer"
                >
                  Active (visible to users)
                </label>
              </div>

              {/* Expiry Date */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="hasExpiry"
                    checked={hasExpiry}
                    onChange={(e) => {
                      setHasExpiry(e.target.checked);
                      if (!e.target.checked) {
                        setExpiresAt('');
                      }
                    }}
                    className="rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="hasExpiry"
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Set expiration date
                  </label>
                </div>
                {hasExpiry && (
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}
              </div>
            </div>
            <div className="border-t border-slate-700 p-6 flex-shrink-0">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowCreateForm(false);
                  }}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || isUpdating}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating || isUpdating
                    ? 'Saving...'
                    : editingId
                      ? 'Update'
                      : 'Create & Publish'}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* Create Button */}
        {!showCreateForm && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              + Create Announcement
            </button>
          </div>
        )}

        {/* Announcements List */}
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No announcements yet. Create one to get started.
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(announcement.id)}
                        className="flex items-center gap-2 text-left flex-1 group"
                      >
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform ${
                            expandedIds.has(announcement.id) ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <h3 className="text-base font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {announcement.title}
                        </h3>
                      </button>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          announcement.active
                            ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                            : 'bg-slate-700/30 text-slate-400 border border-slate-600/50'
                        }`}
                      >
                        {announcement.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {expandedIds.has(announcement.id) && (
                      <div
                        className="text-sm text-slate-300 mb-2 prose prose-invert max-w-none announcement-preview"
                        dangerouslySetInnerHTML={{
                          __html: announcement.message,
                        }}
                      />
                    )}
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>
                        Published:{' '}
                        {format(
                          new Date(announcement.published_at),
                          'dd MMM yyyy, HH:mm'
                        )}
                      </div>
                      {announcement.expires_at && (
                        <div
                          className={
                            new Date(announcement.expires_at) < new Date()
                              ? 'text-red-400'
                              : 'text-slate-500'
                          }
                        >
                          Expires:{' '}
                          {format(
                            new Date(announcement.expires_at),
                            'dd MMM yyyy, HH:mm'
                          )}
                          {new Date(announcement.expires_at) < new Date() && (
                            <span className="ml-2 text-red-400">(Expired)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(announcement)}
                      className="px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toggleActive({
                          id: announcement.id,
                          active: !announcement.active,
                        })
                      }
                      disabled={isToggling}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300 hover:underline disabled:opacity-50"
                    >
                      {announcement.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(announcement.id)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Delete Confirmation */}
        <ConfirmationDialog
          isOpen={deleteId !== null}
          title="Delete Announcement"
          message="Are you sure you want to delete this announcement? This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmVariant="danger"
          loading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      </div>
    </>
  );
}
