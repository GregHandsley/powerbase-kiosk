import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Array<{
    id: number;
    title: string;
    message: string;
    published_at: string;
  }>;
  onAcknowledge: () => void;
  isAcknowledging: boolean;
}

export function AnnouncementModal({
  isOpen,
  onClose,
  announcements,
  onAcknowledge,
  isAcknowledging,
}: AnnouncementModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to first announcement when modal opens or announcements change
  useEffect(() => {
    if (isOpen && announcements.length > 0) {
      setCurrentIndex(0);
    }
  }, [isOpen, announcements.length]);

  // Don't render if no announcements or modal is closed
  if (!isOpen || announcements.length === 0) return null;

  const handleGotIt = async () => {
    await onAcknowledge();
    onClose();
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : announcements.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < announcements.length - 1 ? prev + 1 : 0));
  };

  const announcement = announcements[currentIndex];
  const hasMultiple = announcements.length > 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-4">
        {/* Header with navigation */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-100">
              {announcement.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {new Date(announcement.published_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          {hasMultiple && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>
                {currentIndex + 1} of {announcements.length}
              </span>
            </div>
          )}
        </div>

        {/* Announcement content */}
        <div className="prose prose-invert max-w-none">
          <div
            className="text-sm text-slate-300 announcement-content"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(announcement.message),
            }}
          />
          <style>{`
            .announcement-content h1,
            .announcement-content h2,
            .announcement-content h3 {
              color: rgb(241 245 249);
              font-weight: 600;
              margin-top: 1rem;
              margin-bottom: 0.5rem;
            }
            .announcement-content h1 {
              font-size: 1.5rem;
            }
            .announcement-content h2 {
              font-size: 1.25rem;
            }
            .announcement-content h3 {
              font-size: 1.125rem;
            }
            .announcement-content p {
              margin-bottom: 0.75rem;
            }
            .announcement-content ul,
            .announcement-content ol {
              margin-left: 1.5rem;
              margin-bottom: 0.75rem;
              padding-left: 1.5rem;
            }
            .announcement-content ul {
              list-style-type: disc;
            }
            .announcement-content ol {
              list-style-type: decimal;
            }
            .announcement-content li {
              margin-bottom: 0.25rem;
              display: list-item;
            }
            .announcement-content a {
              color: rgb(129 140 248);
              text-decoration: underline;
            }
            .announcement-content a:hover {
              color: rgb(165 180 252);
            }
            .announcement-content strong,
            .announcement-content b {
              font-weight: 600;
              color: rgb(241 245 249);
            }
            .announcement-content em,
            .announcement-content i {
              font-style: italic;
            }
            .announcement-content code {
              background: rgb(15 23 42);
              padding: 0.125rem 0.375rem;
              border-radius: 0.25rem;
              font-size: 0.875em;
              font-family: ui-monospace, monospace;
              color: rgb(196 181 253);
            }
          `}</style>
        </div>

        {/* Navigation and actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          {/* Navigation buttons (only show if multiple) */}
          {hasMultiple ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevious}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
                aria-label="Previous announcement"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
                aria-label="Next announcement"
              >
                Next →
              </button>
            </div>
          ) : (
            <div /> // Spacer
          )}

          {/* Acknowledge button */}
          <button
            type="button"
            onClick={handleGotIt}
            disabled={isAcknowledging}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAcknowledging
              ? 'Processing...'
              : hasMultiple
                ? `Got it (${announcements.length} announcement${announcements.length > 1 ? 's' : ''})`
                : 'Got it'}
          </button>
        </div>

        {/* Pagination dots (only show if multiple) */}
        {hasMultiple && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {announcements.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-8 bg-indigo-600'
                    : 'w-2 bg-slate-600 hover:bg-slate-500'
                }`}
                aria-label={`Go to announcement ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
