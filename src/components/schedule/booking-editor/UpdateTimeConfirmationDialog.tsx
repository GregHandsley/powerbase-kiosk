type UpdateTimeConfirmationDialogProps = {
  isOpen: boolean;
  sessionCount: number;
  startTime: string;
  endTime: string;
  capacity?: number;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  disabled?: boolean;
};

/**
 * Confirmation dialog for updating multiple booking sessions with new times
 */
export function UpdateTimeConfirmationDialog({
  isOpen,
  sessionCount,
  startTime,
  endTime,
  capacity,
  onCancel,
  onConfirm,
  saving,
  disabled = false,
}: UpdateTimeConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="rounded-md bg-indigo-900/20 border border-indigo-700/50 p-4 space-y-3">
      <p className="text-sm font-medium text-indigo-300">
        {sessionCount === 0 
          ? "No sessions selected"
          : `Update ${sessionCount} selected session${sessionCount !== 1 ? "s" : ""}?`
        }
      </p>
      <div className="text-xs text-indigo-400/80 space-y-1">
        {startTime && endTime && (
          <>
            <p>
              <span className="font-medium">Start:</span> {startTime}
            </p>
            <p>
              <span className="font-medium">End:</span> {endTime}
            </p>
          </>
        )}
        {capacity !== undefined && (
          <p>
            <span className="font-medium">Athletes:</span> {capacity}
          </p>
        )}
      </div>
      <p className="text-xs text-indigo-400/70">
        {sessionCount === 0 
          ? "Please select at least one session to update."
          : `This will update ${startTime && endTime ? "the times" : ""}${startTime && endTime && capacity !== undefined ? " and " : ""}${capacity !== undefined ? "the number of athletes" : ""} for ${sessionCount} selected session${sessionCount !== 1 ? "s" : ""}.`
        }
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving || disabled || sessionCount === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Updating..." : "Update"}
        </button>
      </div>
    </div>
  );
}

