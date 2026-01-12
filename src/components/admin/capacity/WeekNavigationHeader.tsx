import { addDays, format, startOfWeek } from 'date-fns';
import clsx from 'clsx';

type Props = {
  currentWeek: Date;
  selectedSide: 'Power' | 'Base';
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onSideChange: (side: 'Power' | 'Base') => void;
};

export function WeekNavigationHeader({
  currentWeek,
  selectedSide,
  onNavigateWeek,
  onGoToToday,
  onSideChange,
}: Props) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigateWeek('prev')}
          className="p-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
          aria-label="Previous week"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          onClick={onGoToToday}
          className="px-3 py-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 text-sm transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => onNavigateWeek('next')}
          className="p-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
          aria-label="Next week"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        <div className="text-sm font-medium text-slate-200 ml-2">
          {format(weekStart, 'MMM d')} –{' '}
          {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-300">Side:</label>
        <div className="flex rounded-md border border-slate-600 bg-slate-950 overflow-hidden">
          <button
            type="button"
            onClick={() => onSideChange('Power')}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium transition',
              selectedSide === 'Power'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            Power
          </button>
          <button
            type="button"
            onClick={() => onSideChange('Base')}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium transition',
              selectedSide === 'Base'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            Base
          </button>
        </div>
      </div>
    </div>
  );
}
