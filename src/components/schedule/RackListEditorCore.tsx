import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ActiveInstance, SideSnapshot } from "../../types/snapshot";
import { DraggableBooking } from "./DraggableBooking";
import { RackRowDroppable } from "./RackRowDroppable";

export type RackRow = {
  id: string; // rack-<number> or platform-<number>
  label: string;
  rackNumber: number | null; // null for non-bookable
  disabled?: boolean;
  gridColumn: number;
  gridRow: number;
};

export type RackListEditorCoreProps = {
  snapshot: SideSnapshot | null;
  layout: RackRow[];
  bannerRowSpan?: string;
  beforeRacks?: ReactNode;
  showBanner?: boolean;
  gridTemplateColumns?: string;
  /** Number of content rows in the grid (excluding spacer rows that use minmax) */
  numRows?: number;
  /** Which row index is a spacer (walkway) - uses smaller height */
  spacerRow?: number;
};


export function RackListEditorCore({
  snapshot,
  layout,
  bannerRowSpan = "1 / span 6",
  beforeRacks,
  showBanner = false,
  gridTemplateColumns = "repeat(2, 1fr) 0.3fr repeat(2, 1fr)",
  numRows = 6,
  spacerRow,
}: RackListEditorCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(800);
  const [availableHeight, setAvailableHeight] = useState(600);

  // Base dimensions - wider ratio to fill modern screens better
  const BASE_HEIGHT = 900;

  // Calculate available space
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // Available width (full container width minus padding)
      const width = rect.width - 16;
      // Available height (viewport minus space for header and footer content)
      const height = Math.max(400, window.innerHeight - rect.top - 180);
      
      setAvailableWidth(width);
      setAvailableHeight(height);
    };
    
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    const ro = new ResizeObserver(updateDimensions);
    if (containerRef.current) ro.observe(containerRef.current);
    
    return () => {
      window.removeEventListener("resize", updateDimensions);
      ro.disconnect();
    };
  }, []);

  // Calculate base width to match available aspect ratio
  // This ensures content fills the screen naturally
  const screenAspectRatio = availableWidth / availableHeight;
  const BASE_WIDTH = BASE_HEIGHT * screenAspectRatio;
  
  // Zoom to fit - will be close to 1.0 since we matched the ratio
  const zoomLevel = Math.min(availableWidth / BASE_WIDTH, availableHeight / BASE_HEIGHT);
  
  // Actual rendered dimensions
  const renderedHeight = BASE_HEIGHT * zoomLevel;
  const renderedWidth = BASE_WIDTH * zoomLevel;

  const queryClient = useQueryClient();
  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    // PointerSensor for mouse - minimal activation distance for fluid dragging
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    // TouchSensor for touch screens - use distance instead of delay for better responsiveness
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const bookings = useMemo(() => snapshot?.currentInstances ?? [], [snapshot]);

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
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
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
      const updates: { instanceId: number; racks: number[] }[] = [];
      assignments.forEach((rackNumbers, bookingId) => {
        if (!rackNumbers || rackNumbers.length === 0) return;
        updates.push({ instanceId: bookingId, racks: rackNumbers });
      });

      if (updates.length === 0) return;

      const results = await Promise.all(
        updates.map((u) => supabase.from("booking_instances").update({ racks: u.racks }).eq("id", u.instanceId))
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

      <div
        ref={containerRef}
        className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 overflow-hidden"
        style={{ height: renderedHeight + 16 }} // Add padding back
      >
        {layout.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">No data for this snapshot.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="w-full h-full">
              <div
                className="relative overflow-hidden"
                style={{ width: renderedWidth, height: renderedHeight }}
              >
                <div
                  style={{
                    width: BASE_WIDTH,
                    height: BASE_HEIGHT,
                    display: "grid",
                    gridTemplateColumns,
                    gridTemplateRows: buildGridTemplateRows(numRows, spacerRow),
                    columnGap: "20px",
                    rowGap: "20px",
                    padding: "24px",
                    // Use zoom instead of transform for crisp text rendering
                    zoom: zoomLevel,
                    transformOrigin: "top left",
                    // Larger base font size for better readability on big screens
                    fontSize: "18px",
                  }}
                >
                {beforeRacks}
                {showBanner && (
                  <div
                    style={{
                      gridColumn: 3,
                      gridRow: bannerRowSpan,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      fontSize: "32px",
                      letterSpacing: "0.3em",
                      color: "rgba(148, 163, 184, 0.8)",
                      fontWeight: 600,
                    }}
                  >
                    WHERE HISTORY BEGINS
                  </div>
                )}
                {layout.map((row) => {
                  const bookingEntry =
                    row.rackNumber !== null
                      ? [...assignments.entries()].find(([, rackNos]) => rackNos.includes(row.rackNumber!))
                      : null;
                  const bookingId = bookingEntry?.[0] ?? null;
                  const booking = bookingId ? bookingById.get(bookingId) ?? null : null;

                  const content = booking ? (
                    <DraggableBooking booking={booking} fromRack={row.rackNumber!} activeId={activeId} />
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
                      style={{
                        gridColumn: row.gridColumn,
                        gridRow: row.gridRow,
                      }}
                    />
                  );
                })}
                </div>
              </div>
            </div>
            <DragOverlay>
              {activeId ? (() => {
                // Extract booking data from activeId (format: "booking-{instanceId}-{rackNumber}")
                const match = activeId.match(/^booking-(\d+)-(\d+)$/);
                if (!match) return null;
                const instanceId = Number(match[1]);
                const booking = bookingById.get(instanceId);
                if (!booking) return null;
                return (
                  <div
                    className="inline-flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 rounded-lg px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg text-slate-100 bg-slate-800/60 border-2 border-slate-700 cursor-grabbing opacity-90 w-full"
                    style={{ zoom: zoomLevel }}
                  >
                    <div className="font-semibold line-clamp-2 break-words flex-1 min-w-0">
                      {booking.title}
                    </div>
                    <div className="text-sm sm:text-base text-slate-300 whitespace-nowrap flex-shrink-0">
                      {booking.start.slice(11, 16)}–{booking.end.slice(11, 16)}
                    </div>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

/** Build gridTemplateRows: all rows are 1fr except spacerRow which is smaller */
function buildGridTemplateRows(numRows: number, spacerRow?: number): string {
  const rows: string[] = [];
  for (let i = 1; i <= numRows; i++) {
    rows.push(i === spacerRow ? "0.15fr" : "1fr");
  }
  return rows.join(" ");
}

