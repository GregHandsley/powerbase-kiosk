export type RackLayoutSlot = {
  number: number;
  x: number; // SVG units
  y: number;
  width: number;
  height: number;
};

export type SideLayout = {
  viewBox: string; // e.g. "0 0 100 20"
  racks: RackLayoutSlot[];
};

function makeLinearRacks(
  count: number,
  startX = 5,
  gap = 2,
  width = 6,
  y = 8,
  height = 6
) {
  const racks: RackLayoutSlot[] = [];
  for (let i = 0; i < count; i++) {
    racks.push({
      number: i + 1,
      x: startX + i * (width + gap),
      y,
      width,
      height,
    });
  }
  return racks;
}

export const POWER_LAYOUT: SideLayout = {
  viewBox: '0 0 100 24',
  racks: makeLinearRacks(10),
};

export const BASE_LAYOUT: SideLayout = {
  viewBox: '0 0 100 24',
  racks: makeLinearRacks(10, 5, 2, 6, 8, 6),
};
