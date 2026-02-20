type CurrentPeriod = {
  sideName: string;
  periodType: string;
};

type TopStatsRowProps = {
  insightsLoading: boolean;
  utilizationPct: number;
  dashboardRole: 'admin' | 'bookings_team' | 'coach';
  weeklyBookingsCount: number;
  atRiskCount: number;
  pendingQueueCount: number;
  currentPeriods: CurrentPeriod[];
  cardPad: string;
};

export function TopStatsRow({
  insightsLoading,
  utilizationPct,
  dashboardRole,
  weeklyBookingsCount,
  atRiskCount,
  pendingQueueCount,
  currentPeriods,
  cardPad,
}: TopStatsRowProps) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
      <div
        className={`rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad}`}
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Utilisation
        </p>
        <div className="mt-2">
          <p className="text-2xl font-semibold text-cyan-300">
            {insightsLoading ? '...' : `${utilizationPct}%`}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad}`}
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {dashboardRole === 'coach'
            ? 'Bookings This Week'
            : 'At-Risk Bookings'}
        </p>
        <div className="mt-2">
          <p className="text-2xl font-semibold text-amber-300">
            {dashboardRole === 'coach' ? weeklyBookingsCount : atRiskCount}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad}`}
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Pending Queue
        </p>
        <div className="mt-2">
          <p className="text-2xl font-semibold text-slate-100">
            {pendingQueueCount}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad}`}
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Current Periods
        </p>
        <div className="mt-2 flex items-center gap-2">
          {currentPeriods.map((entry) => (
            <div
              key={`period-${entry.sideName}`}
              className="flex flex-1 items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1"
            >
              <span className="text-xs text-slate-300">{entry.sideName}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  entry.periodType === 'Performance'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : entry.periodType === 'General User'
                      ? 'bg-slate-500/20 text-slate-300'
                      : entry.periodType === 'Closed'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-violet-500/15 text-violet-300'
                }`}
              >
                {entry.periodType}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
