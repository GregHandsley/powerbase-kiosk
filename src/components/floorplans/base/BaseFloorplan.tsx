import { memo } from 'react';
import type { SideSnapshot, ActiveInstance } from '../../../types/snapshot';
import { FloorShell } from './FloorShell';
import { RackSlot, type RackLayoutSlot } from '../shared/RackSlot';
import type { RackAppearance } from '../shared/theme';

type Props = {
  snapshot: SideSnapshot | null;
  layout?: unknown;
  appearance?: RackAppearance;
  highlightedRacks?: Set<number>;
  renderShell?: boolean;
  renderRacks?: boolean;
  rackRenderMode?: 'full' | 'chrome' | 'content';
};

// Base floor SVG with booking-aware rack rendering.
const MemoFloorShell = memo(FloorShell);

export function BaseFloorplan({
  snapshot,
  appearance = 'default',
  highlightedRacks,
  renderShell = true,
  renderRacks = true,
  rackRenderMode = 'full',
}: Props) {
  const viewBoxWidth = 160;
  const viewBoxHeight = 90;
  const floorMargin = 3;

  const rackWidth = 17;
  const rackHeight = 11;
  const rackGapY = 2;

  // Hardcoded positions for the standard layout
  const col1X = viewBoxWidth - 57 - rackWidth; // 86
  const col2X = viewBoxWidth - 76 - rackWidth; // 67
  const col3X = viewBoxWidth - 103 - rackWidth; // 40
  const col4X = viewBoxWidth - 122 - rackWidth; // 21

  // Hardcoded Y positions (moved up)
  const baseTopY = 74;
  const baseBottomY = 30;

  const col1TopY = viewBoxHeight - baseTopY - rackHeight; // 5
  const col1BottomY = viewBoxHeight - baseBottomY - rackHeight; // 49
  const col2TopY = viewBoxHeight - baseTopY - rackHeight; // 5
  const col2BottomY = viewBoxHeight - baseBottomY - rackHeight; // 49
  const col3TopY = viewBoxHeight - baseTopY - rackHeight; // 5
  const col3BottomY = viewBoxHeight - baseBottomY - rackHeight; // 49
  const col4TopY = viewBoxHeight - baseTopY - rackHeight; // 5
  const col4BottomY = viewBoxHeight - baseBottomY - rackHeight; // 49

  const cutoutWidth = 40;
  const cutoutHeight = 39;

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

  // Standard layout - hardcoded platform positions
  const racks: RackLayoutSlot[] = [
    // Column 1 (leftmost): 22, 23, 24 (top) and 1, 2, 3 (bottom)
    ...buildColumn(col1X, col1TopY, col1BottomY, [22, 23, 24], [1, 2, 3]),
    // Column 2: 21, 20, 19 (top) and 6, 5, 4 (bottom)
    ...buildColumn(col2X, col2TopY, col2BottomY, [21, 20, 19], [6, 5, 4]),
    // Column 3: 16, 17, 18 (top) and 7, 8, 9 (bottom)
    ...buildColumn(col3X, col3TopY, col3BottomY, [16, 17, 18], [7, 8, 9]),
    // Column 4 (rightmost): 15, 14, 13 (top) and 12, 11, 10 (bottom)
    ...buildColumn(col4X, col4TopY, col4BottomY, [15, 14, 13], [12, 11, 10]),
  ];
  const current = snapshot?.currentInstances ?? [];
  const nextUseByRack = snapshot?.nextUseByRack ?? {};
  const snapshotDate =
    rackRenderMode === 'chrome'
      ? new Date(0)
      : snapshot?.at
        ? new Date(snapshot.at)
        : new Date();

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
      style={{
        shapeRendering: 'geometricPrecision',
        imageRendering: 'crisp-edges',
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    >
      {renderShell && (
        <MemoFloorShell
          viewBoxWidth={viewBoxWidth}
          viewBoxHeight={viewBoxHeight}
          floorMargin={floorMargin}
          cutoutWidth={cutoutWidth}
          cutoutHeight={cutoutHeight}
        />
      )}

      {renderRacks &&
        racks.map((rack) => {
          const isHighlighted = highlightedRacks?.has(rack.number) ?? false;
          const isDimmed =
            highlightedRacks && highlightedRacks.size > 0
              ? !isHighlighted
              : false;
          return (
            <RackSlot
              key={rack.number}
              slot={rack}
              currentInst={currentByRack.get(rack.number) ?? null}
              nextUse={nextUseByRack[String(rack.number)] ?? null}
              snapshotDate={snapshotDate}
              appearance={appearance}
              isHighlighted={isHighlighted}
              isDimmed={isDimmed}
              renderMode={rackRenderMode}
            />
          );
        })}
    </svg>
  );
}
