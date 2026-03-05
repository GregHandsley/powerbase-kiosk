import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import type { useCapacityValidation } from './useCapacityValidation';

type CapacityDisplayProps = {
  validationResult: ReturnType<typeof useCapacityValidation>;
  proposedCapacity: number;
  /** When provided with onCapacityChange, enables per-week capacity editing in the week breakdown */
  capacityByWeek?: Map<number, number>;
  onCapacityChange?: (weekIndex: number, value: number) => void;
};

/**
 * Component to display capacity information and warnings
 */
export function CapacityDisplay({
  validationResult,
  // proposedCapacity,
  capacityByWeek,
  onCapacityChange,
}: CapacityDisplayProps) {
  const [editingWeekIndex, setEditingWeekIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const {
    isValid,
    // hasWarnings,
    violations,
    maxUsed,
    maxLimit,
    weekResults,
    isLoading,
  } = validationResult;

  // Group violations by week
  const violationsByWeek = useMemo(() => {
    type Violation = {
      week?: number;
      time: string;
      timeStr: string;
      used: number;
      limit: number;
      periodType: string;
    };
    const grouped = new Map<number, Violation[]>();
    violations.forEach((v) => {
      const week = (v as Violation).week || 1;
      if (!grouped.has(week)) {
        grouped.set(week, []);
      }
      grouped.get(week)!.push(v as Violation);
    });
    return grouped;
  }, [violations]);

  if (isLoading) {
    return (
      <div className="capacity-card-no-shadow border border-slate-700 rounded-md p-3 bg-slate-950/60">
        <p className="text-xs text-slate-400">Checking capacity...</p>
      </div>
    );
  }

  // If no capacity limits are set, show info message
  if (maxLimit === Infinity && maxUsed === 0) {
    return (
      <div className="capacity-card-no-shadow border border-slate-600 rounded-md p-3 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-slate-400">
            No capacity limits set for this time period. Capacity will not be
            enforced.
          </p>
        </div>
      </div>
    );
  }

  // Calculate usage percentage
  const usagePercent = maxLimit !== Infinity ? (maxUsed / maxLimit) * 100 : 0;
  const isNearLimit = usagePercent >= 80 && usagePercent < 100;
  const isOverLimit = !isValid;
  const isMultipleWeeks = weekResults !== undefined && weekResults.length > 1;

  const commitEdit = () => {
    const num = parseInt(editValue, 10);
    if (
      !isNaN(num) &&
      num >= 1 &&
      num <= 100 &&
      onCapacityChange &&
      editingWeekIndex !== null
    ) {
      onCapacityChange(editingWeekIndex, num);
    }
    setEditingWeekIndex(null);
  };

  return (
    <div className="space-y-2">
      {/* Overall capacity status - hide when multiple weeks (week-by-week is shown instead) */}
      {!isMultipleWeeks && (
        <div
          className={clsx(
            'capacity-card-no-shadow border rounded-md p-3 transition-colors',
            isOverLimit
              ? 'border-red-500 bg-red-950/20'
              : isNearLimit
                ? 'border-yellow-500 bg-yellow-950/20'
                : 'border-slate-600 bg-slate-950/40'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isOverLimit ? (
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : isNearLimit ? (
                <svg
                  className="w-5 h-5 text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <h3 className="text-sm font-semibold">
                {isOverLimit
                  ? 'Capacity Exceeded'
                  : isNearLimit
                    ? 'Near Capacity Limit'
                    : 'Capacity Available'}
              </h3>
            </div>
            {maxLimit !== Infinity && (
              <div className="text-right">
                <div className="text-xs font-mono">
                  <span
                    className={clsx(
                      isOverLimit
                        ? 'text-red-400'
                        : isNearLimit
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    )}
                  >
                    {maxUsed}
                  </span>
                  <span className="text-slate-400"> / </span>
                  <span className="text-slate-300">{maxLimit}</span>
                </div>
                <div className="text-[10px] text-slate-400">athletes</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {maxLimit !== Infinity && (
            <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className={clsx(
                  'h-2 rounded-full transition-all',
                  isOverLimit
                    ? 'bg-red-500'
                    : isNearLimit
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                )}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          )}

          {/* Status message */}
          {isOverLimit ? (
            <p className="text-xs text-red-400">
              This booking would exceed capacity by {maxUsed - maxLimit} athlete
              {maxUsed - maxLimit !== 1 ? 's' : ''} at peak times.
            </p>
          ) : isNearLimit ? (
            <p className="text-xs text-yellow-400">
              This booking would use {usagePercent.toFixed(0)}% of available
              capacity. Consider reducing the number of athletes.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              This booking would use {maxUsed} of {maxLimit} available athlete
              {maxLimit !== 1 ? 's' : ''} at peak times.
            </p>
          )}
        </div>
      )}

      {/* Detailed violations by week */}
      {violationsByWeek.size > 0 && (
        <div className="border border-red-500 rounded-md p-3 bg-red-950/20">
          <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-2">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Capacity Violations
          </h4>
          <div className="space-y-2">
            {Array.from(violationsByWeek.entries()).map(
              ([week, weekViolations]) => {
                // const firstViolation = weekViolations[0];
                const maxViolation = weekViolations.reduce(
                  (max, v) => (v.used > max.used ? v : max),
                  weekViolations[0]
                );

                return (
                  <div
                    key={week}
                    className="text-xs bg-slate-900/50 rounded p-2"
                  >
                    <div className="font-semibold text-red-300 mb-1">
                      Week {week}
                    </div>
                    <div className="text-slate-300 space-y-1">
                      <div>
                        Peak violation at{' '}
                        <span className="font-mono">
                          {maxViolation.timeStr}
                        </span>
                        :{' '}
                        <span className="text-red-400 font-semibold">
                          {maxViolation.used}
                        </span>{' '}
                        /{' '}
                        <span className="text-slate-400">
                          {maxViolation.limit}
                        </span>{' '}
                        athletes
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Period type: {maxViolation.periodType}
                      </div>
                      {weekViolations.length > 1 && (
                        <div className="text-slate-500 text-[10px]">
                          {weekViolations.length} time point
                          {weekViolations.length !== 1 ? 's' : ''} exceed
                          capacity
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
          <p className="text-xs text-red-300 mt-2">
            💡 Tip: Reduce the number of athletes or adjust the booking time to
            avoid capacity conflicts.
          </p>
        </div>
      )}

      {/* Week-by-week breakdown (if multiple weeks) */}
      {weekResults && weekResults.length > 1 && (
        <div className="border border-slate-600 rounded-md p-3 bg-slate-950/40">
          <h4 className="text-xs font-semibold text-slate-300 mb-2">
            Week-by-Week Capacity
          </h4>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
            {weekResults.map((weekResult) => {
              const weekIndex = weekResult.week - 1;
              const proposedCap =
                capacityByWeek?.get(weekIndex) ?? weekResult.proposedCapacity;
              const weekLimit =
                weekResult.result.maxLimit !== Infinity
                  ? weekResult.result.maxLimit
                  : null;
              const weekUsagePercent =
                weekLimit !== null
                  ? (weekResult.result.maxUsed / weekLimit) * 100
                  : 0;
              const weekIsNearLimit =
                weekUsagePercent >= 80 && weekUsagePercent < 100;
              const weekIsOverLimit = weekResult.result.violations.length > 0;
              const dateLabel = weekResult.proposedStart
                ? format(weekResult.proposedStart, 'd MMM')
                : null;
              const isEditing = editingWeekIndex === weekIndex;
              const canEdit = onCapacityChange && capacityByWeek !== undefined;

              return (
                <div
                  key={weekResult.week}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-slate-400 shrink-0">
                    Week {weekResult.week}
                    {dateLabel ? (
                      <span className="text-slate-500 font-normal">
                        {' '}
                        ({dateLabel})
                      </span>
                    ) : null}
                  </span>
                  <div className="flex items-center justify-end gap-2 min-w-[4.5rem] tabular-nums">
                    {isEditing ? (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitEdit();
                            }
                            if (e.key === 'Escape') {
                              setEditValue(String(proposedCap));
                              setEditingWeekIndex(null);
                            }
                          }}
                          autoFocus
                          className="w-14 min-w-[2.5rem] rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {weekLimit !== null && (
                          <>
                            <span className="text-slate-500">/</span>
                            <span className="text-slate-400">{weekLimit}</span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={commitEdit}
                          className="text-slate-400 hover:text-green-400 focus:text-green-400 focus:outline-none shrink-0"
                          title="Confirm"
                          aria-label="Confirm"
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className={clsx(
                            weekIsOverLimit
                              ? 'text-red-400 font-semibold'
                              : weekIsNearLimit
                                ? 'text-yellow-400'
                                : 'text-slate-300'
                          )}
                        >
                          {weekResult.result.maxUsed}
                        </span>
                        {weekLimit !== null ? (
                          <>
                            <span className="text-slate-500">/</span>
                            <span className="text-slate-400">{weekLimit}</span>
                          </>
                        ) : (
                          <span className="text-slate-500 text-[10px]">
                            (no limit)
                          </span>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWeekIndex(weekIndex);
                              setEditValue(String(proposedCap));
                            }}
                            className="text-slate-500 hover:text-slate-300 focus:text-slate-300 focus:outline-none"
                            title="Edit this week's capacity"
                            aria-label="Edit this week's capacity"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
