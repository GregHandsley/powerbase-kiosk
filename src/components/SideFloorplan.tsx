import type { SideSnapshot, ActiveInstance } from "../types/snapshot";
import { FloorShell } from "./sidefloorplan/FloorShell";
import { RackSlot, type RackLayoutSlot } from "./sidefloorplan/RackSlot";

type Props = {
  snapshot: SideSnapshot | null;
  // layout prop accepted for compatibility; the current SVG is static.
  layout?: unknown;
};

// Static SVG floor layout for Powerbase with booking logic.
export function SideFloorplan({ snapshot }: Props) {
  // ---- basic layout numbers ----
  const viewBoxWidth = 160;
  const viewBoxHeight = 90;
  const floorMargin = 3;

  // RACK SIZE
  const rackWidth = 17; // change for wider/narrower racks
  const rackHeight = 11; // height
  const rackGapY = 2;

  // X positions for each rack column
  const col1X = 57; // column: 3,2,1,24,23,22
  const col2X = 76; // column: 4,5,6,19,20,21
  const col3X = 103; // column: 9,8,7,18,17,16
  const col4X = 122; // column: 10,11,12,13,14,15

  // ---- Y positions per column (move “quadrants” by changing these) ----
  // column 1
  const col1TopY = 5;
  const col1BottomY = 48;

  // column 2
  const col2TopY = 5;
  const col2BottomY = 48;

  // column 3
  const col3TopY = 5;
  const col3BottomY = 48;

  // column 4
  const col4TopY = 5;
  const col4BottomY = 48;

  // size of the top-left cut-out (white area)
  const cutoutWidth = 40;
  const cutoutHeight = 39;

  // helper to build a single vertical column of racks
  const buildColumn = (
    x: number,
    topY: number,
    bottomY: number,
    topNums: number[],
    bottomNums: number[]
  ): RackLayoutSlot[] => {
    const racks: RackLayoutSlot[] = [];

    topNums.forEach((num, i) => {
      racks.push({
        number: num,
        x,
        y: topY + i * (rackHeight + rackGapY),
        width: rackWidth,
        height: rackHeight,
      });
    });

    bottomNums.forEach((num, i) => {
      racks.push({
        number: num,
        x,
        y: bottomY + i * (rackHeight + rackGapY),
        width: rackWidth,
        height: rackHeight,
      });
    });

    return racks;
  };

  const racks: RackLayoutSlot[] = [
    ...buildColumn(col1X, col1TopY, col1BottomY, [3, 2, 1], [24, 23, 22]),
    ...buildColumn(col2X, col2TopY, col2BottomY, [4, 5, 6], [19, 20, 21]),
    ...buildColumn(col3X, col3TopY, col3BottomY, [9, 8, 7], [18, 17, 16]),
    ...buildColumn(col4X, col4TopY, col4BottomY, [10, 11, 12], [13, 14, 15]),
  ];

  // ---- snapshot-driven logic (from your template) ----
  const current = snapshot?.currentInstances ?? [];
  const nextUseByRack = snapshot?.nextUseByRack ?? {};
  const snapshotDate = snapshot?.at ? new Date(snapshot.at) : new Date();

  // Which racks are occupied right now + quick lookups
  const currentByRack = new Map<number, ActiveInstance>();
  for (const inst of current) {
    if (!inst.racks || inst.racks.length === 0) continue;

    for (const r of inst.racks) {
      currentByRack.set(r, inst);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      <FloorShell
        viewBoxWidth={viewBoxWidth}
        viewBoxHeight={viewBoxHeight}
        floorMargin={floorMargin}
        cutoutWidth={cutoutWidth}
        cutoutHeight={cutoutHeight}
      />

      {/* all racks (base rectangles) */}
      {racks.map((rack) => (
        <RackSlot
          key={rack.number}
          slot={rack}
          currentInst={currentByRack.get(rack.number) ?? null}
          nextUse={nextUseByRack[String(rack.number)] ?? null}
          snapshotDate={snapshotDate}
        />
      ))}
    </svg>
  );
}
