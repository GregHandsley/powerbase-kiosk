import clsx from "clsx";

type BookingEditorActionsProps = {
  onEditRacks: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDeleteSelected: () => void;
  onDeleteSeries: () => void;
  onExtend: () => void;
  saving: boolean;
  deleting: boolean;
  hasTimeChanges: boolean;
  selectedInstancesCount: number;
  seriesInstancesCount: number;
  showDeleteConfirm: boolean;
  showExtendDialog: boolean;
  isLocked: boolean;
};

/**
 * Action buttons for booking editor
 */
export function BookingEditorActions({
  onEditRacks,
  onCancel,
  onSave,
  onDeleteSelected,
  onDeleteSeries,
  onExtend,
  saving,
  deleting,
  hasTimeChanges,
  selectedInstancesCount,
  seriesInstancesCount,
  showDeleteConfirm,
  showExtendDialog,
  isLocked,
}: BookingEditorActionsProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onEditRacks}
          disabled={isLocked || saving || deleting}
          className={clsx(
            "px-4 py-2 text-sm font-medium rounded-md",
            "bg-slate-700 hover:bg-slate-600 text-slate-100",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Edit Racks
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || deleting}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || deleting || isLocked || !hasTimeChanges}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-md",
              "bg-indigo-600 hover:bg-indigo-500 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Delete Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-800">
        {selectedInstancesCount > 0 && (
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={
              isLocked ||
              saving ||
              deleting ||
              showDeleteConfirm !== false ||
              showExtendDialog
            }
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-md",
              "bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Delete Selected ({selectedInstancesCount})
          </button>
        )}
        {seriesInstancesCount > 1 && (
          <button
            type="button"
            onClick={onDeleteSeries}
            disabled={
              isLocked ||
              saving ||
              deleting ||
              showDeleteConfirm !== false ||
              showExtendDialog
            }
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-md",
              "bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Delete Entire Series
          </button>
        )}
        <button
          type="button"
          onClick={onExtend}
          disabled={
            isLocked ||
            saving ||
            deleting ||
            showExtendDialog ||
            showDeleteConfirm !== false
          }
          className={clsx(
            "px-3 py-1.5 text-xs font-medium rounded-md",
            "bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-800/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Extend Booking
        </button>
      </div>
    </div>
  );
}

