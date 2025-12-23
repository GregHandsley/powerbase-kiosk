import { useMemo } from "react";
import clsx from "clsx";
import { format } from "date-fns";
import { formatTimeSlot, type TimeSlot } from "../admin/capacity/scheduleUtils";
import { PERIOD_TYPE_COLORS } from "../admin/capacity/constants";
import type { ActiveInstance } from "../../types/snapshot";

type SlotCapacityData = {
  availablePlatforms: Set<number> | null;
  isClosed: boolean;
  periodType: string | null;
};

type Props = {
  racks: number[];
  timeSlots: TimeSlot[];
  selectedSide: "Power" | "Base";
  bookings: ActiveInstance[];
  currentDate: Date;
  slotCapacityData: Map<number, SlotCapacityData>;
  onCellClick: (rack: number, timeSlot: TimeSlot) => void;
  onBookingClick?: (booking: ActiveInstance) => void;
};

type BookingBlock = {
  booking: ActiveInstance;
  startSlot: number;
  endSlot: number;
  rowSpan: number;
};

type UnavailableBlock = {
  startSlot: number;
  endSlot: number;
  rowSpan: number;
  periodType: "General User" | "Closed";
  startTime: string;
  endTime: string;
};

// Calculate which time slots a booking spans
function getBookingBlocks(
  booking: ActiveInstance,
  timeSlots: TimeSlot[],
  currentDate: Date
): BookingBlock | null {
  const bookingStart = new Date(booking.start);
  const bookingEnd = new Date(booking.end);
  const dateStr = format(currentDate, "yyyy-MM-dd");

  // Check if booking overlaps with the current date
  const bookingStartDate = format(bookingStart, "yyyy-MM-dd");
  const bookingEndDate = format(bookingEnd, "yyyy-MM-dd");

  if (bookingEndDate < dateStr || bookingStartDate > dateStr) {
    return null; // Booking doesn't overlap with this date
  }

  // Get the effective start and end times for this date
  let effectiveStartHour = 0;
  let effectiveStartMinute = 0;
  let effectiveEndHour = 23;
  let effectiveEndMinute = 59;

  if (bookingStartDate === dateStr) {
    effectiveStartHour = bookingStart.getHours();
    effectiveStartMinute = bookingStart.getMinutes();
  }

  if (bookingEndDate === dateStr) {
    effectiveEndHour = bookingEnd.getHours();
    effectiveEndMinute = bookingEnd.getMinutes();
  }

  // Find the slot indices
  let startSlot = -1;
  let endSlot = -1;

  timeSlots.forEach((slot, index) => {
    const slotHour = slot.hour;
    const slotMinute = slot.minute;

    // Check if this slot is the start slot (slot time >= booking start time)
    if (startSlot === -1) {
      if (slotHour > effectiveStartHour || (slotHour === effectiveStartHour && slotMinute >= effectiveStartMinute)) {
        startSlot = index;
      }
    }

    // Check if this slot is after the end time (exclusive end)
    // We want the last slot that is still within the booking
    if (slotHour < effectiveEndHour || (slotHour === effectiveEndHour && slotMinute < effectiveEndMinute)) {
      endSlot = index + 1; // +1 because we want exclusive end
    } else if (slotHour === effectiveEndHour && slotMinute === effectiveEndMinute) {
      endSlot = index + 1; // End time matches slot exactly, next slot is exclusive
    }
  });

  // If booking extends beyond the last slot, set endSlot to the last slot
  if (endSlot === -1) {
    endSlot = timeSlots.length;
  }

  // If booking starts before the first slot, set startSlot to 0
  if (startSlot === -1) {
    startSlot = 0;
  }

  if (startSlot >= endSlot) {
    return null; // Invalid range
  }

  return {
    booking,
    startSlot,
    endSlot: endSlot - 1, // Make it inclusive for display
    rowSpan: endSlot - startSlot,
  };
}

