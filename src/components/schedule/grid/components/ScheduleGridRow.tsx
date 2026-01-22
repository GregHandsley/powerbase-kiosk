import clsx from 'clsx';
import {
  formatTimeSlot,
  type TimeSlot,
} from '../../../admin/capacity/scheduleUtils';
import type {
  BookingBlock,
  UnavailableBlock,
  SlotCapacityData,
} from '../types';
import type { ActiveInstance } from '../../../../types/snapshot';
import { BookingBlock as BookingBlockComponent } from './BookingBlock';
import { UnavailableBlock as UnavailableBlockComponent } from './UnavailableBlock';
import { isRackAtCapacity } from '../utils/capacityExceeded';
import { isTimeSlotInPast } from '../../../admin/booking/utils';

type Props = {
  slot: TimeSlot;
  slotIndex: number;
  racks: number[];
  gridTemplateColumns: string;
  bookingBlocksByRack: Map<number, BookingBlock[]>;
  unavailableBlocksByRack: Map<number, UnavailableBlock[]>;
  capacityExceededBySlot?: Map<number, Set<number>>;
  slotCapacityData: Map<number, SlotCapacityData>;
  bookings: ActiveInstance[];
  currentDate: Date;
  timeSlots: TimeSlot[];
  isSelectionValid: boolean;
  isCellSelected: (slotIndex: number, rackIndex: number) => boolean;
  onCellClick: (rack: number, timeSlot: TimeSlot) => void;
  onBookingClick?: (booking: ActiveInstance) => void;
  onMouseDown: (
    e: React.MouseEvent,
    slotIndex: number,
    rackIndex: number
  ) => void;
  isDragging: boolean;
};

