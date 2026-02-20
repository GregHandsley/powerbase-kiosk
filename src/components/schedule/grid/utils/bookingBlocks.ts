import { format } from 'date-fns';
import type { TimeSlot } from '../../../admin/capacity/scheduleUtils';
import type { ActiveInstance } from '../../../../types/snapshot';
import type { BookingBlock } from '../types';

/**
 * Calculate which time slots a booking spans
 */
export function getBookingBlocks(
  booking: ActiveInstance,
  timeSlots: TimeSlot[],
  currentDate: Date
): BookingBlock | null {
  if (timeSlots.length === 0) return null;

  const bookingStart = new Date(booking.start);
  const bookingEnd = new Date(booking.end);
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  // Check if booking overlaps with the current date
  const bookingStartDate = format(bookingStart, 'yyyy-MM-dd');
  const bookingEndDate = format(bookingEnd, 'yyyy-MM-dd');

  if (bookingEndDate < dateStr || bookingStartDate > dateStr) {
    return null; // Booking doesn't overlap with this date
  }

  // Effective booking bounds for this date in minutes.
  const effectiveStartMinutes =
    bookingStartDate === dateStr
      ? bookingStart.getHours() * 60 + bookingStart.getMinutes()
      : 0;
  const effectiveEndMinutes =
    bookingEndDate === dateStr
      ? bookingEnd.getHours() * 60 + bookingEnd.getMinutes()
      : 24 * 60;

  const firstSlot = timeSlots[0];
  const lastSlot = timeSlots[timeSlots.length - 1];
  const slotDuration =
    timeSlots.length > 1
      ? Math.max(
          1,
          timeSlots[1].hour * 60 +
            timeSlots[1].minute -
            (firstSlot.hour * 60 + firstSlot.minute)
        )
      : 30;

  const gridStartMinutes = firstSlot.hour * 60 + firstSlot.minute;
  const gridEndMinutes = lastSlot.hour * 60 + lastSlot.minute + slotDuration;

  // Clamp booking to visible grid range.
  const clampedStart = Math.max(effectiveStartMinutes, gridStartMinutes);
  const clampedEnd = Math.min(effectiveEndMinutes, gridEndMinutes);
  if (clampedEnd <= clampedStart) return null;

  const startRowsFromGrid = (clampedStart - gridStartMinutes) / slotDuration;
  const rowSpan = (clampedEnd - clampedStart) / slotDuration;

  const startSlot = Math.floor(startRowsFromGrid);
  const startOffsetInSlot = startRowsFromGrid - startSlot;
  const endRowsFromGrid = startRowsFromGrid + rowSpan;
  const endSlot = Math.min(
    timeSlots.length - 1,
    Math.ceil(endRowsFromGrid) - 1
  );

  return {
    booking,
    startSlot,
    endSlot,
    rowSpan: Math.max(0.5, rowSpan), // Minimum visibility
    startOffsetInSlot,
  };
}

/**
 * Calculate booking blocks for each rack
 */
export function calculateBookingBlocksByRack(
  racks: number[],
  bookings: ActiveInstance[],
  timeSlots: TimeSlot[],
  currentDate: Date
): Map<number, BookingBlock[]> {
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
}
