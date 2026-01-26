import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KioskLayout } from '../components/kiosk/KioskLayout';
import { PeriodPanel } from '../components/kiosk/ZoneA_PeriodContext';
import { PlatformStatusBoard } from '../components/kiosk/ZoneB_PlatformStatus';
import { FloorplanMap } from '../components/kiosk/ZoneC_FloorplanMap';
import { useSideSnapshot } from '../hooks/useSideSnapshot';
import { useInstancesRealtime } from '../hooks/useInstancesRealtime';
import type { SideKey } from '../nodes/data/sidesNodes';

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

const PLATFORMS_PER_CYCLE = 4;
const CYCLE_DURATION_MS = 6000; // 6 seconds per cycle
const FADE_DURATION_MS = 300;

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

  // Placeholder period data - will be replaced with real data fetching
  const [currentPeriod, setCurrentPeriod] = useState<{
    type: PeriodType;
    start: string;
    end: string;
  } | null>(null);
  const [nextPeriod, setNextPeriod] = useState<{
    type: PeriodType;
    start: string;
  } | null>(null);

  // Transform snapshot data into platform bookings
  const allPlatforms = transformSnapshotToPlatforms(snapshot);

  // Cycling logic for Zone B
  const [currentCycleIndex, setCurrentCycleIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const totalCycles = Math.ceil(allPlatforms.length / PLATFORMS_PER_CYCLE);
  const visiblePlatforms = allPlatforms.slice(
    currentCycleIndex * PLATFORMS_PER_CYCLE,
    (currentCycleIndex + 1) * PLATFORMS_PER_CYCLE
  );

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

  // TODO: Fetch real period data
  useEffect(() => {
    // Placeholder: set mock period data
    const now = new Date();
    setCurrentPeriod({
      type: 'Performance',
      start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
      end: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30 min from now
    });
    setNextPeriod({
      type: 'General User',
      start: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    });
  }, []);

  return (
    <KioskLayout
      zoneA={
        <PeriodPanel
          periodType={currentPeriod?.type ?? null}
          periodStart={currentPeriod?.start ?? null}
          periodEnd={currentPeriod?.end ?? null}
          nextPeriodType={nextPeriod?.type ?? null}
          nextPeriodStart={nextPeriod?.start ?? null}
          isLoading={isLoading}
        />
      }
      zoneB={
        <PlatformStatusBoard
          platforms={visiblePlatforms}
          currentCycleIndex={currentCycleIndex}
          totalCycles={totalCycles}
          rotationSeconds={Math.round(CYCLE_DURATION_MS / 1000)}
          nowTimeIso={snapshot?.at ?? new Date().toISOString()}
          isFading={isFading}
          isLoading={isLoading}
        />
      }
      zoneC={
        <FloorplanMap
          sideKey={sideKey}
          snapshot={snapshot}
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
function transformSnapshotToPlatforms(
  snapshot: ReturnType<typeof useSideSnapshot>['snapshot']
): PlatformBooking[] {
  if (!snapshot) {
    return [];
  }

  // Extract all unique platform numbers from current instances
  const platformNumbers = new Set<number>();

  snapshot.currentInstances.forEach((inst) => {
    inst.racks.forEach((rack) => platformNumbers.add(rack));
  });

  // Also get platforms from next bookings
  Object.keys(snapshot.nextUseByRack).forEach((rackStr) => {
    const rackNum = parseInt(rackStr, 10);
    if (!isNaN(rackNum)) {
      platformNumbers.add(rackNum);
    }
  });

  // Build platform bookings
  const platforms: PlatformBooking[] = Array.from(platformNumbers)
    .sort((a, b) => a - b)
    .map((platformNum) => {
      // Find current booking for this platform
      const currentInst = snapshot.currentInstances.find((inst) =>
        inst.racks.includes(platformNum)
      );

      // Find next booking for this platform
      const nextUse = snapshot.nextUseByRack[platformNum.toString()] ?? null;

      return {
        platformNumber: platformNum,
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

  return platforms;
}
