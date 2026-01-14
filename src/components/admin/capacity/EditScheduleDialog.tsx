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
  editMode: 'single' | 'future';
  onEditModeChange: (mode: 'single' | 'future') => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EditScheduleDialog({
  isOpen,
  selectedDate,
  scheduleInfo,
  editMode,
  onEditModeChange,
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
          Edit Schedule
        </h3>
        <p className="text-sm text-slate-300 mb-4">
          How would you like to apply these changes?
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
            <input
              type="radio"
              name="editMode"
              value="single"
              checked={editMode === 'single'}
              onChange={() => onEditModeChange('single')}
              className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">
                This event only
              </div>
              <div className="text-xs text-slate-400">
                Changes will only apply to{' '}
                {format(selectedDate, 'EEEE, MMM d, yyyy')}. Past events will
                remain unchanged.
              </div>
            </div>
          </label>

          {scheduleInfo.recurrenceType !== 'single' && (
            <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
              <input
                type="radio"
                name="editMode"
                value="future"
                checked={editMode === 'future'}
                onChange={() => onEditModeChange('future')}
                className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">
                  This and future events
                </div>
                <div className="text-xs text-slate-400">
                  Changes will apply to{' '}
                  {format(selectedDate, 'EEEE, MMM d, yyyy')} and all future
                  occurrences. Past events will remain unchanged.
                </div>
              </div>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
