import { format, getDay } from 'date-fns';
import type { TimeSlot } from '../../../admin/capacity/scheduleUtils';
import type { ActiveInstance } from '../../../../types/snapshot';
import {
  doesScheduleApply,
  parseExcludedDates,
  formatTimeSlot,
  type ScheduleData,
} from '../../../admin/capacity/scheduleUtils';

/**
 * Combine date string (yyyy-mm-dd) and time string (HH:mm) into a Date object
 */
function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Calculate which time slots have exceeded capacity
 * Returns a map of slotIndex -> Set of rack numbers that are unavailable due to capacity
 */
export function calculateCapacityExceededSlots(
  timeSlots: TimeSlot[],
  currentDate: Date,
  bookings: ActiveInstance[],
  capacitySchedules: ScheduleData[]
  // sideId: number
): Map<number, Set<number>> {
  const capacityExceededBySlot = new Map<number, Set<number>>();
  const dayOfWeek = getDay(currentDate);
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  // For each time slot, calculate capacity usage
  timeSlots.forEach((slot, slotIndex) => {
    const timeStr = formatTimeSlot(slot);

    // Find applicable schedule for this time slot
    const applicableSchedule = capacitySchedules.find((schedule) => {
      const scheduleData: ScheduleData = {
        ...schedule,
        excluded_dates: parseExcludedDates(schedule.excluded_dates),
      };
      return doesScheduleApply(scheduleData, dayOfWeek, dateStr, timeStr);
    });

    if (!applicableSchedule || applicableSchedule.period_type === 'Closed') {
      return; // No capacity limit or closed period
    }

    const capacityLimit = applicableSchedule.capacity;
    if (capacityLimit === null || capacityLimit === undefined) {
      return; // No capacity limit set
    }

    // Calculate total capacity usage at this time slot
    const slotDateTime = combineDateAndTime(dateStr, timeStr);
    let totalCapacityUsed = 0;

    // Sum capacity from all bookings that overlap with this time slot
    bookings.forEach((booking) => {
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);

      // Check if booking overlaps with this time slot
      // A booking overlaps if it starts before or at the slot time and ends after the slot time
      if (bookingStart <= slotDateTime && bookingEnd > slotDateTime) {
        totalCapacityUsed += booking.capacity || 0;
      }
    });

    // If capacity is exceeded, mark all platforms as unavailable
    if (totalCapacityUsed >= capacityLimit) {
      // Use an empty set to indicate ALL racks are at capacity
      // The component will check if a specific rack is already booked
      capacityExceededBySlot.set(slotIndex, new Set<number>());
    }
  });

  return capacityExceededBySlot;
}

/**
 * Check if a specific rack at a specific time slot is at capacity
 */
export function isRackAtCapacity(
  slotIndex: number,
  rack: number,
  capacityExceededBySlot: Map<number, Set<number>>,
  bookings: ActiveInstance[],
  currentDate: Date,
  timeSlots: TimeSlot[]
): boolean {
  // Check if this slot has capacity exceeded
  const exceededRacks = capacityExceededBySlot.get(slotIndex);
  if (!exceededRacks) {
    return false;
  }

  // If the set is empty, it means ALL racks are at capacity
  // Check if this rack is already booked - if so, it's not "at capacity" (it's just booked)
  const slot = timeSlots[slotIndex];
  if (!slot) return true;

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const timeStr = formatTimeSlot(slot);
  const slotDateTime = combineDateAndTime(dateStr, timeStr);

  // If this rack is already booked, it's not "at capacity" (it's just booked)
  const isBooked = bookings.some((booking) => {
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    return (
      booking.racks.includes(rack) &&
      bookingStart <= slotDateTime &&
      bookingEnd > slotDateTime
    );
  });

  // At capacity if capacity is exceeded AND this rack is not already booked
  return !isBooked;
}
