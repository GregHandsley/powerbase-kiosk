import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import type { TodayBooking } from '../types';

type NowTodayPanelProps = {
  dashboardRole: 'admin' | 'bookings_team' | 'coach';
  liveCount: number;
  nextCount: number;
  nextStartMs: number | null;
  scopedTodaysBookings: TodayBooking[];
  liveInstanceIds: Set<number>;
  cardPad: string;
};

export function NowTodayPanel({
  dashboardRole,
  liveCount,
  nextCount,
  nextStartMs,
  scopedTodaysBookings,
  liveInstanceIds,
  cardPad,
}: NowTodayPanelProps) {
  return (
    <section
      className={`min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad} flex flex-col`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Now & Today</h2>
        <Link
          to="/schedule"
          className="text-xs text-indigo-300 hover:text-indigo-200"
        >
          Schedule
        </Link>
      </div>

      <div className="mb-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        {liveCount > 0 ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-400">
              Live Now
            </p>
            <p className="mt-1 text-base font-semibold text-slate-100">
              {liveCount} session{liveCount === 1 ? '' : 's'} live now
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {nextStartMs
                ? `${nextCount} up next at ${format(new Date(nextStartMs), 'HH:mm')}`
                : 'No more sessions scheduled today'}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Live Now
            </p>
            <p className="mt-1 text-base font-semibold text-slate-200">
              No active session right now
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {nextStartMs
                ? `${nextCount} session${nextCount === 1 ? '' : 's'} up next at ${format(new Date(nextStartMs), 'HH:mm')}`
                : 'No more sessions scheduled today'}
            </p>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1">
        {scopedTodaysBookings.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-500">
            {dashboardRole === 'coach'
              ? 'No coach bookings for today.'
              : 'No bookings for today.'}
          </div>
        ) : (
          scopedTodaysBookings.map((booking) => {
            const bookingStart = new Date(booking.start).getTime();
            const isLive = liveInstanceIds.has(booking.instanceId);
            const isNext =
              !isLive && nextStartMs !== null && bookingStart === nextStartMs;
            return (
              <div
                key={booking.instanceId}
                className={`rounded-lg border px-3 py-2 ${
                  isLive
                    ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-400/30'
                    : isNext
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm text-slate-200">
                    {booking.title}
                  </p>
                  {isLive ? (
                    <span className="rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                      Live
                    </span>
                  ) : isNext ? (
                    <span className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-300">
                      Up next
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {format(new Date(booking.start), 'HH:mm')}-
                  {format(new Date(booking.end), 'HH:mm')} · {booking.side}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