export function ScheduleGridRow({
  slot,
  slotIndex,
  racks,
  gridTemplateColumns,
  bookingBlocksByRack,
  unavailableBlocksByRack,
  capacityExceededBySlot,
  slotCapacityData,
  bookings,
  currentDate,
  timeSlots,
  isSelectionValid,
  isCellSelected,
  onCellClick,
  onBookingClick,
  onMouseDown,
  isDragging,
}: Props) {
  const isHour = slot.minute === 0;
  const isEvenRow = slotIndex % 2 === 1;

  return (
    <div
      key={slotIndex}
      className={clsx(
        'grid relative',
        isEvenRow ? 'bg-slate-900/20' : 'bg-slate-950/10',
        isHour ? 'border-b-2 border-slate-700' : 'border-b border-slate-800'
      )}
      style={{ gridTemplateColumns }}
    >
      {/* Time Label - Sticky, positioned on the line */}
      <div
        className={clsx(
          'sticky left-0 z-10 border-r bg-slate-950/95 min-w-[120px] relative min-h-[50px] px-3',
          isHour ? 'border-slate-600' : 'border-slate-700'
        )}
      >
        {/* Hide the first time label (slotIndex === 0) but keep the slot functional */}
        {slotIndex > 0 && (
          <div
            className={clsx(
              'absolute top-0 right-2.5 font-mono whitespace-nowrap leading-tight -translate-y-1/2 backdrop-blur-sm px-2 py-0.5 rounded-md border shadow-sm',
              isHour
                ? 'text-xs font-semibold text-slate-100 bg-slate-900/90 border-slate-600/60'
                : 'text-[11px] font-medium text-slate-400 bg-slate-900/70 border-slate-700/40'
            )}
          >
            {formatTimeSlot(slot)}
          </div>
        )}
      </div>

      {/* Rack Cells */}
      {racks.map((rack, rackIndex) => {
        const bookingBlocks = bookingBlocksByRack.get(rack) ?? [];
        const bookingBlockForThisSlot = bookingBlocks.find(
          (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
        );
        const isBookingBlockStart =
          bookingBlockForThisSlot?.startSlot === slotIndex;
        const isInBookingBlock = !!bookingBlockForThisSlot;

        const unavailableBlocks = unavailableBlocksByRack.get(rack) ?? [];
        const unavailableBlockForThisSlot = unavailableBlocks.find(
          (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
        );
        const isUnavailableBlockStart =
          unavailableBlockForThisSlot?.startSlot === slotIndex;
        const isInUnavailableBlock = !!unavailableBlockForThisSlot;

        // Bookings take priority over unavailable blocks
        const isBlockStart =
          isBookingBlockStart || (isUnavailableBlockStart && !isInBookingBlock);
        const isInBlock = isInBookingBlock || isInUnavailableBlock;

        const isSelected = isCellSelected(slotIndex, rackIndex);

        // Check if this rack is at capacity (not already booked)
        const isAtCapacity = capacityExceededBySlot
          ? isRackAtCapacity(
              slotIndex,
              rack,
              capacityExceededBySlot,
              bookings,
              currentDate,
              timeSlots
            )
          : false;

        // Check if this rack is in a General User block (blocked from booking)
        const isInGeneralUserBlock =
          isInUnavailableBlock &&
          unavailableBlockForThisSlot?.periodType === 'General User';

        // Check if this rack is not available in the capacity schedule
        // A rack is unavailable if:
        // 1. There's capacity data for this slot
        // 2. availablePlatforms is not null (meaning there's a restriction)
        // 3. The rack is NOT in the availablePlatforms set
        // 4. It's not already booked (bookings take priority)
        // 5. There's no unavailable block (to avoid double indication)
        const capacityData = slotCapacityData.get(slotIndex);
        const isRackUnavailable =
          !isInBookingBlock && // Don't mark as unavailable if there's a booking
          !isInUnavailableBlock && // Don't show red if there's already an unavailable block
          capacityData !== undefined &&
          capacityData.availablePlatforms !== null && // null means all platforms available
          !capacityData.availablePlatforms.has(rack); // rack not in available set

        // Check if this time slot is in the past
        const isPast = isTimeSlotInPast(currentDate, slot);

        return (
          <div
            key={rackIndex}
            className={clsx(
              'relative border-r border-slate-800 last:border-r-0 min-h-[54px] min-w-[120px]',
              isSelected && isSelectionValid && 'bg-indigo-500/20',
              isSelected && !isSelectionValid && 'bg-red-500/10',
              isAtCapacity && !isInBookingBlock && 'bg-red-950/20',
              isRackUnavailable && 'bg-red-950/20' // Same subtle red as capacity exceeded
            )}
            title={
              isPast && !isInBookingBlock
                ? 'This time is in the past - cannot select'
                : isAtCapacity && !isInBookingBlock
                  ? 'Capacity exceeded - cannot book additional sessions'
                  : isRackUnavailable
                    ? 'Platform not available for booking in this time slot'
                    : isInGeneralUserBlock
                      ? 'General User period - platform not available for booking'
                      : undefined
            }
          >
            {/* Booking Block */}
            {isBookingBlockStart && bookingBlockForThisSlot && (
              <BookingBlockComponent
                block={bookingBlockForThisSlot}
                onClick={onBookingClick}
              />
            )}

            {/* Unavailable Block (General User/Closed) - only show if no booking */}
            {isUnavailableBlockStart &&
              unavailableBlockForThisSlot &&
              !isInBookingBlock && (
                <UnavailableBlockComponent
                  block={unavailableBlockForThisSlot}
                />
              )}

            <div
              className={clsx(
                'h-full w-full transition-colors',
                isInBlock && !isBlockStart
                  ? 'pointer-events-none'
                  : (isAtCapacity ||
                        isRackUnavailable ||
                        isInGeneralUserBlock ||
                        isPast) &&
                      !isInBookingBlock
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer hover:bg-indigo-500/10'
              )}
              onMouseDown={(e) => {
                if (
                  !isInBlock &&
                  !isBlockStart &&
                  !isAtCapacity &&
                  !isRackUnavailable &&
                  !isInGeneralUserBlock &&
                  !isPast
                ) {
                  onMouseDown(e, slotIndex, rackIndex);
                }
              }}
              onClick={() => {
                if (
                  (isAtCapacity ||
                    isRackUnavailable ||
                    isInGeneralUserBlock ||
                    isPast) &&
                  !isInBookingBlock
                ) {
                  // Show a message or prevent action
                  return;
                }
                if (!isDragging && (!isInBlock || isBlockStart)) {
                  onCellClick(rack, slot);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
