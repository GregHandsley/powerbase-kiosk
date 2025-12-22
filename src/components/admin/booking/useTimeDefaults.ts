import { useEffect, useState, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "../../../schemas/bookingForm";
import { isTimeClosed, getAvailableTimeRanges } from "../capacity/useClosedTimes";
import { calculateEndTime } from "./utils";

/**
 * Hook to manage default time initialization based on closed times
 */
export function useTimeDefaults(
  form: UseFormReturn<BookingFormValues>,
  sideId: number | null,
  startDate: string | null,
  closedTimes: Set<string>,
  closedTimesLoading: boolean
) {
  const [endTimeManuallyChanged, setEndTimeManuallyChanged] = useState(false);
  const [lastInitializedKey, setLastInitializedKey] = useState<string>("");

  const availableRanges = useMemo(() => {
    return getAvailableTimeRanges(closedTimes);
  }, [closedTimes]);

  const firstAvailableTime = useMemo(() => {
    if (availableRanges.length === 0) return "00:00";
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
      const currentStartTime = form.getValues("startTime");
      const currentEndTime = form.getValues("endTime");
      
      // Initialize on first load (lastInitializedKey is empty) or when date/side changes
      // Also update if current values are at hardcoded defaults (07:00/08:30) or closed times (00:00)
      const needsUpdate = isNewDateOrSide || 
                         !lastInitializedKey || 
                         !currentStartTime || 
                         currentStartTime === "07:00" || 
                         currentStartTime === "00:00" ||
                         isTimeClosed(closedTimes, currentStartTime);
      
      if (needsUpdate) {
        // Reset manual change flag when date/side changes
        if (isNewDateOrSide || !lastInitializedKey) {
          setEndTimeManuallyChanged(false);
          setLastInitializedKey(initializationKey);
        }
        
        // Set start time to first available (which excludes closed times)
        // This should be 09:00 if facility is closed until 09:00
        const newStartTime = firstAvailableTime;
        if (currentStartTime !== newStartTime) {
          form.setValue("startTime", newStartTime, { shouldValidate: false });
        }
        
        // Set end time to 90 minutes after start
        const calculatedEnd = calculateEndTime(newStartTime, 90, closedTimes);
        if (calculatedEnd && currentEndTime !== calculatedEnd) {
          form.setValue("endTime", calculatedEnd, { shouldValidate: false });
        } else if (!calculatedEnd) {
          // Fallback: if calculation fails, set to 90 minutes manually
          const [startHour, startMinute] = newStartTime.split(":").map(Number);
          const endTotalMinutes = startHour * 60 + startMinute + 90;
          const endHour = Math.floor(endTotalMinutes / 60);
          const endMinute = endTotalMinutes % 60;
          if (endHour < 24) {
            const fallbackEnd = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
            if (currentEndTime !== fallbackEnd) {
              form.setValue("endTime", fallbackEnd, { shouldValidate: false });
            }
          }
        }
      }
    }
  }, [sideId, startDate, closedTimesLoading, availableRanges, firstAvailableTime, closedTimes, initializationKey, lastInitializedKey, form]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update end time when start time changes (if not manually changed and we've initialized)
  const startTime = form.watch("startTime");
  useEffect(() => {
    // Only auto-update if we've initialized for this date/side and end time hasn't been manually changed
    if (!endTimeManuallyChanged && startTime && lastInitializedKey === initializationKey && lastInitializedKey) {
      const calculatedEnd = calculateEndTime(startTime, 90, closedTimes);
      if (calculatedEnd) {
        form.setValue("endTime", calculatedEnd, { shouldValidate: true });
      }
    }
  }, [startTime, endTimeManuallyChanged, closedTimes, initializationKey, lastInitializedKey, form]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    endTimeManuallyChanged,
    setEndTimeManuallyChanged,
    availableRanges,
    firstAvailableTime,
  };
}

