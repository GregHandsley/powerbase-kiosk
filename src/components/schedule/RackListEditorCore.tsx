import { useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import { supabase } from "../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import type { SideSnapshot } from "../../types/snapshot";
import type { ActiveInstance } from "../../types/snapshot";
import { RackEditorHeader } from "./rack-editor/RackEditorHeader";
import { RackEditorGrid } from "./rack-editor/RackEditorGrid";
import { RackEditorDragOverlay } from "./rack-editor/RackEditorDragOverlay";
import { BookingEditorModal } from "./BookingEditorModal";
import { useRackEditorDimensions } from "./rack-editor/hooks/useRackEditorDimensions";
import { useRackAssignments } from "./rack-editor/hooks/useRackAssignments";
import { useDragSensors } from "./rack-editor/hooks/useDragSensors";
import { useDragHandlers } from "./rack-editor/hooks/useDragHandlers";
import clsx from "clsx";

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
  /** Side mode for the floorplan */
  side: "power" | "base";
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
  side,
}: RackListEditorCoreProps) {
  void side; // Kept for interface compatibility but not used (floorplan removed)
  const bookings = useMemo(() => snapshot?.currentInstances ?? [], [snapshot]);
  const queryClient = useQueryClient();
  const [editingBooking, setEditingBooking] = useState<ActiveInstance | null>(null);
  const [isSelectingRacks, setIsSelectingRacks] = useState(false);
  const [selectedRacks, setSelectedRacks] = useState<number[]>([]);
  const [savingRacks, setSavingRacks] = useState(false);
  const hasInitializedRacks = useRef(false);
  const isEnteringSelectionMode = useRef(false);

  const handleEditBooking = (booking: ActiveInstance) => {
    setEditingBooking(booking);
  };

  const handleCloseModal = () => {
    // Only clear editingBooking if we're not entering selection mode
    // Use a ref to track when we're about to enter selection mode
    if (!isSelectingRacks && !isEnteringSelectionMode.current) {
      console.log("handleCloseModal: Clearing editingBooking");
      setEditingBooking(null);
    } else {
      console.log("handleCloseModal: Not clearing editingBooking", { 
        isSelectingRacks, 
        isEnteringSelectionMode: isEnteringSelectionMode.current 
      });
      isEnteringSelectionMode.current = false; // Reset the flag
    }
  };

  const handleEditRacks = () => {
    console.log("handleEditRacks called", { editingBooking: !!editingBooking, bookingRacks: editingBooking?.racks });
    if (editingBooking) {
      const initialRacks = [...editingBooking.racks];
      console.log("Setting isSelectingRacks to true, initial racks:", initialRacks);
      // Set flag to prevent handleCloseModal from clearing editingBooking
      isEnteringSelectionMode.current = true;
      // Set selection mode - modal will close automatically
      setIsSelectingRacks(true);
      setSelectedRacks(initialRacks);
      hasInitializedRacks.current = false; // Reset initialization flag
      // Don't clear editingBooking - we need it for the selection mode
    }
  };

  const handleSaveTitle = async (title: string) => {
    if (!editingBooking) return;
    
    const { error } = await supabase
      .from("bookings")
      .update({ title: title.trim() })
      .eq("id", editingBooking.bookingId);

    if (error) {
      throw new Error(error.message);
    }

    await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
    await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
  };

  const handleCancelRackSelection = () => {
    setIsSelectingRacks(false);
    if (editingBooking) {
      setSelectedRacks([...editingBooking.racks]);
    }
  };

  const handleSaveRacks = async () => {
    if (!editingBooking || selectedRacks.length === 0) return;

    setSavingRacks(true);
    try {
      const { error } = await supabase
        .from("booking_instances")
        .update({ racks: selectedRacks })
        .eq("id", editingBooking.instanceId);

      if (error) {
        throw new Error(error.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });

      setIsSelectingRacks(false);
      setEditingBooking(null);
    } catch (err) {
      console.error("Failed to save racks", err);
      alert(err instanceof Error ? err.message : "Failed to save racks");
    } finally {
      setSavingRacks(false);
    }
  };

  const handleRackClick = (rackNumber: number) => {
    console.log("handleRackClick called", { 
      rackNumber, 
      editingBooking: editingBooking ? { id: editingBooking.instanceId, title: editingBooking.title } : null, 
      isSelectingRacks,
      currentSelected: selectedRacks 
    });
    
    if (!editingBooking || !isSelectingRacks) {
      console.log("Early return: no booking or not selecting", { 
        hasEditingBooking: !!editingBooking, 
        isSelectingRacks 
      });
      return;
    }

    // Check if rack is used by another booking
    const rackUsedByOther = bookings.some(
      (b) => b.instanceId !== editingBooking.instanceId && b.racks.includes(rackNumber)
    );
    if (rackUsedByOther) {
      console.log("Rack used by other booking");
      return; // Can't select racks used by others
    }

    console.log("Updating selectedRacks state");
    setSelectedRacks((prev) => {
      const newRacks = prev.includes(rackNumber)
        ? prev.filter((n) => n !== rackNumber).sort((a, b) => a - b)
        : [...prev, rackNumber].sort((a, b) => a - b);
      console.log("New selectedRacks:", newRacks);
      return newRacks;
    });
  };

  // Initialize selected racks when entering selection mode (only on initial entry)
  useEffect(() => {
    console.log("useEffect for isSelectingRacks", { isSelectingRacks, hasEditingBooking: !!editingBooking, hasInitialized: hasInitializedRacks.current });
    if (isSelectingRacks && editingBooking && !hasInitializedRacks.current) {
      console.log("Initializing selectedRacks from booking", editingBooking.racks);
      setSelectedRacks([...editingBooking.racks]);
      hasInitializedRacks.current = true;
    } else if (!isSelectingRacks) {
      // Reset the flag when exiting selection mode
      hasInitializedRacks.current = false;
    }
  }, [isSelectingRacks, editingBooking]);

  const {
    containerRef,
    BASE_WIDTH,
    BASE_HEIGHT,
    zoomLevel,
    renderedHeight,
    renderedWidth,
  } = useRackEditorDimensions();

  const sensors = useDragSensors();

  const {
    bookingById,
    assignments,
    setAssignments,
    initialAssignments,
    saving,
    savedAt,
    handleSave,
  } = useRackAssignments(bookings);

  const { activeId, handleDragStart, handleDragEnd } = useDragHandlers({
    assignments,
    setAssignments,
    initialAssignments,
  });

  return (
    <div className="space-y-2">
      {!isSelectingRacks && (
        <RackEditorHeader saving={saving} savedAt={savedAt} onSave={handleSave} />
      )}

      {isSelectingRacks && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Select Platforms for {editingBooking?.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Click racks to select or deselect. Selected racks ({selectedRacks.length}) are highlighted. Racks used by other bookings are grayed out.
              </p>
              <p className="text-xs text-yellow-400 mt-1 font-mono">
                DEBUG: isSelectingRacks={String(isSelectingRacks)}, editingBookingId={editingBooking?.instanceId ?? 'null'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelRackSelection}
                disabled={savingRacks}
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50 rounded-md border border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRacks}
                disabled={savingRacks || selectedRacks.length === 0}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-md",
                  "bg-indigo-600 hover:bg-indigo-500 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {savingRacks ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
          ref={containerRef}
          className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 overflow-hidden"
          style={{ height: renderedHeight + 16 }}
        >
          {layout.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">No data for this snapshot.</div>
          ) : isSelectingRacks ? (
            // When selecting racks, don't use DndContext to avoid interfering with clicks
            <div className="w-full h-full">
              <div
                className="relative overflow-hidden"
                style={{ width: renderedWidth, height: renderedHeight }}
              >
                <RackEditorGrid
                  layout={layout}
                  assignments={assignments}
                  bookingById={bookingById}
                  activeId={null}
                  beforeRacks={beforeRacks}
                  showBanner={showBanner}
                  bannerRowSpan={bannerRowSpan}
                  gridTemplateColumns={gridTemplateColumns}
                  numRows={numRows}
                  spacerRow={spacerRow}
                  BASE_WIDTH={BASE_WIDTH}
                  BASE_HEIGHT={BASE_HEIGHT}
                  zoomLevel={zoomLevel}
                  onEditBooking={handleEditBooking}
                  isSelectingRacks={isSelectingRacks}
                  selectedRacks={selectedRacks}
                  editingBookingId={editingBooking?.instanceId ?? null}
                  onRackClick={handleRackClick}
                  bookings={bookings}
                />
              </div>
            </div>
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
                  <RackEditorGrid
                    layout={layout}
                    assignments={assignments}
                    bookingById={bookingById}
                    activeId={activeId}
                    beforeRacks={beforeRacks}
                    showBanner={showBanner}
                    bannerRowSpan={bannerRowSpan}
                    gridTemplateColumns={gridTemplateColumns}
                    numRows={numRows}
                    spacerRow={spacerRow}
                    BASE_WIDTH={BASE_WIDTH}
                    BASE_HEIGHT={BASE_HEIGHT}
                    zoomLevel={zoomLevel}
                    onEditBooking={handleEditBooking}
                    isSelectingRacks={isSelectingRacks}
                    selectedRacks={selectedRacks}
                    editingBookingId={editingBooking?.instanceId ?? null}
                    onRackClick={handleRackClick}
                    bookings={bookings}
                  />
                </div>
              </div>
              <DragOverlay>
                <RackEditorDragOverlay
                  activeId={activeId}
                  bookingById={bookingById}
                  zoomLevel={zoomLevel}
                />
              </DragOverlay>
            </DndContext>
          )}
        </div>

      {/* Booking Editor Modal */}
      <BookingEditorModal
        booking={editingBooking}
        isOpen={editingBooking !== null && !isSelectingRacks}
        onClose={handleCloseModal}
        onClearRacks={handleEditRacks}
        onSaveTitle={handleSaveTitle}
      />
    </div>
  );
}

