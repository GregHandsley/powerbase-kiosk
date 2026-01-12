import type { SideSnapshot, ActiveInstance } from '../../../types/snapshot';
// import { BaseFloorplan } from '../base/BaseFloorplan';
// import { PowerbaseFloorSvg } from '../power/PowerFloorplan';
import { EditableRackSlot, type RackLayoutSlot } from './EditableRackSlot';
import { FloorShell } from '../base/FloorShell';
import '../../../styles/floorplan.css';

type Props = {
  snapshot: SideSnapshot | null;
  /** Selected rack numbers */
  selectedRacks: number[];
  /** Callback when a rack is clicked */
  onRackClick: (rackNumber: number) => void;
  /** Which side this floorplan is for */
  side: 'power' | 'base';
  /** ID of the booking being edited (for highlighting its racks) */
  editingBookingId?: number | null;
};

/**
 * Interactive floorplan that allows clicking on racks to select/deselect them.
 * Shows selected racks with a visual indicator.
 */
export function EditableFloorplan({
  snapshot,
  selectedRacks,
  onRackClick,
  side,
  editingBookingId,
}: Props) {
  const selectedSet = new Set(selectedRacks);
  const viewBoxWidth = 160;
  const viewBoxHeight = 90;
  const floorMargin = 3;

  // Build rack layouts based on side
  const racks: RackLayoutSlot[] = [];

  if (side === 'base') {
    const rackWidth = 17;
    const rackHeight = 11;
    const rackGapY = 2;
    const col1X = 57;
    const col2X = 76;
    const col3X = 103;
    const col4X = 122;
    const col1TopY = 5;
    const col1BottomY = 48;
    const col2TopY = 5;
    const col2BottomY = 48;
    const col3TopY = 5;
    const col3BottomY = 48;
    const col4TopY = 5;
    const col4BottomY = 48;

    const buildColumn = (
      x: number,
      topY: number,
      bottomY: number,
      topNums: number[],
      bottomNums: number[]
    ): RackLayoutSlot[] => {
      const result: RackLayoutSlot[] = [];
      topNums.forEach((num, i) => {
        result.push({
          number: num,
          x,
          y: topY + i * (rackHeight + rackGapY),
          width: rackWidth,
          height: rackHeight,
        });
      });
      bottomNums.forEach((num, i) => {
        result.push({
          number: num,
          x,
          y: bottomY + i * (rackHeight + rackGapY),
          width: rackWidth,
          height: rackHeight,
        });
      });
      return result;
    };

    racks.push(
      ...buildColumn(col1X, col1TopY, col1BottomY, [3, 2, 1], [24, 23, 22]),
      ...buildColumn(col2X, col2TopY, col2BottomY, [4, 5, 6], [19, 20, 21]),
      ...buildColumn(col3X, col3TopY, col3BottomY, [9, 8, 7], [18, 17, 16]),
      ...buildColumn(col4X, col4TopY, col4BottomY, [10, 11, 12], [13, 14, 15])
    );
  } else {
    // Power side
    const rackWidth = 19;
    const rackHeight = 8;
    const rackGapY = 2;
    const col1X = 52;
    const col2X = 73;
    const col3X = 98;
    const col4X = 123;
    const topRowY = 17;
    const rowOffsets = [0, 0, 6, 6, 6];
    const rowY = (row: number) =>
      topRowY + row * (rackHeight + rackGapY) + (rowOffsets[row] ?? 0);

    const col1Racks = [14, 15, 16, 17, 18];
    const col2Racks = [9, 10, 11, 12, 13];
    const col4Racks = [1, 2, 3, 4, 5];

    // Column 1
    col1Racks.forEach((code, row) => {
      racks.push({
        number: code,
        x: col1X,
        y: rowY(row),
        width: rackWidth,
        height: rackHeight,
      });
    });

    // Column 2
    col2Racks.forEach((code, row) => {
      racks.push({
        number: code,
        x: col2X,
        y: rowY(row),
        width: rackWidth,
        height: rackHeight,
      });
    });

    // Column 3: racks 6-8 (platforms 1-2 are not bookable)
    [6, 7, 8].forEach((code, row) => {
      racks.push({
        number: code,
        x: col3X,
        y: rowY(row + 2),
        width: rackWidth,
        height: rackHeight,
      });
    });

    // Column 4
    col4Racks.forEach((code, row) => {
      racks.push({
        number: code,
        x: col4X,
        y: rowY(row),
        width: rackWidth,
        height: rackHeight,
      });
    });
  }

  const current = snapshot?.currentInstances ?? [];
  const nextUseByRack = snapshot?.nextUseByRack ?? {};
  const snapshotDate = snapshot?.at ? new Date(snapshot.at) : new Date();

  const currentByRack = new Map<number, ActiveInstance>();
  for (const inst of current) {
    if (!inst.racks || inst.racks.length === 0) continue;
    for (const r of inst.racks) {
      currentByRack.set(r, inst);
    }
  }

  const cutoutWidth = side === 'base' ? 40 : 35;
  const cutoutHeight = side === 'base' ? 39 : 15;
  const cutoutRight = floorMargin + cutoutWidth;

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {side === 'base' ? (
        <>
          <FloorShell
            viewBoxWidth={viewBoxWidth}
            viewBoxHeight={viewBoxHeight}
            floorMargin={floorMargin}
            cutoutWidth={cutoutWidth}
            cutoutHeight={cutoutHeight}
          />
          {racks.map((rack) => {
            const rackInst = currentByRack.get(rack.number) ?? null;
            const isUsedByOtherBooking =
              rackInst && rackInst.instanceId !== editingBookingId;
            const isClickable = !isUsedByOtherBooking;
            const isSelected = selectedSet.has(rack.number);

            return (
              <EditableRackSlot
                key={rack.number}
                slot={rack}
                currentInst={rackInst}
                nextUse={nextUseByRack[String(rack.number)] ?? null}
                snapshotDate={snapshotDate}
                isSelected={isSelected}
                isDisabled={isUsedByOtherBooking}
                isClickable={isClickable}
                onClick={onRackClick}
              />
            );
          })}
        </>
      ) : (
        <>
          {/* Power side floorplan background */}
          <rect
            className="fp-bg-outer"
            x={0}
            y={0}
            width={viewBoxWidth}
            height={viewBoxHeight}
          />
          <path
            className="fp-bg-path"
            d={`
              M ${cutoutRight} ${floorMargin}
              H ${viewBoxWidth - floorMargin}
              V ${viewBoxHeight - floorMargin}
              H ${floorMargin}
              V ${floorMargin + cutoutHeight}
              H ${cutoutRight}
              Z
            `}
          />
          {/* LEFT: Dumbbell Area */}
          <g transform={`translate(${floorMargin + 2} ${floorMargin + 17})`}>
            <rect className="fp-area" width={15} height={42} />
            <text
              className="fp-area-label"
              x={7.5}
              y={42 / 2}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              DUMBBELL
              <tspan x={7.5} dy={3.8}>
                AREA
              </tspan>
            </text>
          </g>
          {/* LEFT: Cables */}
          <g
            transform={`translate(${floorMargin + 2} ${viewBoxHeight - floorMargin - 22})`}
          >
            <rect className="fp-area" width={15} height={20} />
            <text
              className="fp-area-label"
              x={7.5}
              y={20 / 2}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              CABLES
            </text>
          </g>
          {/* MID-LEFT: Fixed Resistance Machines */}
          <g transform={`translate(${floorMargin + 24} ${floorMargin + 40})`}>
            <rect className="fp-area" width={23} height={42} />
            <text
              className="fp-area-label"
              x={23 / 2}
              y={42 / 2 - 2}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              FIXED
            </text>
            <text
              className="fp-area-label"
              x={23 / 2}
              y={42 / 2 + 3}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              MACHINES
            </text>
          </g>
          {/* TOP BAND: Weight Lifting Area */}
          <rect
            className="fp-banner"
            x={floorMargin + 47.5}
            y={floorMargin + 2}
            width={viewBoxWidth - floorMargin - 65}
            height={10}
            rx={4}
            ry={4}
          />
          <text
            className="fp-banner-text"
            x={100.5}
            y={floorMargin + 8}
            textAnchor="middle"
            fontSize={2}
          >
            Weight Lifting Area
          </text>
          {/* BOTTOM BAND: Functional Area */}
          <rect
            className="fp-banner"
            x={floorMargin + 48.5}
            y={viewBoxHeight - floorMargin - 14}
            width={viewBoxWidth - floorMargin - 66}
            height={12}
            rx={4}
            ry={4}
          />
          <text
            className="fp-banner-text"
            x={floorMargin + 45 + (viewBoxWidth - floorMargin - 40 - 17) / 2}
            y={viewBoxHeight - floorMargin - 7}
            textAnchor="middle"
            fontSize={2}
          >
            Functional Area
          </text>
          {/* RIGHT: Track */}
          <rect
            className="fp-track"
            x={viewBoxWidth - floorMargin - 13}
            y={floorMargin + 2}
            width={11}
            height={viewBoxHeight - floorMargin * 2 - 4}
          />
          <text
            className="fp-track-text"
            x={viewBoxWidth - floorMargin - 9}
            y={viewBoxHeight / 2 + 2.5}
            textAnchor="middle"
            fontSize={3}
            transform={`rotate(-90 ${viewBoxWidth - floorMargin - 9} ${viewBoxHeight / 2})`}
          >
            Track
          </text>
          {/* YELLOW STAIRS – top centre */}
          <rect
            className="fp-stairs-main"
            x={floorMargin + 40}
            y={floorMargin + 0.5}
            width={5}
            height={12}
          />
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={`step-${i}`}
              className="fp-stairs-step"
              x={floorMargin + 40.3}
              y={floorMargin + 0.5 + i * 1.5}
              width={4.4}
              height={0.7}
            />
          ))}
          {/* Render editable racks */}
          {racks.map((rack) => {
            const rackInst = currentByRack.get(rack.number) ?? null;
            const isUsedByOtherBooking =
              rackInst && rackInst.instanceId !== editingBookingId;
            const isClickable = !isUsedByOtherBooking;
            const isSelected = selectedSet.has(rack.number);

            return (
              <EditableRackSlot
                key={rack.number}
                slot={rack}
                currentInst={rackInst}
                nextUse={nextUseByRack[String(rack.number)] ?? null}
                snapshotDate={snapshotDate}
                isSelected={isSelected}
                isDisabled={isUsedByOtherBooking}
                isClickable={isClickable}
                onClick={onRackClick}
              />
            );
          })}
        </>
      )}
    </svg>
  );
}
