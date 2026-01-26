import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from './Modal';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { usePrimaryOrganizationId } from '../../hooks/usePermissions';
import { useOrganizations } from '../../hooks/useOrganizations';

const categoryOptions = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature request' },
  { value: 'general', label: 'General feedback' },
] as const;

export function FeedbackButton() {
  const { user, profile } = useAuth();
  const { organizationId } = usePrimaryOrganizationId();
  const { organizations } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] =
    useState<(typeof categoryOptions)[number]['value']>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter your feedback before sending.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-feedback', {
        body: {
          category,
          message: message.trim(),
          context: {
            url: window.location.href,
            user: user?.email ?? user?.id ?? 'anonymous',
            name: profile?.full_name ?? undefined,
            org:
              organizations.find((org) => org.id === organizationId)?.name ??
              (organizationId ? `Org ${organizationId}` : undefined),
            env: import.meta.env.MODE,
          },
        },
      });

      if (error) {
        throw error;
      }
      toast.success("Thanks — we've got it 👍");
      setMessage('');
      setCategory('general');
      setIsOpen(false);
    } catch (submitError) {
      console.error('Failed to submit feedback:', submitError);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800"
        aria-label="Send feedback"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h6m5 9l-3-3H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v7"
          />
        </svg>
        Feedback
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} maxWidth="md">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Send feedback
            </h2>
            <p className="text-xs text-slate-400">
              Share issues or ideas. We read every message.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target
                      .value as (typeof categoryOptions)[number]['value']
                  )
                }
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Message
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Tell us what's on your mind..."
              />
              <div className="mt-1 text-xs text-slate-500">
                {message.length}/1000
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
