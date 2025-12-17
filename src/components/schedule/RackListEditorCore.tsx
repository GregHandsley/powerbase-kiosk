import { useMemo, type ReactNode } from "react";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import type { SideSnapshot } from "../../types/snapshot";
import { RackEditorHeader } from "./rack-editor/RackEditorHeader";
import { RackEditorGrid } from "./rack-editor/RackEditorGrid";
import { RackEditorDragOverlay } from "./rack-editor/RackEditorDragOverlay";
import { useRackEditorDimensions } from "./rack-editor/hooks/useRackEditorDimensions";
import { useRackAssignments } from "./rack-editor/hooks/useRackAssignments";
import { useDragSensors } from "./rack-editor/hooks/useDragSensors";
import { useDragHandlers } from "./rack-editor/hooks/useDragHandlers";

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
  const bookings = useMemo(() => snapshot?.currentInstances ?? [], [snapshot]);

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
      <RackEditorHeader saving={saving} savedAt={savedAt} onSave={handleSave} />

      <div
        ref={containerRef}
        className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 overflow-hidden"
        style={{ height: renderedHeight + 16 }}
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
    </div>
  );
}

