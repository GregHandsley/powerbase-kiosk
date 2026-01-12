type Props = {
  isOpen: boolean;
  type: 'selected' | 'series';
  instanceCount: number;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
};

/**
 * Dialog for confirming booking deletion
 */
export function DeleteBookingDialog({
  isOpen,
  type,
  instanceCount,
  onClose,
  onConfirm,
  loading,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100 mb-2">
          {type === 'selected'
            ? `Delete ${instanceCount} Selected Session${instanceCount !== 1 ? 's' : ''}?`
            : 'Delete Entire Series?'}
        </h3>
        <p className="text-sm text-slate-300 mb-4">
          {type === 'selected'
            ? `This will delete ${instanceCount} selected session${instanceCount !== 1 ? 's' : ''}. Other sessions in the series will remain. This action cannot be undone.`
            : 'This will delete all sessions in this series. This action cannot be undone.'}
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
