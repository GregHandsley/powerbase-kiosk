import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KioskLayout } from '../components/kiosk/KioskLayout';
import { PeriodPanel } from '../components/kiosk/ZoneA_PeriodContext';
import { PlatformStatusBoard } from '../components/kiosk/ZoneB_PlatformStatus';
import { FloorplanMap } from '../components/kiosk/ZoneC_FloorplanMap';
import type { SideSnapshot } from '../types/snapshot';
import type { SideKey } from '../nodes/data/sidesNodes';

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
const CYCLE_DURATION_MS = 10000;

const STATIC_SNAPSHOT: SideSnapshot = {
  at: '2026-02-02T12:00:00.000Z',
  sideId: 1,
  currentInstances: [
    {
      instanceId: 101,
      bookingId: 201,
      start: '2026-02-02T11:00:00.000Z',
      end: '2026-02-02T12:30:00.000Z',
      racks: [1, 2],
      areas: [],
      title: 'Team Alpha',
      color: null,
      isLocked: false,
      createdBy: null,
      status: 'confirmed',
    },
    {
      instanceId: 102,
      bookingId: 202,
      start: '2026-02-02T11:15:00.000Z',
      end: '2026-02-02T12:15:00.000Z',
      racks: [7],
      areas: [],
      title: 'Speed Work',
      color: null,
      isLocked: false,
      createdBy: null,
      status: 'confirmed',
    },
    {
      instanceId: 103,
      bookingId: 203,
      start: '2026-02-02T10:30:00.000Z',
      end: '2026-02-02T12:00:00.000Z',
      racks: [16, 17],
      areas: [],
      title: 'Power Session',
      color: null,
      isLocked: false,
      createdBy: null,
      status: 'confirmed',
    },
  ],
  nextUseByRack: {
    '3': { start: '2026-02-02T12:30:00.000Z', title: 'Team Beta' },
    '4': { start: '2026-02-02T12:15:00.000Z', title: 'Open Gym' },
    '8': { start: '2026-02-02T12:45:00.000Z', title: 'Recovery' },
    '18': { start: '2026-02-02T12:30:00.000Z', title: 'Strength' },
    '21': { start: '2026-02-02T12:00:00.000Z', title: 'Sprint Group' },
  },
  nextUseByArea: {},
};

export function KioskWayfindingStatic() {
  const [search] = useSearchParams();
  const sideKeyParam = search.get('side') as SideKey | null;
  const sideKey: SideKey =
    sideKeyParam === 'Base' || sideKeyParam === 'Power' ? sideKeyParam : 'Base';
  const [currentCycleIndex, setCurrentCycleIndex] = useState(0);

  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => {
      document.body.classList.remove('kiosk-mode');
    };
  }, []);

  const platformPages = useMemo(() => getPlatformPages(sideKey), [sideKey]);
  const totalCycles = platformPages.length;
  const quadrantLabel =
    sideKey === 'Base'
      ? (BASE_QUADRANT_LABELS[currentCycleIndex] ?? null)
      : null;

  useEffect(() => {
    if (totalCycles <= 1) return;
    const interval = setInterval(() => {
      setCurrentCycleIndex((prev) => (prev + 1) % totalCycles);
    }, CYCLE_DURATION_MS);
    return () => clearInterval(interval);
  }, [totalCycles]);

  const platformPageData = useMemo(
    () =>
      platformPages.map((page) => mapPlatformsForPage(STATIC_SNAPSHOT, page)),
    [platformPages]
  );

  const visiblePlatformIds = useMemo(() => {
    if (!platformPages.length) return EMPTY_PLATFORM_IDS;
    return platformPages[currentCycleIndex] ?? EMPTY_PLATFORM_IDS;
  }, [platformPages, currentCycleIndex]);

  return (
    <KioskLayout
      zoneA={
        <PeriodPanel
          periodType={'Performance' as PeriodType}
          periodStart={'2026-02-02T10:00:00.000Z'}
          periodEnd={'2026-02-02T13:00:00.000Z'}
          nextPeriodType={'General User' as PeriodType}
          nextPeriodStart={'2026-02-02T13:00:00.000Z'}
          isLoading={false}
        />
      }
      zoneB={
        <PlatformStatusBoard
          platformPages={platformPageData}
          currentCycleIndex={currentCycleIndex}
          totalCycles={totalCycles}
          rowsPerPage={PLATFORMS_PER_CYCLE}
          cycleLabel={quadrantLabel}
          isLoading={false}
        />
      }
      zoneC={
        <FloorplanMap
          sideKey={sideKey}
          snapshot={STATIC_SNAPSHOT}
          visiblePlatformIds={visiblePlatformIds}
          isLoading={false}
          error={null}
        />
      }
    />
  );
}

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
  snapshot: SideSnapshot | null,
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
    SideSnapshot['currentInstances'][number]
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
