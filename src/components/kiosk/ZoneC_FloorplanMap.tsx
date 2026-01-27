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

function arePlatformIdsEqual(a: number[], b: number[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    if (arePlatformIdsEqual(lastVisibleRef.current, visiblePlatformIds)) {
      return;
    }

    setPreviousPlatformIds(lastVisibleRef.current);
    lastVisibleRef.current = visiblePlatformIds;
    setShowPrevious(true);

    const raf = window.requestAnimationFrame(() => {
      setShowPrevious(false);
    });
    return () => window.cancelAnimationFrame(raf);
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
    <div className="h-full w-full kiosk-floorplan relative">
      <div className="absolute inset-0">
        <FloorplanComponent
          snapshot={snapshot}
          appearance="status-board"
          highlightedRacks={highlightedRacks}
        />
      </div>
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: showPrevious ? 1 : 0 }}
      >
        <FloorplanComponent
          snapshot={snapshot}
          appearance="status-board"
          highlightedRacks={previousHighlightedRacks}
        />
      </div>
    </div>
  );
};

export const FloorplanMap = memo(FloorplanMapComponent);
