import type { SideSnapshot, ActiveInstance, NextUseInfo } from "../../../types/snapshot";
import { RackSlot, type RackLayoutSlot } from "../shared/RackSlot";

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
  const nextUseByRack: Record<string, NextUseInfo | null> = snapshot?.nextUseByRack ?? {};
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
      <rect x={0} y={0} width={viewBoxWidth} height={viewBoxHeight} fill="#ffffff" />

      {/* main floor background as an L-shape with top-left cut-out */}
      <path
        d={`
          M ${cutoutRight} ${floorMargin}
          H ${viewBoxWidth - floorMargin}
          V ${viewBoxHeight - floorMargin}
          H ${floorMargin}
          V ${floorMargin + cutoutHeight}
          H ${cutoutRight}
          Z
        `}
        fill="#d4d4d4"
        stroke="#9ca3af"
        strokeWidth={0.8}
      />

      {/* LEFT: Dumbbell Area */}
      <rect
        x={floorMargin + 2}
        y={floorMargin + 17}
        width={15}
        height={42}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 16.5}
        y={floorMargin + 35}
        textAnchor="middle"
        fontSize={2}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={floorMargin + 10} dy={0}>
          Dumbbell
        </tspan>
        <tspan x={floorMargin + 10} dy={4}>
          Area
        </tspan>
      </text>

      {/* LEFT: Cables */}
      <rect
        x={floorMargin + 2}
        y={viewBoxHeight - floorMargin - 22}
        width={15}
        height={20}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 10}
        y={floorMargin + 73}
        textAnchor="middle"
        fontSize={2}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        Cables
      </text>

      {/* L-SHAPE BLACK ZONE (walls / voids) */}
      <rect x={floorMargin + 18.5} y={floorMargin + 15.4} width={4} height={68.2} fill="#000000" />
      <rect x={floorMargin + 20} y={floorMargin + 15.4} width={27.5} height={20} fill="#000000" />
      <rect
        x={floorMargin + 20}
        y={topRowY + 19.5}
        width={viewBoxWidth - floorMargin - 35}
        height={5}
        fill="#000000"
      />

      {/* two vertical black posts between grid columns */}
      <rect
        x={col2X + rackWidth + 1}
        y={topRowY - 10}
        width={4}
        height={viewBoxHeight - topRowY - 5}
        fill="#000000"
      />
      <rect
        x={col3X + rackWidth + 1}
        y={topRowY - 10}
        width={4}
        height={viewBoxHeight - topRowY - 5}
        fill="#000000"
      />

      {/* MID-LEFT: Fixed Resistance Machines */}
      <rect
        x={floorMargin + 24}
        y={floorMargin + 40}
        width={23}
        height={42}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 53}
        y={floorMargin + 56}
        textAnchor="middle"
        fontSize={2}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={floorMargin + 35.5} dy={0}>
          Fixed
        </tspan>
        <tspan x={floorMargin + 35.5} dy={4}>
          Resistance
        </tspan>
        <tspan x={floorMargin + 35.5} dy={4}>
          Machines
        </tspan>
      </text>

      {/* TOP BAND: Weight Lifting Area */}
      <rect
        x={floorMargin + 47.5}
        y={floorMargin + 2}
        width={viewBoxWidth - floorMargin - 65}
        height={10}
        rx={4}
        ry={4}
        fill="#e5e5e5"
        stroke="#4b5563"
        strokeWidth={0.6}
      />
      <text
        x={100.5}
        y={floorMargin + 8}
        textAnchor="middle"
        fontSize={2}
        fill="#111827"
        fontFamily="system-ui, sans-serif"
      >
        Weight Lifting Area
      </text>

      {/* BOTTOM BAND: Functional Area */}
      <rect
        x={floorMargin + 48.5}
        y={viewBoxHeight - floorMargin - 14}
        width={viewBoxWidth - floorMargin - 66}
        height={12}
        rx={4}
        ry={4}
        fill="#e5e5e5"
        stroke="#4b5563"
        strokeWidth={0.6}
      />
      <text
        x={floorMargin + 45 + (viewBoxWidth - floorMargin - 40 - 17) / 2}
        y={viewBoxHeight - floorMargin - 7}
        textAnchor="middle"
        fontSize={2}
        fill="#111827"
        fontFamily="system-ui, sans-serif"
      >
        Functional Area
      </text>

      {/* RIGHT: Track */}
      <rect
        x={viewBoxWidth - floorMargin - 13}
        y={floorMargin + 2}
        width={11}
        height={viewBoxHeight - floorMargin * 2 - 4}
        fill="#f97316"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={viewBoxWidth - floorMargin - 9}
        y={viewBoxHeight / 2 + 2.5}
        textAnchor="middle"
        fontSize={3}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
        transform={`rotate(-90 ${viewBoxWidth - floorMargin - 9} ${viewBoxHeight / 2})`}
      >
        Track
      </text>

      {/* YELLOW STAIRS – top centre */}
      <rect x={floorMargin + 40} y={floorMargin + 0.5} width={5} height={12} fill="#facc15" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={`step-${i}`}
          x={floorMargin + 40.3}
          y={floorMargin + 0.5 + i * 1.5}
          width={4.4}
          height={0.7}
          fill="#fde68a"
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

