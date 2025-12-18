import type { ReactNode } from "react";
import type { RackRow } from "../RackListEditorCore";
import type { ActiveInstance } from "../../../types/snapshot";
import { DraggableBooking } from "../DraggableBooking";
import { RackRowDroppable } from "../RackRowDroppable";
import { Banner } from "./Banner";
import { buildGridTemplateRows } from "./utils";

type Props = {
  layout: RackRow[];
  assignments: Map<number, number[]>;
  bookingById: Map<number, ActiveInstance>;
  activeId: string | null;
  beforeRacks?: ReactNode;
  showBanner: boolean;
  bannerRowSpan: string;
  gridTemplateColumns: string;
  numRows: number;
  spacerRow?: number;
  BASE_WIDTH: number;
  BASE_HEIGHT: number;
  zoomLevel: number;
  onEditBooking?: (booking: ActiveInstance) => void;
  isSelectingRacks?: boolean;
  selectedRacks?: number[];
  editingBookingId?: number | null;
  onRackClick?: (rackNumber: number) => void;
  bookings?: ActiveInstance[];
};

export function RackEditorGrid({
  layout,
  assignments,
  bookingById,
  activeId,
  beforeRacks,
  showBanner,
  bannerRowSpan,
  gridTemplateColumns,
  numRows,
  spacerRow,
  BASE_WIDTH,
  BASE_HEIGHT,
  zoomLevel,
  onEditBooking,
  isSelectingRacks = false,
  selectedRacks = [],
  editingBookingId = null,
  onRackClick,
  bookings = [],
}: Props) {
  const selectedSet = new Set(selectedRacks);
  console.log("RackEditorGrid render", { 
    isSelectingRacks, 
    selectedRacks, 
    selectedSetSize: selectedSet.size 
  });
  return (
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
        zoom: zoomLevel,
        transformOrigin: "top left",
        fontSize: "18px",
      }}
    >
      {beforeRacks}
      {showBanner && <Banner gridColumn={3} gridRow={bannerRowSpan} />}
      {layout.map((row) => {
        const bookingEntry =
          row.rackNumber !== null
            ? [...assignments.entries()].find(([, rackNos]) => rackNos.includes(row.rackNumber!))
            : null;
        const bookingId = bookingEntry?.[0] ?? null;
        const booking = bookingId ? bookingById.get(bookingId) ?? null : null;

        const content = booking ? (
          <DraggableBooking 
            booking={booking} 
            fromRack={row.rackNumber!} 
            activeId={activeId}
            onEdit={onEditBooking}
            isSelectingRacks={isSelectingRacks}
          />
        ) : row.disabled ? (
          <span className="text-slate-600">Not bookable</span>
        ) : (
          <span className="text-slate-500">Drop booking here</span>
        );

        // Determine if this rack is selected or disabled in selection mode
        const isSelected = row.rackNumber !== null && selectedSet.has(row.rackNumber);
        const isUsedByOtherBooking = isSelectingRacks && row.rackNumber !== null && booking && booking.instanceId !== editingBookingId;
        // Rack is clickable if: in selection mode, has a rack number, not disabled, and either not used by anyone OR used by the editing booking
        const isClickable = isSelectingRacks && row.rackNumber !== null && !row.disabled && (!booking || booking.instanceId === editingBookingId);
        
        if (isSelectingRacks && row.rackNumber !== null) {
          console.log(`Rack ${row.rackNumber} render:`, {
            isSelected,
            selectedRacks,
            selectedSetHas: selectedSet.has(row.rackNumber),
            isUsedByOtherBooking,
            isClickable,
            hasBooking: !!booking,
            bookingInstanceId: booking?.instanceId,
            editingBookingId,
          });
        }

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
            isSelectingRacks={isSelectingRacks}
            isSelected={isSelected}
            isDisabled={isUsedByOtherBooking}
            isClickable={isClickable}
            onRackClick={onRackClick && row.rackNumber !== null ? () => {
              console.log("RackEditorGrid onRackClick callback invoked", row.rackNumber);
              onRackClick(row.rackNumber);
            } : undefined}
          />
        );
      })}
    </div>
  );
}

