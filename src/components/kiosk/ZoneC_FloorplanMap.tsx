import type { SideSnapshot } from '../../types/snapshot';
import { BaseFloorplan } from '../floorplans/base/BaseFloorplan';
import { PowerbaseFloorSvg } from '../floorplans/power/PowerFloorplan';
import type { SideKey } from '../../nodes/data/sidesNodes';

type Props = {
  sideKey: SideKey;
  snapshot: SideSnapshot | null;
  isLoading?: boolean;
  error?: string | null;
};

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
export function FloorplanMap({
  sideKey,
  snapshot,
  isLoading = false,
  error = null,
}: Props) {
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

  // Render appropriate floorplan based on side
  const FloorplanComponent =
    sideKey === 'Base' ? BaseFloorplan : PowerbaseFloorSvg;

  return (
    <div className="h-full w-full">
      <div className="h-full w-full kiosk-floorplan">
        <FloorplanComponent snapshot={snapshot} appearance="status-board" />
      </div>
    </div>
  );
}
