import { formatDateTime } from "../../shared/dateUtils";

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
};

type DeleteConfirmationDialogProps = {
  isOpen: boolean;
  type: "selected" | "series";
  selectedInstances: Set<number>;
  seriesInstances: SeriesInstance[];
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  disabled?: boolean;
};

/**
 * Confirmation dialog for deleting booking instances
 */
export function DeleteConfirmationDialog({
  isOpen,
  type,
  selectedInstances,
  seriesInstances,
  onCancel,
  onConfirm,
  deleting,
  disabled = false,
}: DeleteConfirmationDialogProps) {
  if (!isOpen) return null;

  const isSelected = type === "selected";
  const count = isSelected ? selectedInstances.size : seriesInstances.length;

  return (
    <div className="rounded-md bg-red-900/20 border border-red-700/50 p-4 space-y-3">
      <p className="text-sm font-medium text-red-300">
        {isSelected
          ? `Delete ${count} selected session${count !== 1 ? "s" : ""}?`
          : "Delete entire series?"}
      </p>
      <p className="text-xs text-red-400/80">
        {isSelected
          ? `This will delete ${count} selected session${count !== 1 ? "s" : ""}. Other sessions in the series will remain. This action cannot be undone.`
          : `This will delete all ${count} sessions in this series. This action cannot be undone.`}
      </p>
      {isSelected && selectedInstances.size > 0 && (
        <div className="text-xs text-red-300/70 bg-red-950/30 p-2 rounded max-h-24 overflow-auto">
          <p className="font-medium mb-1">Sessions to be deleted:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {seriesInstances
              .filter((inst) => selectedInstances.has(inst.id))
              .map((inst) => (
                <li key={inst.id}>
                  {formatDateTime(inst.start)} - {formatDateTime(inst.end)}
                </li>
              ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting || disabled}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

