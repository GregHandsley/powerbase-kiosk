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
  const bookingStart = new Date(booking.start);
  const bookingEnd = new Date(booking.end);
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  // Check if booking overlaps with the current date
  const bookingStartDate = format(bookingStart, 'yyyy-MM-dd');
  const bookingEndDate = format(bookingEnd, 'yyyy-MM-dd');

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

  const bookingStartMinutes = effectiveStartHour * 60 + effectiveStartMinute;
  const bookingEndMinutes = effectiveEndHour * 60 + effectiveEndMinute;

  timeSlots.forEach((slot, index) => {
    const slotHour = slot.hour;
    const slotMinute = slot.minute;
    const slotStartMinutes = slotHour * 60 + slotMinute;

    // Check if this slot is the start slot (slot start time >= booking start time)
    if (startSlot === -1) {
      if (slotStartMinutes >= bookingStartMinutes) {
        startSlot = index;
      }
    }

    // Find the last slot that starts before the booking ends
    // This will be the slot that contains or is just before the end time
    if (slotStartMinutes < bookingEndMinutes) {
      endSlot = index;
    }
  });

  // If booking extends beyond the last slot, set endSlot to the last slot
  if (endSlot === -1) {
    endSlot = timeSlots.length - 1;
  }

  // If booking starts before the first slot, set startSlot to 0
  if (startSlot === -1) {
    startSlot = 0;
  }

  if (startSlot > endSlot) {
    return null; // Invalid range
  }

  // Calculate the exact height based on the actual end time
  const endSlotTime = timeSlots[endSlot];
  const endSlotStartMinutes = endSlotTime.hour * 60 + endSlotTime.minute;
  const slotDuration = 30; // 30 minutes per slot

  // Calculate how much of the end slot the booking occupies
  let rowSpan: number;
  if (bookingEndMinutes <= endSlotStartMinutes) {
    // Booking ends before or at the start of the end slot, so don't include it
    if (endSlot > startSlot) {
      rowSpan = endSlot - startSlot;
      endSlot = endSlot - 1;
    } else {
      // Booking is very short, less than one slot
      rowSpan = 0.5; // Minimum visibility
    }
  } else {
    // Booking ends within the end slot, calculate partial height
    const partialHeight =
      (bookingEndMinutes - endSlotStartMinutes) / slotDuration;
    rowSpan = endSlot - startSlot + partialHeight;
  }

  // Ensure we have at least one slot
  if (startSlot > endSlot) {
    return null;
  }

  return {
    booking,
    startSlot,
    endSlot,
    rowSpan: Math.max(0.5, rowSpan), // Minimum 0.5 to ensure visibility
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
