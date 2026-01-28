import { memo } from 'react';
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

const FloorplanMapComponent = function FloorplanMap({
  sideKey,
  snapshot,
  visiblePlatformIds,
  isLoading = false,
  error = null,
}: Props) {
  const FloorplanComponent =
    sideKey === 'Base' ? BaseFloorplan : PowerbaseFloorSvg;

  const highlightedRacks = new Set(visiblePlatformIds);

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
    </div>
  );
};

export const FloorplanMap = memo(FloorplanMapComponent);
