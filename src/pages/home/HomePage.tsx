import { useMemo, useState, type MouseEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePrimaryOrganizationId } from '../../hooks/usePermissions';
import { compactSeries } from './utils';
import type { HoverTooltip } from './types';
import { useDashboardInsights } from './useDashboardInsights';
import { TopStatsRow } from './components/TopStatsRow';
import { NowTodayPanel } from './components/NowTodayPanel';
import { RackUtilisationMapPanel } from './components/RackUtilisationMapPanel';
import { DayUtilisationPanel } from './components/DayUtilisationPanel';

export function Home() {
  const { user, role } = useAuth();
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();

  const dashboardRole =
    role === 'admin'
      ? 'admin'
      : role === 'bookings_team'
        ? 'bookings_team'
        : 'coach';

  const { insights, insightsLoading, pendingQueueCount } = useDashboardInsights(
    {
      primaryOrgId,
      dashboardRole,
      userId: user?.id,
    }
  );

  const atRiskCount = insights?.atRiskBookings.length ?? 0;
  const weeklyBookingsCount = insights?.bookingsThisWeek ?? 0;
  const cardPad = 'p-2.5';

  const chartData = useMemo(
    () =>
      (insights?.sideGraphs ?? []).map((graph) => ({
        ...graph,
        displaySeries: compactSeries(graph.series),
      })),
    [insights?.sideGraphs]
  );

  const rackHeatmaps = useMemo(() => insights?.rackHeatmaps ?? [], [insights]);
  const todaysBookings = useMemo(
    () => insights?.todaysBookings ?? [],
    [insights]
  );

  const scopedTodaysBookings = useMemo(() => {
    if (dashboardRole !== 'coach' || !user?.id) return todaysBookings;
    return todaysBookings.filter((booking) => booking.createdBy === user.id);
  }, [todaysBookings, dashboardRole, user]);

  const currentTimeMs = insights?.currentTimeMs ?? 0;
  const { liveInstanceIds, nextStartMs } = useMemo(() => {
    const liveIds = new Set<number>();
    let soonestNextStart: number | null = null;

    for (const booking of scopedTodaysBookings) {
      const startMs = new Date(booking.start).getTime();
      const endMs = new Date(booking.end).getTime();
      if (startMs <= currentTimeMs && endMs > currentTimeMs) {
        liveIds.add(booking.instanceId);
        continue;
      }
      if (
        startMs > currentTimeMs &&
        (soonestNextStart === null || startMs < soonestNextStart)
      ) {
        soonestNextStart = startMs;
      }
    }

    return { liveInstanceIds: liveIds, nextStartMs: soonestNextStart };
  }, [scopedTodaysBookings, currentTimeMs]);

  const liveCount = liveInstanceIds.size;
  const nextCount =
    nextStartMs === null
      ? 0
      : scopedTodaysBookings.filter(
          (booking) => new Date(booking.start).getTime() === nextStartMs
        ).length;

  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);
  const showTooltip = (event: MouseEvent<HTMLElement>, lines: string[]) =>
    setHoverTooltip({ x: event.clientX, y: event.clientY, lines });
  const moveTooltip = (event: MouseEvent<HTMLElement>) =>
    setHoverTooltip((prev) =>
      prev ? { ...prev, x: event.clientX, y: event.clientY } : prev
    );
  const hideTooltip = () => setHoverTooltip(null);

  return (
    <div className="h-full min-h-0 overflow-hidden px-3 py-2">
      <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
          <TopStatsRow
            insightsLoading={insightsLoading}
            utilizationPct={insights?.utilizationPct ?? 0}
            dashboardRole={dashboardRole}
            weeklyBookingsCount={weeklyBookingsCount}
            atRiskCount={atRiskCount}
            pendingQueueCount={pendingQueueCount}
            currentPeriods={
              insights?.currentPeriods ?? [
                { sideName: 'Power', periodType: 'Unscheduled' },
                { sideName: 'Base', periodType: 'Unscheduled' },
              ]
            }
            cardPad={cardPad}
          />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden xl:grid-cols-3">
            <NowTodayPanel
              dashboardRole={dashboardRole}
              liveCount={liveCount}
              nextCount={nextCount}
              nextStartMs={nextStartMs}
              scopedTodaysBookings={scopedTodaysBookings}
              liveInstanceIds={liveInstanceIds}
              cardPad={cardPad}
            />

            <RackUtilisationMapPanel
              rackHeatmaps={rackHeatmaps}
              cardPad={cardPad}
              showTooltip={showTooltip}
              moveTooltip={moveTooltip}
              hideTooltip={hideTooltip}
            />

            <DayUtilisationPanel
              chartData={chartData}
              cardPad={cardPad}
              showTooltip={showTooltip}
              moveTooltip={moveTooltip}
              hideTooltip={hideTooltip}
            />
          </div>
        </div>
      </div>

      {hoverTooltip && (
        <div
          className="pointer-events-none fixed z-[200] min-w-[160px] rounded-md border border-indigo-300/70 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.85)] ring-1 ring-indigo-400/30"
          style={{
            left: hoverTooltip.x + 12,
            top: hoverTooltip.y - 12,
            transform: 'translateY(-100%)',
          }}
        >
          {hoverTooltip.lines.map((line, idx) => (
            <div
              key={`${line}-${idx}`}
              className={idx === 0 ? 'font-semibold' : 'text-slate-200'}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
