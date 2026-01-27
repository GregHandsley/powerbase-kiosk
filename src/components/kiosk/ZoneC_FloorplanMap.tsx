import { memo, useEffect, useRef, useState } from 'react';
import type { SideSnapshot } from '../../types/snapshot';
import { BaseFloorplan } from '../floorplans/base/BaseFloorplan';
import { PowerbaseFloorSvg } from '../floorplans/power/PowerFloorplan';
import type { SideKey } from '../../nodes/data/sidesNodes';

type Props = {
  sideKey: SideKey;
  snapshot: SideSnapshot | null;
  visiblePlatformIds: number[];
  isLoading?: boolean;
  error?: string | null;
};

const HIGHLIGHT_FADE_MS = 300;

function arePlatformIdsEqual(a: number[], b: number[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Zone C: Floorplan Map (Static)
 *
 * Purpose: Spatial confirmation only - helps users locate a platform AFTER they identify it
 *
 * Rules:
 * - Static (never cycles)
 * - Quiet, low contrast
 * - Never competes with Zone B
 *
 * Map must show:
 * - Simplified gym layout
 * - Clearly labelled platform numbers
 * - Optional occupancy indication (Occupied vs Available)
 *
 * If a platform is available, it MAY show:
 * - "Available · until HH:MM"
 *
 * Restrictions:
 * - Do NOT show NEXT bookings on the map
 * - Do NOT show NOW/NEXT labels on the map
 * - Do NOT show times other than "available until"
 * - Do NOT include any decision-critical information
 */
const FloorplanMapComponent = function FloorplanMap({
  sideKey,
  snapshot,
  visiblePlatformIds,
  isLoading = false,
  error = null,
}: Props) {
  const FloorplanComponent =
    sideKey === 'Base' ? BaseFloorplan : PowerbaseFloorSvg;
  const lastVisibleRef = useRef(visiblePlatformIds);
  const [previousPlatformIds, setPreviousPlatformIds] =
    useState(visiblePlatformIds);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (arePlatformIdsEqual(lastVisibleRef.current, visiblePlatformIds)) {
      return;
    }

    setPreviousPlatformIds(lastVisibleRef.current);
    lastVisibleRef.current = visiblePlatformIds;
    setIsTransitioning(true);

    const timeout = window.setTimeout(
      () => setIsTransitioning(false),
      HIGHLIGHT_FADE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [visiblePlatformIds]);

  const highlightedRacks = new Set(visiblePlatformIds);
  const previousHighlightedRacks = new Set(previousPlatformIds);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="text-sm text-red-400">
          Error loading floorplan: {error}
        </div>
      </div>
    );
  }

  if (isLoading || !snapshot) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="text-sm text-slate-400">Loading floorplan...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="h-full w-full kiosk-floorplan relative">
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: isTransitioning ? 0 : 1 }}
        >
          <FloorplanComponent
            snapshot={snapshot}
            appearance="status-board"
            highlightedRacks={highlightedRacks}
          />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: isTransitioning ? 1 : 0 }}
        >
          <FloorplanComponent
            snapshot={snapshot}
            appearance="status-board"
            highlightedRacks={previousHighlightedRacks}
          />
        </div>
      </div>
    </div>
  );
};

export const FloorplanMap = memo(FloorplanMapComponent);
