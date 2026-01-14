import clsx from 'clsx';

type BookingEditorActionsProps = {
  onEditRacks?: () => void;
  onCancel: () => void;
  onSave?: () => void;
  onCancelBooking?: () => void;
  onExtend?: () => void;
  saving: boolean;
  cancelling: boolean;
  hasChanges: boolean;
  selectedInstancesCount: number;
  seriesInstancesCount: number;
  showCancelDialog: boolean;
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
  onCancelBooking,
  onExtend,
  saving,
  cancelling,
  hasChanges,
  selectedInstancesCount,
  // seriesInstancesCount,
  showCancelDialog,
  showExtendDialog,
  isLocked,
}: BookingEditorActionsProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-700">
      <div className="flex items-center justify-between gap-3">
        {onEditRacks && (
          <button
            type="button"
            onClick={onEditRacks}
            disabled={isLocked || saving || cancelling}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md',
              'bg-slate-700 hover:bg-slate-600 text-slate-100',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Edit Racks
          </button>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || cancelling}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={
                saving ||
                cancelling ||
                isLocked ||
                !hasChanges ||
                selectedInstancesCount === 0
              }
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-md',
                'bg-indigo-600 hover:bg-indigo-500 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Cancel Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-800">
        {onCancelBooking && (
          <button
            type="button"
            onClick={onCancelBooking}
            disabled={
              isLocked ||
              saving ||
              cancelling ||
              showCancelDialog ||
              showExtendDialog
            }
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md',
              'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel Booking
          </button>
        )}
        {onExtend && (
          <button
            type="button"
            onClick={onExtend}
            disabled={
              isLocked ||
              saving ||
              cancelling ||
              showExtendDialog ||
              showCancelDialog
            }
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md',
              'bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-800/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Extend Booking
          </button>
        )}
      </div>
    </div>
  );
}
