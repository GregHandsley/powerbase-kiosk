import { useMemo } from 'react';
import clsx from 'clsx';
import type { useCapacityValidation } from './useCapacityValidation';

type CapacityDisplayProps = {
  validationResult: ReturnType<typeof useCapacityValidation>;
  proposedCapacity: number;
};

/**
 * Component to display capacity information and warnings
 */
export function CapacityDisplay({
  validationResult,
  // proposedCapacity,
}: CapacityDisplayProps) {
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
    const grouped = new Map<number, typeof violations>();
    violations.forEach((v) => {
      const week = (v as (typeof violations)[0] & { week?: number }).week || 1;
      if (!grouped.has(week)) {
        grouped.set(week, []);
      }
      grouped.get(week)!.push(v);
    });
    return grouped;
  }, [violations]);

  if (isLoading) {
    return (
      <div className="border border-slate-700 rounded-md p-3 bg-slate-950/60">
        <p className="text-xs text-slate-400">Checking capacity...</p>
      </div>
    );
  }

  // If no capacity limits are set, show info message
  if (maxLimit === Infinity && maxUsed === 0) {
    return (
      <div className="border border-slate-600 rounded-md p-3 bg-slate-950/40">
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

  return (
    <div className="space-y-2">
      {/* Overall capacity status */}
      <div
        className={clsx(
          'border rounded-md p-3 transition-colors',
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
          <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
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
          <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
            {weekResults.map((weekResult) => {
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

              return (
                <div
                  key={weekResult.week}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-400">
                    Week {weekResult.week}:
                  </span>
                  <div className="flex items-center gap-2">
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
