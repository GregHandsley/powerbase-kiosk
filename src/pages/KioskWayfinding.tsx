import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KioskLayout } from '../components/kiosk/KioskLayout';
import { PeriodPanel } from '../components/kiosk/ZoneA_PeriodContext';
import { PlatformStatusBoard } from '../components/kiosk/ZoneB_PlatformStatus';
import { FloorplanMap } from '../components/kiosk/ZoneC_FloorplanMap';
import { useSideSnapshot } from '../hooks/useSideSnapshot';
import { useInstancesRealtime } from '../hooks/useInstancesRealtime';
import type { SideKey } from '../nodes/data/sidesNodes';
import { useLiveViewCapacity } from '../components/schedule/hooks/useLiveViewCapacity';
import {
  doesScheduleApply,
  parseExcludedDates,
  type ScheduleData,
} from '../components/admin/capacity/scheduleUtils';
import { format, getDay } from 'date-fns';

// Placeholder data types - will be replaced with real data fetching
type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

type PlatformBooking = {
  platformNumber: number;
  nowBooking: {
    title: string;
    until: string;
  } | null;
  nextBooking: {
    title: string;
    from: string;
  } | null;
};

const POWER_PLATFORM_PAGES: number[][] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8],
  [9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18],
];

const BASE_PLATFORM_PAGES: number[][] = [
  [1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24],
];

const BASE_QUADRANT_LABELS = [
  'Quadrant A',
  'Quadrant B',
  'Quadrant C',
  'Quadrant D',
];

const PLATFORMS_PER_CYCLE = 6;
const EMPTY_PLATFORM_IDS: number[] = [];
const CYCLE_DURATION_MS = 10000; // 10 seconds per cycle
const FADE_DURATION_MS = 300;
const TIME_REFRESH_MS = 60_000;

/**
 * Main kiosk wayfinding page.
 *
 * This is a full-screen, read-only kiosk UI for 55-inch landscape TVs.
 * Designed for people walking past, often distracted, sometimes early for bookings.
 *
 * PRIMARY USER QUESTION: "Where do I need to go right now, or in the next few minutes?"
 */
export function KioskWayfinding() {
  const [search] = useSearchParams();
  const sideKeyParam = search.get('side') as SideKey | null;
  const sideKey: SideKey =
    sideKeyParam === 'Base' || sideKeyParam === 'Power' ? sideKeyParam : 'Base';

  const { snapshot, error, isLoading } = useSideSnapshot(sideKey);
  useInstancesRealtime();

  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date()), TIME_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const dateStr = format(nowTime, 'yyyy-MM-dd');
  const timeStr = format(nowTime, 'HH:mm');
  const dayOfWeek = getDay(nowTime);
  const liveViewSide = sideKey === 'Power' ? 'power' : 'base';
  const { applicableSchedule, capacitySchedules, schedulesLoading } =
    useLiveViewCapacity({
      side: liveViewSide,
      date: dateStr,
      time: timeStr,
    });

  // Cycling logic for Zone B
  const [currentCycleIndex, setCurrentCycleIndex] = useState(() => 0);
  const [isFading, setIsFading] = useState(() => false);

  // Transform snapshot data into platform bookings
  const platformPages = useMemo(() => getPlatformPages(sideKey), [sideKey]);
  const totalCycles = platformPages.length;
  const currentPageNumbers = useMemo(
    () => platformPages[currentCycleIndex] ?? EMPTY_PLATFORM_IDS,
    [platformPages, currentCycleIndex]
  );
  const visiblePlatformIds = currentPageNumbers;
  const visiblePlatforms = useMemo(
    () => mapPlatformsForPage(snapshot, currentPageNumbers),
    [snapshot, currentPageNumbers]
  );
  const quadrantLabel =
    sideKey === 'Base'
      ? (BASE_QUADRANT_LABELS[currentCycleIndex] ?? null)
      : null;
  // Cycle through platforms
  useEffect(() => {
    if (totalCycles <= 1) return;

    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentCycleIndex((prev) => (prev + 1) % totalCycles);
        setIsFading(false);
      }, FADE_DURATION_MS);
    }, CYCLE_DURATION_MS);

    return () => clearInterval(interval);
  }, [totalCycles]);

  const currentPeriod = useMemo(() => {
    if (!applicableSchedule) return null;
    return {
      type: applicableSchedule.period_type as PeriodType,
      start: buildIsoDateTime(dateStr, applicableSchedule.start_time),
      end: buildIsoDateTime(dateStr, applicableSchedule.end_time),
    };
  }, [applicableSchedule, dateStr]);

  const nextPeriod = useMemo(() => {
    if (!capacitySchedules.length) return null;
    const candidates = capacitySchedules
      .map((schedule) => ({
        ...schedule,
        excluded_dates: parseExcludedDates(schedule.excluded_dates),
      }))
      .filter((schedule) => {
        if (!isTimeAfter(schedule.start_time, timeStr)) return false;
        return doesScheduleApply(
          schedule as ScheduleData,
          dayOfWeek,
          dateStr,
          schedule.start_time
        );
      })
      .sort((a, b) => compareTimes(a.start_time, b.start_time));

    const nextSchedule = candidates[0];
    if (!nextSchedule) return null;
    return {
      type: nextSchedule.period_type as PeriodType,
      start: buildIsoDateTime(dateStr, nextSchedule.start_time),
    };
  }, [capacitySchedules, dateStr, dayOfWeek, timeStr]);

  return (
    <KioskLayout
      zoneA={
        <PeriodPanel
          periodType={currentPeriod?.type ?? null}
          periodStart={currentPeriod?.start ?? null}
          periodEnd={currentPeriod?.end ?? null}
          nextPeriodType={nextPeriod?.type ?? null}
          nextPeriodStart={nextPeriod?.start ?? null}
          isLoading={isLoading || schedulesLoading}
        />
      }
      zoneB={
        <PlatformStatusBoard
          platforms={visiblePlatforms}
          currentCycleIndex={currentCycleIndex}
          totalCycles={totalCycles}
          isFading={isFading}
          rowsPerPage={PLATFORMS_PER_CYCLE}
          cycleLabel={quadrantLabel}
          isLoading={isLoading}
        />
      }
      zoneC={
        <FloorplanMap
          sideKey={sideKey}
          snapshot={snapshot}
          visiblePlatformIds={visiblePlatformIds}
          isLoading={isLoading}
          error={error}
        />
      }
    />
  );
}