export function ScheduleGrid({
  racks,
  timeSlots,
  selectedSide,
  bookings,
  currentDate,
  slotCapacityData,
  onCellClick,
  onBookingClick,
}: Props) {
  const numRacks = racks.length;
  // Use fixed width for rack columns (200px each) to give more space for booking content
  // Time column is 120px, each rack column is 200px
  const gridTemplateColumns = `120px repeat(${numRacks}, 200px)`;

  // Calculate booking blocks for each rack
  const bookingBlocksByRack = useMemo(() => {
    const blocksByRack = new Map<number, BookingBlock[]>();

    racks.forEach((rack) => {
      const blocks: BookingBlock[] = [];
      bookings.forEach((booking) => {
        if (booking.racks.includes(rack)) {
          const block = getBookingBlocks(booking, timeSlots, currentDate);
          if (block) {
            blocks.push(block);
          }
        }
      });
      blocksByRack.set(rack, blocks);
    });

    return blocksByRack;
  }, [bookings, timeSlots, currentDate, racks]);

  // Calculate unavailable blocks (General User/Closed) for each rack
  const unavailableBlocksByRack = useMemo(() => {
    const blocksByRack = new Map<number, UnavailableBlock[]>();

    racks.forEach((rack) => {
      const blocks: UnavailableBlock[] = [];
      let currentBlock: {
        startSlot: number;
        periodType: "General User" | "Closed";
        startTime: string;
      } | null = null;

      timeSlots.forEach((slot, slotIndex) => {
        const capacityData = slotCapacityData.get(slotIndex);
        const isAvailable =
          !capacityData ||
          capacityData.availablePlatforms === null ||
          capacityData.availablePlatforms.has(rack);
        const isClosed = capacityData?.isClosed ?? false;
        const isUnavailable = !isAvailable || isClosed;

        // Check if there's a booking block at this slot (bookings take priority)
        const bookingBlocks = bookingBlocksByRack.get(rack) ?? [];
        const hasBooking = bookingBlocks.some(
          (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
        );

        // Only create unavailable block if there's no booking
        if (isUnavailable && !hasBooking) {
          const periodType = isClosed ? "Closed" : "General User";

          if (currentBlock && currentBlock.periodType === periodType) {
            // Continue the current block
          } else {
            // Close previous block if it exists
            if (currentBlock) {
              const endTime = formatTimeSlot(timeSlots[slotIndex - 1]);
              blocks.push({
                startSlot: currentBlock.startSlot,
                endSlot: slotIndex - 1,
                rowSpan: slotIndex - currentBlock.startSlot,
                periodType: currentBlock.periodType,
                startTime: currentBlock.startTime,
                endTime: endTime,
              });
            }

            // Start new block
            currentBlock = {
              startSlot: slotIndex,
              periodType: periodType,
              startTime: formatTimeSlot(slot),
            };
          }
        } else {
          // Available or has booking - close previous block if it exists
          if (currentBlock) {
            const endTime = formatTimeSlot(timeSlots[slotIndex - 1]);
            blocks.push({
              startSlot: currentBlock.startSlot,
              endSlot: slotIndex - 1,
              rowSpan: slotIndex - currentBlock.startSlot,
              periodType: currentBlock.periodType,
              startTime: currentBlock.startTime,
              endTime: endTime,
            });
            currentBlock = null;
          }
        }
      });

      // Close any remaining block at the end
      if (currentBlock !== null) {
        const lastSlot = timeSlots[timeSlots.length - 1];
        const endTime = formatTimeSlot(lastSlot);
        blocks.push({
          startSlot: currentBlock.startSlot,
          endSlot: timeSlots.length - 1,
          rowSpan: timeSlots.length - currentBlock.startSlot,
          periodType: currentBlock.periodType,
          startTime: currentBlock.startTime,
          endTime: endTime,
        });
      }

      blocksByRack.set(rack, blocks);
    });

    return blocksByRack;
  }, [slotCapacityData, timeSlots, racks, bookingBlocksByRack]);

  return (
    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto overflow-x-auto">
        <div style={{ minWidth: "max-content" }}>
          {/* Racks Header - Sticky */}
          <div
            className="sticky top-0 z-20 grid border-b border-slate-700 bg-slate-900"
            style={{ gridTemplateColumns }}
          >
            <div className="p-3 border-r border-slate-700 bg-slate-950/50 min-w-[120px]"></div>
            {racks.map((rack) => (
              <div
                key={rack}
                className="p-3 border-r border-slate-700 last:border-r-0 bg-slate-950/50 text-center min-w-[200px]"
              >
                <div className="text-sm font-medium text-slate-200">
                  Rack {rack}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {timeSlots.map((slot, slotIndex) => (
            <div
              key={slotIndex}
              className="grid border-b border-slate-800"
              style={{ gridTemplateColumns }}
            >
              {/* Time Label - Sticky */}
              <div className="sticky left-0 z-10 p-3 border-r border-slate-700 bg-slate-950/95 text-xs text-slate-400 text-right font-mono whitespace-nowrap min-w-[120px]">
                {formatTimeSlot(slot)}
              </div>

              {/* Rack Cells */}
              {racks.map((rack, rackIndex) => {
                const bookingBlocks = bookingBlocksByRack.get(rack) ?? [];
                const bookingBlockForThisSlot = bookingBlocks.find(
                  (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
                );
                const isBookingBlockStart = bookingBlockForThisSlot?.startSlot === slotIndex;
                const isInBookingBlock = !!bookingBlockForThisSlot;

                const unavailableBlocks = unavailableBlocksByRack.get(rack) ?? [];
                const unavailableBlockForThisSlot = unavailableBlocks.find(
                  (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
                );
                const isUnavailableBlockStart = unavailableBlockForThisSlot?.startSlot === slotIndex;
                const isInUnavailableBlock = !!unavailableBlockForThisSlot;

                // Bookings take priority over unavailable blocks
                const displayBlock = bookingBlockForThisSlot || unavailableBlockForThisSlot;
                const isBlockStart = isBookingBlockStart || (isUnavailableBlockStart && !isInBookingBlock);
                const isInBlock = isInBookingBlock || isInUnavailableBlock;

                return (
                  <div
                    key={rackIndex}
                    className="relative border-r border-slate-800 last:border-r-0 min-h-[50px] min-w-[200px]"
                  >
                    {/* Booking Block */}
                    {isBookingBlockStart && bookingBlockForThisSlot && (
                      <div
                        className={clsx(
                          "absolute left-0 right-0 border-l-4 border-t border-b border-r rounded-sm cursor-pointer transition-opacity hover:opacity-90 shadow-md",
                          "flex flex-col items-center justify-center p-2 z-5"
                        )}
                        style={{
                          top: 0,
                          height: `${bookingBlockForThisSlot.rowSpan * 50}px`,
                          zIndex: 6, // Bookings on top
                          margin: "2px 4px",
                          left: "4px",
                          right: "4px",
                          backgroundColor: bookingBlockForThisSlot.booking.color
                            ? `${bookingBlockForThisSlot.booking.color}40`
                            : "rgba(99, 102, 241, 0.3)", // indigo fallback
                          borderColor: bookingBlockForThisSlot.booking.color
                            ? bookingBlockForThisSlot.booking.color
                            : "rgb(99, 102, 241)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onBookingClick) {
                            onBookingClick(bookingBlockForThisSlot.booking);
                          }
                        }}
                      >
                        <div
                          className="text-sm font-semibold text-center px-1 break-words"
                          style={{
                            color: bookingBlockForThisSlot.booking.color || "rgb(199, 210, 254)",
                          }}
                        >
                          {bookingBlockForThisSlot.booking.title}
                        </div>
                        <div
                          className="text-xs mt-1 text-center px-1"
                          style={{
                            color: bookingBlockForThisSlot.booking.color || "rgb(199, 210, 254)",
                          }}
                        >
                          {format(new Date(bookingBlockForThisSlot.booking.start), "HH:mm")} -{" "}
                          {format(new Date(bookingBlockForThisSlot.booking.end), "HH:mm")}
                        </div>
                      </div>
                    )}

                    {/* Unavailable Block (General User/Closed) - only show if no booking */}
                    {isUnavailableBlockStart && unavailableBlockForThisSlot && !isInBookingBlock && (
                      <div
                        className={clsx(
                          "absolute left-0 right-0 border-l-4 border-t border-b border-r rounded-sm transition-opacity shadow-md",
                          "flex flex-col items-center justify-center p-2 z-5"
                        )}
                        style={{
                          top: 0,
                          height: `${unavailableBlockForThisSlot.rowSpan * 50}px`,
                          zIndex: 5, // Below bookings
                          margin: "2px 4px",
                          left: "4px",
                          right: "4px",
                          backgroundColor: PERIOD_TYPE_COLORS[unavailableBlockForThisSlot.periodType].bg,
                          borderColor: PERIOD_TYPE_COLORS[unavailableBlockForThisSlot.periodType].border,
                        }}
                      >
                        <div
                          className={clsx(
                            "text-sm font-semibold text-center px-1 break-words",
                            PERIOD_TYPE_COLORS[unavailableBlockForThisSlot.periodType].text
                          )}
                        >
                          {unavailableBlockForThisSlot.periodType}
                        </div>
                        <div
                          className={clsx(
                            "text-xs mt-1 text-center px-1",
                            PERIOD_TYPE_COLORS[unavailableBlockForThisSlot.periodType].text
                          )}
                        >
                          {unavailableBlockForThisSlot.startTime} - {unavailableBlockForThisSlot.endTime}
                        </div>
                      </div>
                    )}

                    <div
                      className={clsx(
                        "h-full w-full transition-colors",
                        isInBlock && !isBlockStart
                          ? "pointer-events-none"
                          : "cursor-pointer hover:bg-slate-800/30"
                      )}
                      onClick={() => {
                        if (!isInBlock || isBlockStart) {
                          onCellClick(rack, slot);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

