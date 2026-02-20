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
  performanceCapacityUsed?: number | null;
  performanceCapacityLimit?: number | null;
  now: Date;
  isLoading?: boolean;
};

/**
 * Zone A: Period/Mode Context
 *
 * Purpose: Communicate the current gym period/mode
 * Rules: Static (never cycles), applies to everyone
 *
 * Content:
 * - Large title: SESSION NOW
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
  performanceCapacityUsed = null,
  performanceCapacityLimit = null,
  now,
  isLoading = false,
}: Props) {
  const clockMain = format(now, 'HH:mm');
  const clockSeconds = format(now, 'ss');
  const dateLabel = format(now, 'EEE d MMM');
  const sectionLabel = 'Session';

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="kiosk-kicker">{sectionLabel}</div>
          <div className="text-slate-400 text-lg">Loading...</div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="kiosk-kicker">{dateLabel}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-[clamp(44px,5.6vh,76px)] font-semibold tracking-tight text-slate-100 font-mono leading-none">
              {clockMain}
            </div>
            <div className="text-[clamp(18px,2.2vh,30px)] text-slate-400 font-mono leading-none">
              {clockSeconds}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!periodType) {
    return (
      <div className="h-full flex items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="kiosk-kicker">{sectionLabel}</div>
          <div className="text-slate-400 text-lg">No period data</div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="kiosk-kicker">{dateLabel}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-[clamp(44px,5.6vh,76px)] font-semibold tracking-tight text-slate-100 font-mono leading-none">
              {clockMain}
            </div>
            <div className="text-[clamp(18px,2.2vh,30px)] text-slate-400 font-mono leading-none">
              {clockSeconds}
            </div>
          </div>
        </div>
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
  const showPerformanceCapacity =
    periodType === 'Performance' ||
    periodType === 'High Hybrid' ||
    periodType === 'Low Hybrid';
  const performanceCapacityLabel =
    showPerformanceCapacity && performanceCapacityLimit !== null
      ? `Performance capacity: ${performanceCapacityUsed ?? 0}/${performanceCapacityLimit}`
      : null;

  return (
    <div className="h-full grid grid-rows-[minmax(0,1fr)_auto] gap-3">
      <div className="min-h-0 flex items-center justify-between gap-8">
        <div className="min-w-0 space-y-2">
          <div className="kiosk-kicker">{sectionLabel}</div>
          <div className="text-[clamp(34px,4.3vh,58px)] font-semibold tracking-tight text-slate-100">
            {periodType}
          </div>
          {timeRange && (
            <div className="text-[clamp(17px,2.4vh,30px)] text-slate-300 font-mono tracking-[0.06em]">
              {timeRange}
            </div>
          )}
          {performanceCapacityLabel && (
            <div className="text-[clamp(12px,1.5vh,18px)] text-slate-300">
              {performanceCapacityLabel}
            </div>
          )}
          {nextPeriodType && nextPeriodTime && (
            <div className="text-[clamp(12px,1.5vh,16px)] text-slate-400">
              Next change: {nextPeriodType} {nextPeriodTime}
            </div>
          )}
        </div>

        <div className="text-right shrink-0 flex flex-col items-end">
          <div className="kiosk-kicker">{dateLabel}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-[clamp(48px,6vh,86px)] font-semibold tracking-tight text-slate-100 font-mono leading-none">
              {clockMain}
            </div>
            <div className="text-[clamp(18px,2.2vh,30px)] text-slate-400 font-mono leading-none">
              {clockSeconds}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-md border border-slate-700/80 bg-slate-900/25 px-3 py-2 text-[clamp(11px,1.35vh,16px)] text-slate-300">
        All users must have a valid booking to train.
      </div>
    </div>
  );
}