/**
 * Transform snapshot data into platform bookings.
 *
 * This is a placeholder implementation that needs to be replaced with
 * proper data transformation logic based on the actual snapshot structure.
 */
function getPlatformPages(sideKey: SideKey): number[][] {
  if (sideKey === 'Power') {
    return POWER_PLATFORM_PAGES;
  }

  if (sideKey === 'Base') {
    return BASE_PLATFORM_PAGES;
  }
  return [];
}

function mapPlatformsForPage(
  snapshot: ReturnType<typeof useSideSnapshot>['snapshot'],
  platformNumbers: number[]
): PlatformBooking[] {
  if (!snapshot) {
    return platformNumbers.map((platformNumber) => ({
      platformNumber,
      nowBooking: null,
      nextBooking: null,
    }));
  }

  const currentByRack = new Map<
    number,
    (typeof snapshot.currentInstances)[number]
  >();
  snapshot.currentInstances.forEach((inst) => {
    inst.racks.forEach((rack) => currentByRack.set(rack, inst));
  });

  return platformNumbers.map((platformNumber) => {
    const currentInst = currentByRack.get(platformNumber) ?? null;
    const nextUse = snapshot.nextUseByRack[platformNumber.toString()] ?? null;

    return {
      platformNumber,
      nowBooking: currentInst
        ? {
            title: currentInst.title,
            until: currentInst.end,
          }
        : null,
      nextBooking: nextUse
        ? {
            title: nextUse.title,
            from: nextUse.start,
          }
        : null,
    };
  });
}

function buildIsoDateTime(dateStr: string, timeStr: string): string {
  const [hourPart, minutePart] = timeStr.split(':');
  const date = new Date(`${dateStr}T00:00:00`);
  const hour = Number(hourPart || 0);
  const minute = Number(minutePart || 0);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function normalizeTime(timeStr: string): string {
  const parts = timeStr.split(':');
  const hour = parts[0]?.padStart(2, '0') ?? '00';
  const minute = parts[1]?.padStart(2, '0') ?? '00';
  return `${hour}:${minute}`;
}

function compareTimes(a: string, b: string): number {
  const t1 = normalizeTime(a);
  const t2 = normalizeTime(b);
  if (t1 < t2) return -1;
  if (t1 > t2) return 1;
  return 0;
}

function isTimeAfter(candidate: string, current: string): boolean {
  return compareTimes(candidate, current) > 0;
}
