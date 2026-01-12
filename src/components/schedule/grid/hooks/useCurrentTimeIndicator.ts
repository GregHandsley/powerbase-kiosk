import { useState, useEffect, useMemo } from 'react';
import { isSameDay } from 'date-fns';
import type { TimeSlot } from '../../../admin/capacity/scheduleUtils';

export function useCurrentTimeIndicator(
  currentDate: Date,
  timeSlots: TimeSlot[]
): { slotIndex: number; top: number } | null {
  const [currentTime, setCurrentTime] = useState(new Date());
  const isToday = isSameDay(currentDate, new Date());

  // Update current time every minute
  useEffect(() => {
    if (!isToday) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isToday]);

  // Calculate current time position
  const currentTimePosition = useMemo(() => {
    if (!isToday) return null;

    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Find the slot index for the current time
    // Each slot is 30 minutes, so we need to find which slot contains the current time
    let slotIndex = -1;
    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      const slotHour = slot.hour;
      const slotMinute = slot.minute;

      // Check if current time is at or after this slot
      if (
        currentHour > slotHour ||
        (currentHour === slotHour && currentMinute >= slotMinute)
      ) {
        // Check if current time is before the next slot
        if (i < timeSlots.length - 1) {
          const nextSlot = timeSlots[i + 1];
          const nextSlotHour = nextSlot.hour;
          const nextSlotMinute = nextSlot.minute;

          if (
            currentHour < nextSlotHour ||
            (currentHour === nextSlotHour && currentMinute < nextSlotMinute)
          ) {
            slotIndex = i;
            break;
          }
        } else {
          // Last slot
          slotIndex = i;
          break;
        }
      }
    }

    if (slotIndex === -1) return null;

    // Calculate the exact position within the slot (0-1, where 0 is top of slot, 1 is bottom)
    const slot = timeSlots[slotIndex];
    const slotStartMinutes = slot.hour * 60 + slot.minute;
    const currentMinutes = currentHour * 60 + currentMinute;
    const slotDuration = 30; // 30 minutes per slot

    const positionInSlot = (currentMinutes - slotStartMinutes) / slotDuration;

    // Each slot row is 50px high
    const rowHeight = 50;
    const headerHeight = 50; // Approximate header height
    const topPosition =
      headerHeight + slotIndex * rowHeight + positionInSlot * rowHeight;

    return {
      slotIndex,
      top: topPosition,
    };
  }, [isToday, currentTime, timeSlots]);

  return currentTimePosition;
}
