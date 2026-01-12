import { formatDateTime } from '../../shared/dateUtils';

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
};

type ExtendBookingDialogProps = {
  isOpen: boolean;
  extendWeeks: number;
  onExtendWeeksChange: (weeks: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  seriesInstances: SeriesInstance[];
  extending: boolean;
  disabled?: boolean;
};

/**
 * Dialog for extending a booking series
 */
export function ExtendBookingDialog({
  isOpen,
  extendWeeks,
  onExtendWeeksChange,
  onCancel,
  onConfirm,
  seriesInstances,
  extending,
  disabled = false,
}: ExtendBookingDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="rounded-md bg-indigo-900/20 border border-indigo-700/50 p-4 space-y-3">
      <p className="text-sm font-medium text-indigo-300">Extend Booking</p>
      <p className="text-xs text-indigo-400/80">
        Add additional weeks to this booking series. New instances will use the
        same racks, areas, and time pattern.
      </p>
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">
          Number of weeks to add
        </label>
        <input
          type="number"
          min="1"
          max="16"
          value={extendWeeks}
          onChange={(e) =>
            onExtendWeeksChange(
              Math.max(1, Math.min(16, parseInt(e.target.value) || 1))
            )
          }
          disabled={extending || disabled}
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      {seriesInstances.length > 0 && (
        <div className="text-xs text-indigo-300/70 bg-indigo-950/30 p-2 rounded">
          <p className="font-medium mb-1">Current series:</p>
          <p>
            {seriesInstances.length} session
            {seriesInstances.length !== 1 ? 's' : ''} • Last session:{' '}
            {formatDateTime(seriesInstances[seriesInstances.length - 1].start)}
          </p>
          <p className="mt-1">
            After extension: {seriesInstances.length + extendWeeks} session
            {seriesInstances.length + extendWeeks !== 1 ? 's' : ''}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={extending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={extending || disabled || extendWeeks < 1}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {extending ? 'Extending...' : 'Extend Booking'}
        </button>
      </div>
    </div>
  );
}
