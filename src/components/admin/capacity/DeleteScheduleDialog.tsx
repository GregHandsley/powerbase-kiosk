import { format } from 'date-fns';

type Props = {
  isOpen: boolean;
  selectedDate: Date | null;
  scheduleInfo: {
    recurrenceType: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    periodType: string;
  } | null;
  deleteMode: 'single' | 'future' | 'all';
  deleting: boolean;
  onDeleteModeChange: (mode: 'single' | 'future' | 'all') => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteScheduleDialog({
  isOpen,
  selectedDate,
  scheduleInfo,
  deleteMode,
  deleting,
  onDeleteModeChange,
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen || !scheduleInfo || !selectedDate) return null;

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
        <h3 className="text-lg font-semibold text-slate-100 mb-2">
          Delete Schedule
        </h3>
        <p className="text-sm text-slate-300 mb-4">
          How would you like to delete this schedule?
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
            <input
              type="radio"
              name="deleteMode"
              value="single"
              checked={deleteMode === 'single'}
              onChange={() => onDeleteModeChange('single')}
              className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">
                This event only
              </div>
              <div className="text-xs text-slate-400">
                Delete only {format(selectedDate, 'EEEE, MMM d, yyyy')}. Past
                events will remain.
              </div>
            </div>
          </label>

          {scheduleInfo.recurrenceType !== 'single' && (
            <>
              <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="deleteMode"
                  value="future"
                  checked={deleteMode === 'future'}
                  onChange={() => onDeleteModeChange('future')}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    This and future events
                  </div>
                  <div className="text-xs text-slate-400">
                    Delete {format(selectedDate, 'EEEE, MMM d, yyyy')} and all
                    future occurrences. Past events will remain.
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="deleteMode"
                  value="all"
                  checked={deleteMode === 'all'}
                  onChange={() => onDeleteModeChange('all')}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    All events in the series
                  </div>
                  <div className="text-xs text-slate-400">
                    Delete all occurrences of this schedule, including past
                    events.
                  </div>
                </div>
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
