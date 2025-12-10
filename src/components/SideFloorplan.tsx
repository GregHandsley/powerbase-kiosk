import type { SideLayout, RackLayoutSlot } from "../config/layout";
import type { SideSnapshot, ActiveInstance } from "../types/snapshot";
import { groupContiguous } from "../lib/groupContiguous";

type Props = {
  layout: SideLayout;
  snapshot: SideSnapshot | null;
  onEditInstance?: (inst: ActiveInstance) => void;
  canEditInstance?: (inst: ActiveInstance) => boolean;
};

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SideFloorplan({
  layout,
  snapshot,
  onEditInstance,
  canEditInstance,
}: Props) {
  const racks = layout.racks;
  const current = snapshot?.currentInstances ?? [];
  const nextUseByRack = snapshot?.nextUseByRack ?? {};

  // Which racks are occupied right now
  const occupiedRacks = new Set<number>();
  for (const inst of current) {
    for (const r of inst.racks) {
      occupiedRacks.add(r);
    }
  }

  // Build mask rects for each current instance
  const maskRects: {
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    color: string | null;
    inst: ActiveInstance;
  }[] = [];

  for (const inst of current) {
    if (!inst.racks || inst.racks.length === 0) continue;

    const groups = groupContiguous(inst.racks);

    for (const group of groups) {
      const slots: RackLayoutSlot[] = racks.filter((r) =>
        group.includes(r.number)
      );
      if (slots.length === 0) continue;

      const left = Math.min(...slots.map((s) => s.x));
      const right = Math.max(...slots.map((s) => s.x + s.width));
      const y = slots[0].y;
      const height = slots[0].height;
      const width = right - left;

      maskRects.push({
        key: `${inst.instanceId}-${group[0]}-${group[group.length - 1]}`,
        x: left,
        y,
        width,
        height,
        title: inst.title,
        color: inst.color,
        inst,
      });
    }
  }

  return (
    <svg
      viewBox={layout.viewBox}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background */}
      <rect
        x={0}
        y={0}
        width="100%"
        height="100%"
        fill="#020617"
        rx={2}
      />

      {/* Base rack rectangles */}
      {racks.map((rack) => {
        const isOccupied = occupiedRacks.has(rack.number);
        return (
          <g key={rack.number}>
            <rect
              x={rack.x}
              y={rack.y}
              width={rack.width}
              height={rack.height}
              fill={isOccupied ? "#0f172a" : "#020617"}
              stroke="#1e293b"
              strokeWidth={0.4}
              rx={0.8}
            />
            {/* Free rack labels */}
            {!isOccupied && (
              <>
                <text
                  x={rack.x + rack.width / 2}
                  y={rack.y + rack.height / 2 - 0.6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={1.8}
                  fill="#cbd5f5"
                  fontFamily="system-ui, sans-serif"
                >
                  Open
                </text>
                {nextUseByRack[String(rack.number)] && (
                  <text
                    x={rack.x + rack.width / 2}
                    y={rack.y + rack.height / 2 + 1.4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={1.6}
                    fill="#94a3b8"
                    fontFamily="system-ui, sans-serif"
                  >
                    Next {formatTime(nextUseByRack[String(rack.number)])}
                  </text>
                )}
              </>
            )}
            {/* Rack number (small, top-left) */}
            <text
              x={rack.x + 0.5}
              y={rack.y + 1.7}
              fontSize={1.4}
              fill="#64748b"
              fontFamily="system-ui, sans-serif"
            >
              #{rack.number}
            </text>
          </g>
        );
      })}

      {/* Booking masks */}
      {maskRects.map((mask) => {
        const editable =
          Boolean(onEditInstance) &&
          (canEditInstance ? canEditInstance(mask.inst) : true);
        return (
          <g
            key={mask.key}
            onClick={() => {
              if (editable) onEditInstance?.(mask.inst);
            }}
            style={{ cursor: editable ? "pointer" : "default" }}
          >
            <rect
              x={mask.x + 0.3}
              y={mask.y + 0.3}
              width={mask.width - 0.6}
              height={mask.height - 0.6}
              fill={mask.color ?? "#22c55e"}
              fillOpacity={0.45}
              stroke={mask.color ?? "#4ade80"}
              strokeWidth={0.4}
              rx={1.4}
            />
            <text
              x={mask.x + mask.width / 2}
              y={mask.y + mask.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={2}
              fill="#e5e7eb"
              fontFamily="system-ui, sans-serif"
            >
              {mask.title}
            </text>
            {editable && (
              <text
                x={mask.x + mask.width - 1}
                y={mask.y + mask.height - 1}
                textAnchor="end"
                dominantBaseline="ideographic"
                fontSize={1.4}
                fill="#e5e7eb"
                fontFamily="system-ui, sans-serif"
              >
                ✎
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
