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
 * Calculate booking blocks for each rack.
 * Uses instance area_slots when present so racks show their actual allocated time (e.g. 09:00–10:00) not the full instance window (09:00–10:30).
 * When useMasterTime is true, always use the instance start/end (master window) for all racks and ignore area_slots, so blocks show the same time range with the same colours.
 */
export function calculateBookingBlocksByRack(
  racks: number[],
  bookings: ActiveInstance[],
  timeSlots: TimeSlot[],
  currentDate: Date,
  useMasterTime?: boolean
): Map<number, BookingBlock[]> {
  const blocksByRack = new Map<number, BookingBlock[]>();

  racks.forEach((rack) => {
    const blocks: BookingBlock[] = [];
    bookings.forEach((booking) => {
      if (!booking.racks.includes(rack)) return;
      const start = useMasterTime
        ? booking.start
        : (() => {
            const rackKey = `rack_${rack}`;
            const slot = booking.area_slots?.find(
              (s) => s.area_key === rackKey
            );
            return slot ? slot.start : booking.start;
          })();
      const end = useMasterTime
        ? booking.end
        : (() => {
            const rackKey = `rack_${rack}`;
            const slot = booking.area_slots?.find(
              (s) => s.area_key === rackKey
            );
            return slot ? slot.end : booking.end;
          })();
      const virtualBooking: ActiveInstance = {
        ...booking,
        start,
        end,
      };
      const block = getBookingBlocks(virtualBooking, timeSlots, currentDate);
      if (block) {
        blocks.push(block);
      }
    });
    blocksByRack.set(rack, blocks);
  });

  return blocksByRack;
}

/**
 * One block per instance for master view (no dedupe by bookingId).
 * Each instance is shown with its full facility time (start/end). Same colours as platform view.
 * This ensures multiple bookings at the same time, or multiple sessions of the same booking on the same day, all appear.
 */
export function calculateMasterBlocks(
  bookings: ActiveInstance[],
  timeSlots: TimeSlot[],
  currentDate: Date
): BookingBlock[] {
  const blocks: BookingBlock[] = [];
  for (const booking of bookings) {
    const block = getBookingBlocks(booking, timeSlots, currentDate);
    if (block) blocks.push(block);
  }
  return blocks;
}

/**
 * Assign each block to a horizontal lane so overlapping blocks get different lanes (side-by-side).
 * Returns Map<laneIndex, BookingBlock[]> and the number of lanes (at least minLanes).
 */
export function assignMasterBlocksToLanes(
  blocks: BookingBlock[],
  minLanes: number = 8
): { blocksByLane: Map<number, BookingBlock[]>; numLanes: number } {
  const blocksByLane = new Map<number, BookingBlock[]>();
  if (blocks.length === 0) {
    for (let i = 0; i < minLanes; i++) blocksByLane.set(i, []);
    return { blocksByLane, numLanes: minLanes };
  }
  const sorted = [...blocks].sort((a, b) => a.startSlot - b.startSlot);
  const laneOfBlock = new Map<BookingBlock, number>();

  function overlaps(a: BookingBlock, b: BookingBlock): boolean {
    return !(a.endSlot < b.startSlot || b.endSlot < a.startSlot);
  }

  for (const block of sorted) {
    const usedLanes = new Set<number>();
    for (const [other, lane] of laneOfBlock) {
      if (overlaps(block, other)) usedLanes.add(lane);
    }
    let lane = 0;
    while (usedLanes.has(lane)) lane++;
    laneOfBlock.set(block, lane);
  }

  const numLanes = Math.max(
    minLanes,
    Math.max(...Array.from(laneOfBlock.values())) + 1
  );
  for (let i = 0; i < numLanes; i++) blocksByLane.set(i, []);
  for (const [block, lane] of laneOfBlock) {
    blocksByLane.get(lane)!.push(block);
  }
  return { blocksByLane, numLanes };
}
