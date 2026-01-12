import { useEffect, useState, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../../../schemas/bookingForm';
import {
  isTimeClosed,
  getAvailableTimeRanges,
  type ClosedPeriod,
} from '../capacity/useClosedTimes';
import { calculateEndTime } from './utils';

/**
 * Round a time string to the nearest 15-minute interval
 */
function roundTo15Minutes(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  const roundedHours = Math.floor(roundedMinutes / 60) % 24;
  const roundedMins = roundedMinutes % 60;
  return `${String(roundedHours).padStart(2, '0')}:${String(roundedMins).padStart(2, '0')}`;
}

/**
 * Hook to manage default time initialization based on closed times
 */
export function useTimeDefaults(
  form: UseFormReturn<BookingFormValues>,
  sideId: number | null,
  startDate: string | null,
  closedTimes: Set<string>,
  closedTimesLoading: boolean,
  closedPeriods?: ClosedPeriod[]
) {
  const [endTimeManuallyChanged, setEndTimeManuallyChanged] = useState(false);
  const [lastInitializedKey, setLastInitializedKey] = useState<string>('');

  const availableRanges = useMemo(() => {
    return getAvailableTimeRanges(closedTimes, closedPeriods);
  }, [closedTimes, closedPeriods]);

  const firstAvailableTime = useMemo(() => {
    if (availableRanges.length === 0) return '00:00';
    return availableRanges[0].start;
  }, [availableRanges]);

  const initializationKey = `${sideId}-${startDate}`;

  // Set default times when closed times are first loaded or when date/side changes
  useEffect(() => {
    // Wait for closed times to finish loading before setting defaults
    if (sideId && startDate && !closedTimesLoading) {
      // Only proceed if we have available ranges (should always have at least one)
      if (availableRanges.length === 0) {
        return;
      }

      const isNewDateOrSide = initializationKey !== lastInitializedKey;
      const currentStartTime = form.getValues('startTime');
      const currentEndTime = form.getValues('endTime');

      // Check if times appear to be pre-filled (not defaults)
      // If both start and end times are set and not at defaults, assume they're from initial values
      const hasCustomTimes =
        currentStartTime &&
        currentEndTime &&
        currentStartTime !== '07:00' &&
        currentStartTime !== '00:00' &&
        currentEndTime !== '08:30' &&
        !isTimeClosed(closedTimes, currentStartTime, closedPeriods);

      // Initialize on first load (lastInitializedKey is empty) or when date/side changes
      // Also update if current values are at hardcoded defaults (07:00/08:30) or closed times (00:00)
      // BUT don't override if times appear to be custom/pre-filled
      const needsUpdate =
        (isNewDateOrSide ||
          !lastInitializedKey ||
          !currentStartTime ||
          currentStartTime === '07:00' ||
          currentStartTime === '00:00' ||
          isTimeClosed(closedTimes, currentStartTime, closedPeriods)) &&
        !hasCustomTimes; // Don't override custom times

      if (needsUpdate) {
        // Reset manual change flag when date/side changes
        if (isNewDateOrSide || !lastInitializedKey) {
          setEndTimeManuallyChanged(false);
          setLastInitializedKey(initializationKey);
        }

        // Set start time to first available (which excludes closed times)
        // This should be 09:00 if facility is closed until 09:00
        // Round to nearest 15 minutes
        const newStartTime = roundTo15Minutes(firstAvailableTime);
        if (currentStartTime !== newStartTime) {
          form.setValue('startTime', newStartTime, { shouldValidate: false });
        }

        // Set end time to 90 minutes after start (rounded to 15 minutes)
        const calculatedEnd = calculateEndTime(newStartTime, 90, closedTimes);
        if (calculatedEnd) {
          const roundedEnd = roundTo15Minutes(calculatedEnd);
          if (currentEndTime !== roundedEnd) {
            form.setValue('endTime', roundedEnd, { shouldValidate: false });
          }
        } else {
          // Fallback: if calculation fails, set to 90 minutes manually and round
          const [startHour, startMinute] = newStartTime.split(':').map(Number);
          const endTotalMinutes = startHour * 60 + startMinute + 90;
          const endHour = Math.floor(endTotalMinutes / 60);
          const endMinute = endTotalMinutes % 60;
          if (endHour < 24) {
            const fallbackEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
            const roundedFallback = roundTo15Minutes(fallbackEnd);
            if (currentEndTime !== roundedFallback) {
              form.setValue('endTime', roundedFallback, {
                shouldValidate: false,
              });
            }
          }
        }
      } else if (hasCustomTimes && isNewDateOrSide) {
        // If we have custom times and it's a new date/side, just update the initialization key
        // but don't change the times
        setLastInitializedKey(initializationKey);
        // Mark end time as manually changed to prevent auto-update
        setEndTimeManuallyChanged(true);
      }
    }
  }, [
    sideId,
    startDate,
    closedTimesLoading,
    availableRanges,
    firstAvailableTime,
    closedTimes,
    closedPeriods,
    initializationKey,
    lastInitializedKey,
    form,
  ]);

  // Auto-update end time when start time changes (if not manually changed and we've initialized)
  const startTime = form.watch('startTime');
  useEffect(() => {
    // Only auto-update if we've initialized for this date/side and end time hasn't been manually changed
    if (
      !endTimeManuallyChanged &&
      startTime &&
      lastInitializedKey === initializationKey &&
      lastInitializedKey
    ) {
      const calculatedEnd = calculateEndTime(startTime, 90, closedTimes);
      if (calculatedEnd) {
        const roundedEnd = roundTo15Minutes(calculatedEnd);
        form.setValue('endTime', roundedEnd, { shouldValidate: true });
      }
    }
  }, [
    startTime,
    endTimeManuallyChanged,
    closedTimes,
    initializationKey,
    lastInitializedKey,
    form,
  ]);

  return {
    endTimeManuallyChanged,
    setEndTimeManuallyChanged,
    availableRanges,
    firstAvailableTime,
  };
}
