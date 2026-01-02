type UpdateRacksConfirmationDialogProps = {
  isOpen: boolean;
  sessionCount: number;
  racks: number[];
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  disabled?: boolean;
};

/**
 * Confirmation dialog for updating multiple booking sessions with new racks
 */
export function UpdateRacksConfirmationDialog({
  isOpen,
  sessionCount,
  racks,
  onCancel,
  onConfirm,
  saving,
  disabled = false,
}: UpdateRacksConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="rounded-md bg-indigo-900/20 border border-indigo-700/50 p-4 space-y-3">
      <p className="text-sm font-medium text-indigo-300">
        Update {sessionCount} selected session{sessionCount !== 1 ? "s" : ""} with the new racks?
      </p>
      <div className="text-xs text-indigo-400/80">
        <p>
          <span className="font-medium">Racks:</span> {racks.sort((a, b) => a - b).join(", ")}
        </p>
      </div>
      <p className="text-xs text-indigo-400/70">
        This will update the racks for {sessionCount} selected session{sessionCount !== 1 ? "s" : ""}.
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
          disabled={saving || disabled}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Updating..." : "Update"}
        </button>
      </div>
    </div>
  );
}

