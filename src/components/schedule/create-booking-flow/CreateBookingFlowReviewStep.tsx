import { addWeeks, format } from 'date-fns';
import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../../../schemas/bookingForm';
import { combineDateAndTime } from '../../admin/booking/utils';
import type { useWeekManagement } from '../../admin/booking/useWeekManagement';
import type { useCapacityValidation } from '../../admin/booking/useCapacityValidation';
import type { ReviewConflict } from '../../admin/booking/checkBookingConflicts';
import { formatRackRanges } from './utils';

type Props = {
  form: UseFormReturn<BookingFormValues>;
  startDate: string | undefined;
  startTime: string | undefined;
  endTime: string | undefined;
  platformSlots:
    | Array<{ rackNumber: number; start: string; end: string }>
    | undefined;
  areaSlots:
    | Array<{ area_key: string; start: string; end: string }>
    | undefined;
  capacity: number;
  weekManagement: ReturnType<typeof useWeekManagement>;
  capacityValidation: ReturnType<typeof useCapacityValidation>;
  reviewConflicts: ReviewConflict[];
  reviewConflictsLoading: boolean;
  reviewConflictsError: string | null;
  submitError: string | null;
  onEditWeek: (weekIndex: number) => void;
};

export function CreateBookingFlowReviewStep({
  // form,
  startDate,
  startTime,
  endTime,
  platformSlots,
  areaSlots,
  capacity,
  weekManagement,
  capacityValidation,
  reviewConflicts,
  reviewConflictsLoading,
  reviewConflictsError,
  submitError,
  onEditWeek,
}: Props) {
  return (
    <div className="space-y-4">
      {reviewConflictsError && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/50 p-3 text-sm text-red-300">
          {reviewConflictsError}
        </div>
      )}

      {submitError && (
        <pre className="rounded-lg bg-red-900/20 border border-red-700/50 p-3 text-sm text-red-300 whitespace-pre-wrap">
          {submitError}
        </pre>
      )}

      {reviewConflictsLoading ? (
        <p className="text-slate-400 py-4">Checking for conflicts…</p>
      ) : (
        <ul className="space-y-3">
          {Array.from({ length: weekManagement.weeksCount }, (_, i) => {
            const weekNum = i + 1;
            const startTemplate =
              startDate && startTime
                ? combineDateAndTime(startDate, startTime)
                : null;
            const weekStart = startTemplate ? addWeeks(startTemplate, i) : null;
            const weekConflicts = reviewConflicts.filter(
              (c) => c.weekIndex === i
            );
            const capacityViolations = capacityValidation.violations.filter(
              (v) => (v.week ?? 1) === weekNum
            );
            const hasConflict = weekConflicts.length > 0;
            const hasCapacityIssue = capacityViolations.length > 0;
            const ok = !hasConflict && !hasCapacityIssue;
            const weekRacks = (weekManagement.racksByWeek.get(i) ?? [])
              .slice()
              .sort((a, b) => a - b);
            const weekCapacity =
              weekManagement.capacityByWeek.get(i) ?? capacity ?? 1;
            const slotsByRack = (platformSlots ?? []).reduce((acc, p) => {
              acc.set(p.rackNumber, { start: p.start, end: p.end });
              return acc;
            }, new Map<number, { start: string; end: string }>());
            const fullWindowKey =
              startTime && endTime ? `${startTime}–${endTime}` : null;
            let inferredSlot: { start: string; end: string } | null = null;
            for (const r of weekRacks) {
              const slot = slotsByRack.get(r);
              if (slot && fullWindowKey !== `${slot.start}–${slot.end}`) {
                inferredSlot = slot;
                break;
              }
            }
            if (inferredSlot) {
              for (const r of weekRacks) {
                const slot = slotsByRack.get(r);
                const key = slot ? `${slot.start}–${slot.end}` : null;
                if (key === fullWindowKey) {
                  slotsByRack.set(r, {
                    start: inferredSlot.start,
                    end: inferredSlot.end,
                  });
                }
              }
            }
            const slotKey = (s: string, e: string) => `${s}–${e}`;
            const racksBySlot = new Map<
              string,
              { start: string; end: string; racks: number[] }
            >();
            for (const r of weekRacks) {
              const slot = slotsByRack.get(r);
              const s = slot?.start ?? startTime ?? '—';
              const e = slot?.end ?? endTime ?? '—';
              const key = slotKey(s, e);
              if (!racksBySlot.has(key)) {
                racksBySlot.set(key, { start: s, end: e, racks: [] });
              }
              racksBySlot.get(key)!.racks.push(r);
            }
            const slotGroups = Array.from(racksBySlot.values()).sort((a, b) => {
              const [ah, am] = a.start.split(':').map(Number);
              const [bh, bm] = b.start.split(':').map(Number);
              return (ah ?? 0) * 60 + (am ?? 0) - (bh ?? 0) * 60 - (bm ?? 0);
            });

            return (
              <li
                key={i}
                className={`rounded-xl border p-4 ${
                  ok
                    ? 'border-emerald-700/50 bg-emerald-900/20'
                    : 'border-amber-700/50 bg-amber-900/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-200">
                      Week {weekNum}
                      {weekStart && (
                        <span className="ml-2 text-slate-400 font-normal">
                          {format(weekStart, 'EEE d MMM')}
                          {startTime && endTime && (
                            <>
                              {' '}
                              · {startTime}–{endTime}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {ok && (
                      <p className="text-sm text-emerald-300/90 mt-1">
                        No conflicts
                      </p>
                    )}
                    <ul className="mt-2 space-y-0.5 text-sm text-slate-300">
                      {slotGroups.map((group) => (
                        <li key={`${group.start}-${group.end}`}>
                          Racks {formatRackRanges(group.racks)}: {group.start}–
                          {group.end}
                        </li>
                      ))}
                      {(areaSlots ?? []).map((slot) => (
                        <li key={slot.area_key}>
                          {slot.area_key
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                          : {slot.start}–{slot.end}
                        </li>
                      ))}
                      <li>Athletes: {weekCapacity}</li>
                    </ul>
                    {hasConflict && (
                      <ul className="mt-2 space-y-1 text-sm text-amber-200">
                        {weekConflicts.map((c) => (
                          <li key={`${c.weekIndex}-${c.rack}`}>
                            Rack {c.rack} conflicts with "{c.conflictingBooking}
                            " ({c.conflictTime})
                          </li>
                        ))}
                      </ul>
                    )}
                    {hasCapacityIssue && (
                      <p className="mt-2 text-sm text-amber-200">
                        Capacity exceeded at peak (
                        {capacityViolations[0]?.timeStr ?? '—'})
                      </p>
                    )}
                  </div>
                  {!ok && (
                    <button
                      type="button"
                      onClick={() => onEditWeek(i)}
                      className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
                    >
                      Edit week
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
