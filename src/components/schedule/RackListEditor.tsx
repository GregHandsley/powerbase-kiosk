import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ActiveInstance, SideSnapshot } from "../../types/snapshot";
import { supabase } from "../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";

type RackRow = {
  id: string; // rack-<number> or platform-<number>
  label: string;
  rackNumber: number | null; // null for non-bookable
  disabled?: boolean;
};

type Props = {
  side: "power" | "base";
  snapshot: SideSnapshot | null;
};

function RackRowDroppable({
  row,
  booking,
  bookingContent,
}: {
  row: RackRow;
  booking: ActiveInstance | null;
  bookingContent: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: row.id,
    data: { rackNumber: row.rackNumber },
    disabled: row.disabled || row.rackNumber === null,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm transition ${
        row.disabled
          ? "bg-slate-850 border-slate-800 text-slate-600"
          : isOver
            ? "bg-slate-850 border-indigo-500/70 text-slate-100"
            : "bg-slate-900/80 border-slate-800 text-slate-100"
      }`}
    >
      <div className="flex flex-col min-w-[110px]">
        <span className="font-semibold tracking-wide">{row.label}</span>
        <span className="text-[11px] text-slate-400">
          {row.disabled ? "Not bookable" : booking ? "Assigned" : "Available"}
        </span>
      </div>
      <div className="flex-1 min-w-0 text-xs text-slate-200 flex justify-start">
        {bookingContent}
      </div>
    </div>
  );
}

function DraggableBooking({
  booking,
  fromRack,
}: {
  booking: ActiveInstance;
  fromRack: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: `booking-${booking.instanceId}-${fromRack}`,
    data: { bookingId: booking.instanceId, fromRack },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    cursor: "grab",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-100 bg-slate-800/60 border border-slate-700"
    >
      <div className="font-semibold truncate max-w-[240px]">{booking.title}</div>
      <div className="text-[11px] text-slate-300 whitespace-nowrap">
        {booking.start.slice(11, 16)}–{booking.end.slice(11, 16)}
      </div>
    </div>
  );
}

export function RackListEditor({ side, snapshot }: Props) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const bookings = snapshot?.currentInstances ?? [];

  const racks = useMemo<RackRow[]>(() => {
    if (!snapshot) return [];

    // determine rack numbers by side
    const rackNumbers = side === "base" ? Array.from({ length: 24 }, (_, i) => i + 1) : Array.from({ length: 18 }, (_, i) => i + 1);
    // mark non-bookable for power platforms 1/2
    const nonBookable = side === "power" ? new Set([1, 2]) : new Set<number>();

    const rows: RackRow[] = [];
    for (const r of rackNumbers) {
      const booking = bookings.find((b) => b.racks?.includes(r));
      rows.push({
        id: `rack-${r}`,
        label: nonBookable.has(r) ? `Platform ${r}` : `Rack ${r}`,
        rackNumber: nonBookable.has(r) ? null : r,
        disabled: nonBookable.has(r),
      });
    }
    return rows;
  }, [bookings, side, snapshot]);

  const bookingById = useMemo(() => {
    const map = new Map<number, ActiveInstance>();
    bookings.forEach((b) => map.set(b.instanceId, b));
    return map;
  }, [bookings]);

  const initialAssignments = useMemo(() => {
    const map = new Map<number, number[]>(); // bookingId -> racks[]
    bookings.forEach((b) => {
      const nums = (b.racks ?? []).filter((r): r is number => typeof r === "number");
      if (nums.length) {
        map.set(b.instanceId, nums);
      }
    });
    return map;
  }, [bookings]);

  const [assignments, setAssignments] = useState<Map<number, number[]>>(initialAssignments);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const mapsEqual = (a: Map<number, number[]>, b: Map<number, number[]>) => {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      const other = b.get(k);
      if (!other || other.length !== v.length) return false;
      for (let i = 0; i < v.length; i++) {
        if (v[i] !== other[i]) return false;
      }
    }
    return true;
  };

  // Refresh assignments when snapshot/bookings change, but avoid loops
  useEffect(() => {
    if (!mapsEqual(assignments, initialAssignments)) {
      setAssignments(new Map(initialAssignments));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAssignments]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const bookingId = active.data.current?.bookingId as number | undefined;
    const fromRack = active.data.current?.fromRack as number | undefined;
    if (!bookingId) return;
    if (!fromRack) return;
    const overRackNumber = over.data?.current?.rackNumber as number | null | undefined;
    if (!overRackNumber) return; // only drop on bookable racks

    setAssignments((prev) => {
      const original = prev.get(bookingId) ?? initialAssignments.get(bookingId) ?? [];
      const replaced = original.map((r) => (r === fromRack ? overRackNumber : r));
      const newRacks = Array.from(new Set(replaced.length ? replaced : [overRackNumber]));
      const next = new Map(prev);
      next.set(bookingId, newRacks);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build updates per bookingId -> racks [rackNumber]
      const updates: { instanceId: number; racks: number[] }[] = [];
      assignments.forEach((rackNumbers, bookingId) => {
        if (!rackNumbers || rackNumbers.length === 0) return;
        updates.push({ instanceId: bookingId, racks: rackNumbers });
      });

      if (updates.length === 0) return;

      const results = await Promise.all(
        updates.map((u) =>
          supabase.from("booking_instances").update({ racks: u.racks }).eq("id", u.instanceId)
        )
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        console.error("save updates error", firstError.message);
        alert(`Save failed: ${firstError.message}`);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Rack assignments</h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
      {savedAt && !saving && (
        <div className="text-[11px] text-emerald-400">
          Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 max-h-[440px] overflow-auto">
        {racks.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">No data for this snapshot.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="space-y-2">
              {racks.map((row) => {
                const bookingEntry =
                  row.rackNumber !== null
                    ? [...assignments.entries()].find(([, rackNos]) => rackNos.includes(row.rackNumber!))
                    : null;
                const bookingId = bookingEntry?.[0] ?? null;
                const bookingRacks = bookingEntry?.[1] ?? null;
                const booking = bookingId ? bookingById.get(bookingId) ?? null : null;

                const content = booking ? (
                  <DraggableBooking booking={booking} fromRack={row.rackNumber!} />
                ) : row.disabled ? (
                  <span className="text-slate-600">Not bookable</span>
                ) : (
                  <span className="text-slate-500">Drop booking here</span>
                );

                return (
                  <RackRowDroppable
                    key={row.id}
                    row={row}
                    booking={booking ?? null}
                    bookingContent={content}
                  />
                );
              })}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}

