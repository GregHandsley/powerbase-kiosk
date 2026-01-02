import { useMemo } from "react";
import { isSameDay } from "date-fns";
import type { ScheduleGridProps } from "./grid/types";
import { calculateBookingBlocksByRack } from "./grid/utils/bookingBlocks";
import { calculateUnavailableBlocksByRack } from "./grid/utils/unavailableBlocks";
import { useCurrentTimeIndicator } from "./grid/hooks/useCurrentTimeIndicator";
import { useDragSelection } from "./grid/hooks/useDragSelection";
import { ScheduleGridHeader } from "./grid/components/ScheduleGridHeader";
import { ScheduleGridRow } from "./grid/components/ScheduleGridRow";
import { CurrentTimeIndicator } from "./grid/components/CurrentTimeIndicator";

export function ScheduleGrid({
  racks,
  timeSlots,
  bookings,
  currentDate,
  slotCapacityData,
  capacityExceededBySlot,
  onCellClick,
  onBookingClick,
  onDragSelection,
}: ScheduleGridProps) {
  const numRacks = racks.length;
  // Use fixed width for rack columns (120px each) for better mobile/small screen support
  // Time column is 120px, each rack column is 120px
  const gridTemplateColumns = `120px repeat(${numRacks}, 120px)`;

  const isToday = isSameDay(currentDate, new Date());

  // Calculate booking blocks for each rack
  const bookingBlocksByRack = useMemo(
    () => calculateBookingBlocksByRack(racks, bookings, timeSlots, currentDate),
    [bookings, timeSlots, currentDate, racks]
  );

  // Calculate unavailable blocks (General User/Closed) for each rack
  const unavailableBlocksByRack = useMemo(
    () => calculateUnavailableBlocksByRack(racks, timeSlots, slotCapacityData, bookingBlocksByRack),
    [slotCapacityData, timeSlots, racks, bookingBlocksByRack]
  );

  // Current time indicator
  const currentTimePosition = useCurrentTimeIndicator(currentDate, timeSlots);

  // Drag selection
  const {
    gridRef,
    isDragging,
    selectedRange,
    isSelectionValid,
    isCellSelected,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useDragSelection(
    racks,
    timeSlots,
    bookingBlocksByRack,
    slotCapacityData,
    onDragSelection
  );

  return (
    <div
      ref={gridRef}
      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex-1 overflow-auto overflow-x-auto relative">
        {/* Current Time Indicator Line - Only show if viewing today */}
        {currentTimePosition && isToday && (
          <CurrentTimeIndicator 
            position={currentTimePosition} 
            isToday={isToday}
            numRacks={numRacks}
          />
        )}
        
        <div style={{ minWidth: "max-content" }}>
          {/* Racks Header - Sticky */}
          <ScheduleGridHeader racks={racks} gridTemplateColumns={gridTemplateColumns} />

          {/* Time Slots */}
          {timeSlots.map((slot, slotIndex) => (
            <ScheduleGridRow
              key={slotIndex}
              slot={slot}
              slotIndex={slotIndex}
              racks={racks}
              gridTemplateColumns={gridTemplateColumns}
              bookingBlocksByRack={bookingBlocksByRack}
              unavailableBlocksByRack={unavailableBlocksByRack}
              capacityExceededBySlot={capacityExceededBySlot}
              bookings={bookings}
              currentDate={currentDate}
              timeSlots={timeSlots}
              isSelectionValid={isSelectionValid}
              isCellSelected={isCellSelected}
              onCellClick={onCellClick}
              onBookingClick={onBookingClick}
              onMouseDown={handleMouseDown}
              isDragging={isDragging}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
