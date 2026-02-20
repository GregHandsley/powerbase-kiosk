import { useEffect, useState, type ReactNode } from 'react';
import { ModalPortal } from './ModalPortal';

type ConfirmationDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
  lockScroll?: boolean;
  children?: ReactNode;
};

/**
 * Reusable confirmation dialog component
 */
export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  loading = false,
  lockScroll = false,
  children,
}: ConfirmationDialogProps) {
  const [viewportTop, setViewportTop] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const isBusy = loading || submitting;

  useEffect(() => {
    if (!isOpen) return;
    setViewportTop(window.scrollY || window.pageYOffset || 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'bg-indigo-600 hover:bg-indigo-500 text-white';

  return (
    <ModalPortal lockScroll={lockScroll}>
      <div
        className="absolute inset-x-0 z-[1001] flex min-h-screen items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
        style={{ top: `${viewportTop}px` }}
        onClick={(e) => {
          if (isBusy) return;
          e.stopPropagation();
          if (e.target === e.currentTarget) {
            onCancel();
          }
        }}
      >
        <div
          className="my-6 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 sm:my-0"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-300 mb-4">{message}</p>
          {children && <div className="mb-4">{children}</div>}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (isBusy) return;
                try {
                  setSubmitting(true);
                  await Promise.resolve(onConfirm());
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={isBusy}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${confirmButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isBusy && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isBusy ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
