import { useQuery } from '@tanstack/react-query';
import { addDays, format, getDay, startOfWeek } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import {
  formatTimeSlot,
  generateTimeSlots,
  parseExcludedDates,
  type ScheduleData,
} from '../../components/admin/capacity/scheduleUtils';
import type { DashboardInsights, SideRow } from './types';
import { getApplicableScheduleForSlot, getSideRackNumbers } from './utils';

type UseDashboardInsightsArgs = {
  primaryOrgId: number | null;
  dashboardRole: 'admin' | 'bookings_team' | 'coach';
  userId: string | undefined;
};

export function useDashboardInsights({
  primaryOrgId,
  dashboardRole,
  userId,
}: UseDashboardInsightsArgs) {
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: [
      'home-dashboard-insights-v6',
      primaryOrgId,
      dashboardRole,
      userId,
    ],
    queryFn: async () => {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 7);
      const dateStr = format(dayStart, 'yyyy-MM-dd');
      const dayOfWeek = getDay(dayStart);

      let sidesQuery = supabase
        .from('sides')
        .select('id, name, key, organization_id')
        .order('id', { ascending: true });
      if (primaryOrgId) {
        sidesQuery = sidesQuery.eq('organization_id', primaryOrgId);
      }
      const { data: sidesData, error: sidesError } = await sidesQuery;
      if (sidesError) throw sidesError;

      const allSides = (sidesData ?? []) as SideRow[];
      const powerSideIds = allSides
        .filter((side) => {
          const key = (side.key || side.name || '').toLowerCase();
          return key.includes('power');
        })
        .map((side) => side.id);
      const baseSideIds = allSides
        .filter((side) => {
          const key = (side.key || side.name || '').toLowerCase();
          return key.includes('base');
        })
        .map((side) => side.id);

      const sideGroups: Array<{
        sideName: string;
        sideKey: string;
        sideIds: number[];
      }> = [
        { sideName: 'Power', sideKey: 'power', sideIds: powerSideIds },
        { sideName: 'Base', sideKey: 'base', sideIds: baseSideIds },
      ];

      const selectedSideIds = [...new Set([...powerSideIds, ...baseSideIds])];
      if (selectedSideIds.length === 0) {
        return {
          currentTimeMs: now.getTime(),
          utilizationPct: 0,
          sideUtilization: [],
          sideGraphs: sideGroups.map((group, idx) => ({
            sideId: idx + 1,
            sideName: group.sideName,
            sideKey: group.sideKey,
            series: [],
            avgUtilizationPct: 0,
          })),
          rackHeatmaps: sideGroups.map((group) => ({
            sideName: group.sideName,
            sideKey: group.sideKey,
            cells: getSideRackNumbers(group.sideKey).map((rackNumber) => ({
              rackNumber,
              occupancyPct: 0,
              bookedSlots: 0,
              bookableSlots: 0,
            })),
          })),
          currentPeriods: sideGroups.map((group) => ({
            sideName: group.sideName,
            periodType: 'Unscheduled',
          })),
          atRiskBookings: [],
          bookingsThisWeek: 0,
          todaysBookings: [],
        } as DashboardInsights;
      }

      const { data: instancesData, error: instancesError } = await supabase
        .from('booking_instances')
        .select(
          `
          id,
          booking_id,
          side_id,
          start,
          "end",
          racks,
          capacity,
          booking:bookings(title,status,created_at,last_minute_change,created_by)
        `
        )
        .in('side_id', selectedSideIds)
        .lt('start', dayEnd.toISOString())
        .gt('end', dayStart.toISOString())
        .order('start', { ascending: true })
        .limit(500);
      if (instancesError) throw instancesError;

      const instances = (instancesData ?? [])
        .map((row) => {
          const booking = Array.isArray(row.booking)
            ? row.booking[0]
            : row.booking;
          return {
            id: row.id,
            bookingId: row.booking_id,
            sideId: row.side_id,
            start: row.start,
            end: row.end,
            racks: Array.isArray(row.racks) ? row.racks : [],
            capacity: row.capacity ?? 0,
            bookingTitle: booking?.title ?? 'Untitled',
            bookingStatus: booking?.status ?? null,
            bookingCreatedAt: booking?.created_at ?? null,
            bookingCreatedBy: booking?.created_by ?? null,
            lastMinute: !!booking?.last_minute_change,
          };
        })
        .filter((instance) => instance.bookingStatus !== 'cancelled');

      let bookingsThisWeek = 0;
      if (dashboardRole === 'coach' && userId) {
        const { count, error: weekCountError } = await supabase
          .from('booking_instances')
          .select('id, booking:bookings!inner(created_by,status)', {
            count: 'exact',
            head: true,
          })
          .in('side_id', selectedSideIds)
          .gte('start', weekStart.toISOString())
          .lt('start', weekEnd.toISOString())
          .eq('booking.created_by', userId)
          .not('booking.status', 'in', '(cancelled)');
        if (!weekCountError) {
          bookingsThisWeek = count ?? 0;
        }
      }

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('capacity_schedules')
        .select('*')
        .in('side_id', selectedSideIds)
        .lte('start_date', dateStr)
        .or(`end_date.is.null,end_date.gte.${dateStr}`);
      if (schedulesError) throw schedulesError;

      const schedules = (schedulesData ?? []).map((schedule) => {
        return {
          ...(schedule as ScheduleData),
          excluded_dates: parseExcludedDates(
            (schedule as ScheduleData).excluded_dates
          ),
        } as ScheduleData;
      });

      const currentTimeStr = format(now, 'HH:mm');
      const currentPeriods = sideGroups.map((group) => {
        const sidePeriods = group.sideIds.map((sideId) => {
          const applicable = getApplicableScheduleForSlot(
            schedules.filter((schedule) => schedule.side_id === sideId),
            dayOfWeek,
            dateStr,
            currentTimeStr
          );
          return applicable?.period_type ?? 'Unscheduled';
        });
        const uniquePeriods = [...new Set(sidePeriods)];
        const periodType =
          uniquePeriods.length === 0
            ? 'Unscheduled'
            : uniquePeriods.length === 1
              ? uniquePeriods[0]
              : 'Mixed';
        return { sideName: group.sideName, periodType };
      });

      const timeSlots = generateTimeSlots();
      const sideUtilization: Array<{
        side: string;
        value: number;
        peak: number;
      }> = [];
      const sideGraphs = [] as DashboardInsights['sideGraphs'];

      sideGroups.forEach((group, groupIndex) => {
        const sideSchedules = schedules.filter((s) =>
          group.sideIds.includes(s.side_id)
        );
        let sideSlotCount = 0;
        let sideUtilizationSum = 0;
        let sidePeak = 0;
        const sideSeries: DashboardInsights['sideGraphs'][number]['series'] =
          [];

        timeSlots.forEach((slot) => {
          const timeStr = formatTimeSlot(slot);
          const slotDate = new Date(dayStart);
          slotDate.setHours(slot.hour, slot.minute, 0, 0);

          let totalUsed = 0;
          let totalCapacity = 0;
          let consideredSchedules = 0;
          let generalSchedules = 0;

          group.sideIds.forEach((sideId) => {
            const schedulesForSide = sideSchedules.filter(
              (schedule) => schedule.side_id === sideId
            );
            const applicable = getApplicableScheduleForSlot(
              schedulesForSide,
              dayOfWeek,
              dateStr,
              timeStr
            );

            if (!applicable || applicable.period_type === 'Closed') return;

            consideredSchedules += 1;
            if (applicable.period_type === 'General User') {
              generalSchedules += 1;
            }

            const usedForSide = instances
              .filter(
                (instance) =>
                  instance.sideId === sideId &&
                  new Date(instance.start) <= slotDate &&
                  new Date(instance.end) > slotDate
              )
              .reduce((sum, instance) => sum + instance.capacity, 0);

            totalUsed += usedForSide;
            totalCapacity += Math.max(0, applicable.capacity ?? 0);
          });

          if (consideredSchedules <= 0) return;

          const isGeneralUser =
            consideredSchedules > 0 && generalSchedules === consideredSchedules;
          const effectiveCapacity = isGeneralUser ? 0 : totalCapacity;
          const utilizationPct =
            effectiveCapacity > 0
              ? Math.round(Math.min(1, totalUsed / effectiveCapacity) * 100)
              : 0;
          sideSlotCount += 1;
          sideUtilizationSum += utilizationPct;
          sidePeak = Math.max(sidePeak, utilizationPct);
          sideSeries.push({
            time: timeStr,
            utilizationPct,
            athletes: Math.round(totalUsed),
            capacity: Math.round(effectiveCapacity),
            isGeneralUser,
          });
        });

        sideUtilization.push({
          side: group.sideName,
          value:
            sideSlotCount > 0
              ? Math.round(sideUtilizationSum / sideSlotCount)
              : 0,
          peak: sidePeak,
        });

        sideGraphs.push({
          sideId: groupIndex + 1,
          sideName: group.sideName,
          sideKey: group.sideKey,
          series: sideSeries.sort((a, b) => a.time.localeCompare(b.time)),
          avgUtilizationPct:
            sideSlotCount > 0
              ? Math.round(sideUtilizationSum / sideSlotCount)
              : 0,
        });
      });

      const rackHeatmaps = sideGroups.map((group) => {
        const rackNumbers = getSideRackNumbers(group.sideKey);
        const sideSchedules = schedules.filter((s) =>
          group.sideIds.includes(s.side_id)
        );
        const rackBookedSlots = new Map<number, number>();
        let bookableSlots = 0;

        timeSlots.forEach((slot) => {
          const timeStr = formatTimeSlot(slot);
          const slotDate = new Date(dayStart);
          slotDate.setHours(slot.hour, slot.minute, 0, 0);

          const slotIsBookable = group.sideIds.some((sideId) => {
            const applicable = getApplicableScheduleForSlot(
              sideSchedules.filter((schedule) => schedule.side_id === sideId),
              dayOfWeek,
              dateStr,
              timeStr
            );
            return (
              !!applicable &&
              applicable.period_type !== 'Closed' &&
              applicable.period_type !== 'General User' &&
              (applicable.capacity ?? 0) > 0
            );
          });

          if (!slotIsBookable) return;
          bookableSlots += 1;

          const activeInstances = instances.filter(
            (instance) =>
              group.sideIds.includes(instance.sideId) &&
              new Date(instance.start) <= slotDate &&
              new Date(instance.end) > slotDate
          );

          rackNumbers.forEach((rackNumber) => {
            const isBooked = activeInstances.some((instance) =>
              instance.racks.includes(rackNumber)
            );
            if (!isBooked) return;
            rackBookedSlots.set(
              rackNumber,
              (rackBookedSlots.get(rackNumber) ?? 0) + 1
            );
          });
        });

        return {
          sideName: group.sideName,
          sideKey: group.sideKey,
          cells: rackNumbers.map((rackNumber) => {
            const booked = rackBookedSlots.get(rackNumber) ?? 0;
            const occupancyPct =
              bookableSlots > 0
                ? Math.round((booked / bookableSlots) * 100)
                : 0;
            return {
              rackNumber,
              occupancyPct,
              bookedSlots: booked,
              bookableSlots,
            };
          }),
        };
      });

      const utilizationPct =
        sideUtilization.length > 0
          ? Math.round(
              sideUtilization.reduce((sum, side) => sum + side.value, 0) /
                sideUtilization.length
            )
          : 0;

      const atRiskMap = new Map<
        number,
        {
          bookingId: number;
          title: string;
          side: string;
          nextStart: string;
          riskScore: number;
        }
      >();
      instances
        .filter(
          (instance) =>
            (instance.bookingStatus === 'pending' ||
              instance.bookingStatus === 'pending_cancellation') &&
            new Date(instance.end) > now
        )
        .forEach((instance) => {
          const sideName =
            allSides.find((s) => s.id === instance.sideId)?.name || 'Unknown';
          const start = new Date(instance.start);
          const ageHours = instance.bookingCreatedAt
            ? (now.getTime() - new Date(instance.bookingCreatedAt).getTime()) /
              3600000
            : 0;
          const hoursUntilStart = (start.getTime() - now.getTime()) / 3600000;

          let riskScore = 0;
          if (hoursUntilStart <= 12) riskScore += 3;
          else if (hoursUntilStart <= 24) riskScore += 2;
          if (ageHours >= 6) riskScore += 1;
          if (instance.lastMinute) riskScore += 1;

          const existing = atRiskMap.get(instance.bookingId);
          if (!existing || new Date(existing.nextStart) > start) {
            atRiskMap.set(instance.bookingId, {
              bookingId: instance.bookingId,
              title: instance.bookingTitle,
              side: sideName,
              nextStart: instance.start,
              riskScore,
            });
          }
        });

      const atRiskBookings = [...atRiskMap.values()]
        .sort((a, b) =>
          b.riskScore === a.riskScore
            ? new Date(a.nextStart).getTime() - new Date(b.nextStart).getTime()
            : b.riskScore - a.riskScore
        )
        .slice(0, 5);

      const todaysBookings = instances
        .map((instance) => ({
          instanceId: instance.id,
          bookingId: instance.bookingId,
          title: instance.bookingTitle,
          side:
            allSides.find((s) => s.id === instance.sideId)?.name || 'Unknown',
          start: instance.start,
          end: instance.end,
          status: instance.bookingStatus,
          createdBy: instance.bookingCreatedBy,
        }))
        .sort(
          (a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime() ||
            new Date(a.end).getTime() - new Date(b.end).getTime()
        );

      return {
        currentTimeMs: now.getTime(),
        utilizationPct,
        sideUtilization,
        sideGraphs,
        rackHeatmaps,
        currentPeriods,
        atRiskBookings,
        bookingsThisWeek,
        todaysBookings,
      } as DashboardInsights;
    },
    enabled: !!userId,
  });

  const { data: pendingQueueCount = 0 } = useQuery({
    queryKey: ['home-dashboard-pending-queue-v3', dashboardRole, userId],
    queryFn: async () => {
      if (dashboardRole === 'coach') {
        if (!userId) return 0;
        const { count, error } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', userId)
          .in('status', ['pending', 'pending_cancellation']);
        if (error) throw error;
        return count ?? 0;
      }
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'pending_cancellation']);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
  });

  return {
    insights,
    insightsLoading,
    pendingQueueCount,
  };
}
