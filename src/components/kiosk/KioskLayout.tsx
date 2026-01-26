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
    <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      <div className="h-full w-full grid grid-cols-[40%_60%] grid-rows-[auto_1fr]">
        {/* Zone A: Top Left - Period/Mode Context (Static) */}
        <div className="col-start-1 row-start-1 p-6">{zoneA}</div>

        {/* Zone B: Right Side - Platform Status Board (PRIMARY) */}
        <div className="col-start-2 row-start-1 row-span-2 p-6">{zoneB}</div>

        {/* Zone C: Bottom Left - Floorplan Map (Static) */}
        <div className="col-start-1 row-start-2 p-6">{zoneC}</div>
      </div>
    </div>
  );
}
