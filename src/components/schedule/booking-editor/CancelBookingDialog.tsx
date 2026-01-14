import { format } from 'date-fns';

// type SeriesInstance = {
//   id: number;
//   start: string;
//   end: string;
// };

type Props = {
  isOpen: boolean;
  selectedDate: Date | null;
  bookingInfo: {
    title: string;
    bookingId: number;
    hasRecurrence: boolean;
  } | null;
  cancelMode: 'single' | 'future' | 'all';
  onCancelModeChange: (mode: 'single' | 'future' | 'all') => void;
  onConfirm: () => void;
  onCancel: () => void;
  cancelling: boolean;
};

/**
 * Dialog for cancelling bookings with mode selection (single, future, all)
 */
export function CancelBookingDialog({
  isOpen,
  selectedDate,
  bookingInfo,
  cancelMode,
  onCancelModeChange,
  onConfirm,
  onCancel,
  cancelling,
}: Props) {
  if (!isOpen || !bookingInfo || !selectedDate) return null;

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
          Cancel Booking
        </h3>
        <p className="text-sm text-slate-300 mb-1">
          Booking: <span className="font-medium">{bookingInfo.title}</span>
        </p>
        <p className="text-sm text-slate-300 mb-4">
          How would you like to cancel this booking?
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
            <input
              type="radio"
              name="cancelMode"
              value="single"
              checked={cancelMode === 'single'}
              onChange={() => onCancelModeChange('single')}
              className="w-4 h-4 text-red-600 border-slate-600 focus:ring-red-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">
                This session only
              </div>
              <div className="text-xs text-slate-400">
                Cancel only {format(selectedDate, 'EEEE, MMM d, yyyy')}. Past
                sessions will remain unchanged.
              </div>
            </div>
          </label>

          {bookingInfo.hasRecurrence && (
            <>
              <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="cancelMode"
                  value="future"
                  checked={cancelMode === 'future'}
                  onChange={() => onCancelModeChange('future')}
                  className="w-4 h-4 text-red-600 border-slate-600 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    This and future sessions
                  </div>
                  <div className="text-xs text-slate-400">
                    Cancel {format(selectedDate, 'EEEE, MMM d, yyyy')} and all
                    future occurrences. Past sessions will remain unchanged.
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="cancelMode"
                  value="all"
                  checked={cancelMode === 'all'}
                  onChange={() => onCancelModeChange('all')}
                  className="w-4 h-4 text-red-600 border-slate-600 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    All sessions in the series
                  </div>
                  <div className="text-xs text-slate-400">
                    Cancel all occurrences of this booking, including past
                    sessions.
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
            disabled={cancelling}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
