import type { ReactNode } from 'react';

type Props = {
  zoneA: ReactNode; // Period/Mode Context (top left)
  zoneB: ReactNode; // Platform Status Board (right side)
  zoneC: ReactNode; // Floorplan Map (bottom left)
};

/**
 * Three-zone kiosk layout for 55" landscape screens.
 *
 * Layout structure:
 * - Zone A (top left): Period/Mode Context (static)
 * - Zone B (right side): Platform Status (cycling, PRIMARY)
 * - Zone C (bottom left): Floorplan Map (static)
 */
export function KioskLayout({ zoneA, zoneB, zoneC }: Props) {
  return (
    <div className="h-screen w-screen overflow-hidden kiosk-shell">
      <div className="kiosk-frame">
        <div className="kiosk-frame-inner">
          <div className="h-full w-full min-h-0 min-w-0 grid grid-cols-[60%_40%] grid-rows-[30%_70%] kiosk-grid">
            {/* Zone A: Top Left - Period/Mode Context (Static) */}
            <div className="col-start-1 row-start-1 min-h-0 min-w-0 kiosk-zone">
              {zoneA}
            </div>

            {/* Zone B: Right Side - Platform Status Board (PRIMARY) */}
            <div className="col-start-2 row-start-1 row-span-2 min-h-0 min-w-0 kiosk-zone">
              {zoneB}
            </div>

            {/* Zone C: Bottom Left - Floorplan Map (Static) */}
            <div className="col-start-1 row-start-2 min-h-0 min-w-0 kiosk-zone kiosk-zone--quiet">
              {zoneC}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
