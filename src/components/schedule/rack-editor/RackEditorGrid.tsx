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
  /** Set of available platform numbers based on capacity schedules (null = all available) */
  availablePlatforms?: Set<number> | null;
  /** True when the current time range is during a Closed period */
  isClosedPeriod?: boolean;
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
  availablePlatforms = null,
  isClosedPeriod = false,
}: Props) {
  const selectedSet = new Set(selectedRacks);
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

        // Determine if this rack is selected or disabled in selection mode
        const isSelected = row.rackNumber !== null && selectedSet.has(row.rackNumber);
        const isUsedByOtherBooking = isSelectingRacks && row.rackNumber !== null && booking && booking.instanceId !== editingBookingId;
        
        // Check if platform is available in capacity schedule
        // If availablePlatforms is null, all platforms are available (no restriction)
        // If availablePlatforms is a Set, only racks in that Set are available
        // This check is INDEPENDENT of bookings - it's based solely on capacity schedules
        const isAvailableInSchedule = row.rackNumber === null || availablePlatforms === null || availablePlatforms.has(row.rackNumber);
        
        // Determine unavailable reason - MUST check schedule availability even when there's no booking
        // This ensures \"General User\" and \"Closed\" show even when there are no bookings
        // Bookings are NOT a factor in determining schedule availability
        const unavailableReason = ((): "booked" | "not-in-schedule" | "closed" | null => {
          if (row.rackNumber === null) return null;
          // If facility is closed, all racks are treated as closed
          if (isClosedPeriod) return "closed";
          // First check if it's used by another booking (only relevant in selection mode)
          if (isUsedByOtherBooking) return "booked";
          // Then check if rack is not in schedule (even if there's no booking)
          // This is the key: if availablePlatforms is a Set and the rack is NOT in it, it's "not-in-schedule"
          if (availablePlatforms !== null && !availablePlatforms.has(row.rackNumber)) {
            return "not-in-schedule";
          }
          return null;
        })();
        
        // Platform is unavailable if it's not in the capacity schedule OR used by another booking
        // Note: unavailableReason already handles both cases, so we can derive isUnavailable from it
        const isUnavailable = unavailableReason !== null;
        
        // Rack is clickable if: in selection mode, has a rack number, not disabled, and either not used by anyone OR used by the editing booking, AND is available in schedule
        const isClickable = isSelectingRacks && row.rackNumber !== null && !row.disabled && (!booking || booking.instanceId === editingBookingId) && isAvailableInSchedule;

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
        ) : activeId && !isUnavailable ? (
          // Only show helper text on racks that are actually available as drop targets
          <span className="text-slate-500">Drop booking here</span>
        ) : null;

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
            isDisabled={isUnavailable}
            isClickable={isClickable}
            unavailableReason={unavailableReason}
            onRackClick={onRackClick && row.rackNumber !== null ? () => onRackClick(row.rackNumber) : undefined}
          />
        );
      })}
    </div>
  );
}

