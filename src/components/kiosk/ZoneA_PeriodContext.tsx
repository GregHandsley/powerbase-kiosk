import { format } from 'date-fns';

type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

type Props = {
  periodType: PeriodType | null;
  periodStart: string | null; // ISO time string
  periodEnd: string | null; // ISO time string
  nextPeriodType: PeriodType | null;
  nextPeriodStart: string | null; // ISO time string
  isLoading?: boolean;
};

/**
 * Zone A: Period/Mode Context
 *
 * Purpose: Communicate the current gym period/mode
 * Rules: Static (never cycles), applies to everyone
 *
 * Content:
 * - Large title: CURRENT PERIOD
 * - Period name (e.g. PERFORMANCE)
 * - Time range (e.g. 12:00–13:00)
 * - Optional: small "Next period" preview
 */
export function PeriodPanel({
  periodType,
  periodStart,
  periodEnd,
  nextPeriodType,
  nextPeriodStart,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">
          Current Period
        </div>
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!periodType) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">
          Current Period
        </div>
        <div className="text-slate-400 text-lg">No period data</div>
      </div>
    );
  }

  const timeRange =
    periodStart && periodEnd
      ? `${format(new Date(periodStart), 'HH:mm')}–${format(new Date(periodEnd), 'HH:mm')}`
      : null;

  const nextPeriodTime = nextPeriodStart
    ? format(new Date(nextPeriodStart), 'HH:mm')
    : null;

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">
        Current Period
      </div>

      <div className="text-5xl font-semibold text-slate-100">{periodType}</div>

      {timeRange && (
        <div className="text-2xl text-slate-300 font-mono">{timeRange}</div>
      )}

      {nextPeriodType && nextPeriodTime && (
        <div className="pt-2">
          <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-1">
            Next Period
          </div>
          <div className="text-lg text-slate-400">
            {nextPeriodType} from {nextPeriodTime}
          </div>
        </div>
      )}
    </div>
  );
}
