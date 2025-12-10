import { useMemo } from "react";
import { motion } from "framer-motion";
import type { SideLayout } from "../../config/layout";
import type { SideSnapshot, ActiveInstance } from "../../types/snapshot";
import type { ProfileRole } from "../../types/auth";
import { groupContiguous } from "../../lib/groupContiguous";

type Props = {
  layout: SideLayout;
  snapshot: SideSnapshot | null;
  currentUserId: string | null;
  role: ProfileRole | null;
  canEditInstance: (inst: ActiveInstance) => boolean;
  onUpdateRacks: (instanceId: number, newRacks: number[]) => void;
};

type RackColumn = {
  number: number;
  index: number; // 0..N-1
};

export function EditableSideFloorplan({
  layout,
  snapshot,
  canEditInstance,
  onUpdateRacks,
}: Props) {
  const instances = snapshot?.currentInstances ?? [];
  const racks = layout.racks;

  const totalCols = racks.length;

  const rackColumns: RackColumn[] = useMemo(() => {
    const sorted = [...racks].sort((a, b) => a.number - b.number);
    return sorted.map((r, idx) => ({
      number: r.number,
      index: idx,
    }));
  }, [racks]);

  const numberToIndex = useMemo(() => {
    const map = new Map<number, number>();
    rackColumns.forEach((rc) => map.set(rc.number, rc.index));
    return map;
  }, [rackColumns]);

  function formatTime(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function computeBubblePosition(instance: ActiveInstance) {
    const validRackNumbers = instance.racks.filter((n) =>
      numberToIndex.has(n)
    );
    if (!validRackNumbers.length) return null;

    const groups = groupContiguous(validRackNumbers);
    const primaryGroup = groups[0]; // we expect contiguous anyway
    const indices = primaryGroup
      .map((n) => numberToIndex.get(n))
      .filter((idx): idx is number => idx !== undefined);

    if (!indices.length) return null;

    const startIndex = Math.min(...indices);
    const endIndex = Math.max(...indices);
    const colSpan = endIndex - startIndex + 1;

    const leftPercent = (startIndex / totalCols) * 100;
    const widthPercent = (colSpan / totalCols) * 100;

    return { leftPercent, widthPercent, startIndex, endIndex };
  }

  function handleEditRacks(instance: ActiveInstance) {
    const current = instance.racks.join(", ");
    const next = window.prompt("Enter rack numbers (comma-separated)", current);
    if (next === null) return;
    const parsed = next
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (!parsed.length) return;
    const deduped = Array.from(new Set(parsed)).sort((a, b) => a - b);
    onUpdateRacks(instance.instanceId, deduped);
  }

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      {/* Rack grid background */}
      <div className="absolute inset-0 flex">
        {rackColumns.map((rc) => (
          <div
            key={rc.index}
            className="flex-1 border-r border-slate-800/70 relative"
          >
            <div className="absolute top-1 left-1 text-[10px] text-slate-500">
              #{rc.number}
            </div>
          </div>
        ))}
      </div>

      {/* Bubbles layer */}
      <div className="absolute inset-0">
        {instances.map((inst) => {
          const pos = computeBubblePosition(inst);
          if (!pos) return null;

          const editable = canEditInstance(inst);

          return (
            <motion.div
              key={inst.instanceId}
              className={`absolute top-1/3 h-1/3 rounded-lg border text-[11px] flex flex-col justify-between px-2 py-1 cursor-grab active:cursor-grabbing ${editable
                ? "border-indigo-400/80 bg-indigo-500/40"
                : "border-slate-600/80 bg-slate-700/40"
                }`}
              style={{
                left: `${pos.leftPercent}%`,
                width: `${pos.widthPercent}%`,
              }}
              layout
            >
              <div className="flex items-center justify-between gap-1">
                <div className="truncate">
                  <span className="font-semibold text-slate-50 truncate">
                    {inst.title}
                  </span>
                </div>
                {inst.isLocked && (
                  <span className="text-[9px] px-1 rounded-full bg-slate-900/80 text-amber-300 border border-amber-400/60">
                    LOCKED
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px] text-slate-200 mt-0.5">
                <span>
                  Racks {inst.racks.join(", ")}
                </span>
                <span className="text-slate-300">
                  {formatTime(inst.start)}–{formatTime(inst.end)}
                </span>
              </div>
              {editable && (
                <div className="mt-1 flex items-center justify-end text-[10px]">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-600 text-[10px] text-slate-100 hover:bg-slate-800"
                    onClick={() => handleEditRacks(inst)}
                  >
                    ✎ Edit racks
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
