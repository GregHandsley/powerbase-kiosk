import clsx from 'clsx';

type WeekNavigationProps = {
  currentWeekIndex: number;
  totalWeeks: number;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
};

/**
 * Week navigation component for cycling through weeks
 */
export function WeekNavigation({
  currentWeekIndex,
  totalWeeks,
  onPrevious,
  onNext,
  disabled = false,
}: WeekNavigationProps) {
  if (totalWeeks <= 1) return null;

  return (
    <div className="flex items-center justify-between mb-2">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentWeekIndex === 0 || disabled}
        className={clsx(
          'px-2 py-1 text-xs rounded border',
          currentWeekIndex === 0 || disabled
            ? 'border-slate-700 text-slate-600 cursor-not-allowed'
            : 'border-slate-600 text-slate-300 hover:bg-slate-800'
        )}
      >
        ← Previous Week
      </button>
      <span className="text-xs text-slate-400">
        Week {currentWeekIndex + 1} of {totalWeeks}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={currentWeekIndex === totalWeeks - 1 || disabled}
        className={clsx(
          'px-2 py-1 text-xs rounded border',
          currentWeekIndex === totalWeeks - 1 || disabled
            ? 'border-slate-700 text-slate-600 cursor-not-allowed'
            : 'border-slate-600 text-slate-300 hover:bg-slate-800'
        )}
      >
        Next Week →
      </button>
    </div>
  );
}
