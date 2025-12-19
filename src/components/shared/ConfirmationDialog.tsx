import { ReactNode } from "react";

type ConfirmationDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  children?: ReactNode;
};

/**
 * Reusable confirmation dialog component
 */
export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  loading = false,
  children,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const confirmButtonClass =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-500 text-white"
      : "bg-indigo-600 hover:bg-indigo-500 text-white";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-300 mb-4">{message}</p>
        {children && <div className="mb-4">{children}</div>}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-md ${confirmButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

