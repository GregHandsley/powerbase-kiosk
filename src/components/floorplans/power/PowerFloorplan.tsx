import type {
  SideSnapshot,
  ActiveInstance,
  NextUseInfo,
} from '../../../types/snapshot';
import { RackSlot, type RackLayoutSlot } from '../shared/RackSlot';
import '../../../styles/floorplan.css';

type Props = {
  snapshot?: SideSnapshot | null;
};

// Static SVG floor layout for Powerbase – L-shaped version with large racks.
export function PowerbaseFloorSvg({ snapshot }: Props) {
  const viewBoxWidth = 160;
  const viewBoxHeight = 90;
  const floorMargin = 3;

  const rackWidth = 19;
  const rackHeight = 8;
  const rackGapY = 2;

  const col1X = 52;
  const col2X = 73;
  const col3X = 98;
  const col4X = 123;

  const topRowY = 17;
  const baseRowY = (row: number) => topRowY + row * (rackHeight + rackGapY);
  const rowOffsets = [0, 0, 6, 6, 6];
  const rowY = (row: number) => baseRowY(row) + (rowOffsets[row] ?? 0);

  const col1Racks = [14, 15, 16, 17, 18];
  const col2Racks = [9, 10, 11, 12, 13];
  const col4Racks = [1, 2, 3, 4, 5];

  const cutoutWidth = 35;
  const cutoutHeight = 15;
  const cutoutRight = floorMargin + cutoutWidth;

  const snapshotDate = snapshot?.at ? new Date(snapshot.at) : new Date();
  const nextUseByRack: Record<string, NextUseInfo | null> =
    snapshot?.nextUseByRack ?? {};
  const currentByRack = new Map<number, ActiveInstance>();
  snapshot?.currentInstances?.forEach((inst) => {
    inst.racks?.forEach((r) => {
      currentByRack.set(r, inst);
    });
  });

  const renderRackSlot = (slot: RackLayoutSlot) => (
    <RackSlot
      key={`rack-${slot.number}`}
      slot={slot}
      currentInst={currentByRack.get(slot.number) ?? null}
      nextUse={nextUseByRack[String(slot.number)] ?? null}
      snapshotDate={snapshotDate}
    />
  );

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* outer background */}
      <rect
        className="fp-bg-outer"
        x={0}
        y={0}
        width={viewBoxWidth}
        height={viewBoxHeight}
      />

      {/* main floor background as an L-shape with top-left cut-out */}
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

      {/* ---------- RACK / PLATFORM GRID (BIG) ---------- */}

      {/* Column 1: RACK K14–18 */}
      {col1Racks.map((code, row) => {
        const x = col1X;
        const y = rowY(row);
        return renderRackSlot({
          number: code,
          x,
          y,
          width: rackWidth,
          height: rackHeight,
        });
      })}

      {/* Column 2: RACK K9–13 */}
      {col2Racks.map((code, row) => {
        const x = col2X;
        const y = rowY(row);
        return renderRackSlot({
          number: code,
          x,
          y,
          width: rackWidth,
          height: rackHeight,
        });
      })}

      {/* Column 3: PLATFORM 1–2 + RACK K6–8 */}
      {Array.from({ length: 5 }).map((_, row) => {
        const x = col3X;
        const y = rowY(row);

        if (row === 0 || row === 1) {
          const platformNo = row + 1;
          return (
            <g key={`platform-${platformNo}`}>
              <rect
                x={x}
                y={y}
                width={rackWidth}
                height={rackHeight}
                fill="#7c3aed"
                stroke="#6b21a8"
                strokeWidth={0.8}
              />
              <text
                x={x + rackWidth / 2}
                y={y + rackHeight / 2 - 1.7}
                textAnchor="middle"
                fontSize={2.4}
                fill="#ffffff"
                fontFamily="system-ui, sans-serif"
              >
                PLATFORM
              </text>
              <text
                x={x + rackWidth / 2}
                y={y + rackHeight / 2 + 2.4}
                textAnchor="middle"
                fontSize={2.8}
                fill="#ffffff"
                fontFamily="system-ui, sans-serif"
              >
                {platformNo}
              </text>
            </g>
          );
        }

        const rackIndex = row - 2;
        const code = 6 + rackIndex;

        return renderRackSlot({
          number: code,
          x,
          y,
          width: rackWidth,
          height: rackHeight,
        });
      })}

      {/* Column 4: RACK K1–5 */}
      {col4Racks.map((code, row) => {
        const x = col4X;
        const y = rowY(row);
        return renderRackSlot({
          number: code,
          x,
          y,
          width: rackWidth,
          height: rackHeight,
        });
      })}
    </svg>
  );
}
