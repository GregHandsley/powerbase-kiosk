import { useState, useEffect, useMemo, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../../../schemas/bookingForm';

/**
 * Hook to manage week-by-week platform and capacity selection
 */
export function useWeekManagement(form: UseFormReturn<BookingFormValues>) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [racksByWeek, setRacksByWeek] = useState<Map<number, number[]>>(
    new Map()
  );
  const [applyToAllWeeks, setApplyToAllWeeks] = useState(true); // Default to true for convenience
  const [capacityByWeek, setCapacityByWeek] = useState<Map<number, number>>(
    new Map()
  );

  const weeksCount = form.watch('weeks') || 1;
  const watchedCapacity = useWatch({
    control: form.control,
    name: 'capacity',
  });

  // Initialize racksByWeek when weeks count changes
  useEffect(() => {
    const newMap = new Map(racksByWeek);
    // Remove weeks that are beyond the new count
    for (let i = weeksCount; i < 20; i++) {
      newMap.delete(i);
    }
    // Initialize empty arrays for new weeks
    for (let i = 0; i < weeksCount; i++) {
      if (!newMap.has(i)) {
        newMap.set(i, []);
      }
    }
    setRacksByWeek(newMap);
    // Reset to first week if current week is out of bounds
    if (currentWeekIndex >= weeksCount) {
      setCurrentWeekIndex(0);
    }
  }, [weeksCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize capacityByWeek when weeks count changes
  useEffect(() => {
    const newMap = new Map(capacityByWeek);
    // Remove weeks that are beyond the new count
    for (let i = weeksCount; i < 20; i++) {
      newMap.delete(i);
    }
    // Initialize with form's default capacity for new weeks
    const defaultCapacity = form.watch('capacity') || 1;
    for (let i = 0; i < weeksCount; i++) {
      if (!newMap.has(i)) {
        newMap.set(i, defaultCapacity);
      }
    }
    setCapacityByWeek(newMap);
  }, [weeksCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get capacity for current week
  const currentWeekCapacity = useMemo(() => {
    return capacityByWeek.get(currentWeekIndex) || watchedCapacity || 1;
  }, [capacityByWeek, currentWeekIndex, watchedCapacity]);

  // When applyToAllWeeks changes to true, sync all weeks with current week's selection (racks and capacity)
  useEffect(() => {
    if (applyToAllWeeks && weeksCount > 1) {
      const currentRacks = racksByWeek.get(currentWeekIndex) || [];
      const currentCapacity =
        capacityByWeek.get(currentWeekIndex) || form.watch('capacity') || 1;
      // Always sync, even if empty (so all weeks are consistent)
      const newRacksMap = new Map(racksByWeek);
      const newCapacityMap = new Map(capacityByWeek);
      for (let i = 0; i < weeksCount; i++) {
        newRacksMap.set(i, [...currentRacks]); // Create a copy to avoid reference issues
        newCapacityMap.set(i, currentCapacity);
      }
      setRacksByWeek(newRacksMap);
      setCapacityByWeek(newCapacityMap);
    }
  }, [applyToAllWeeks, weeksCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize racksByWeek from racksInput when form is reset with initial values
  // This handles the case when the form is pre-filled (e.g., from drag selection)
  // Only initialize when racksByWeek is empty (initial state) to avoid conflicts with user selections
  const racksInput = form.watch('racksInput');
  const hasInitializedFromInputRef = useRef(false);

  useEffect(() => {
    // Check if racksByWeek is empty (all weeks have no racks selected)
    const allWeeksEmpty = Array.from(
      { length: weeksCount },
      (_, i) => racksByWeek.get(i) || []
    ).every((racks) => racks.length === 0);

    if (
      racksInput &&
      racksInput.trim() &&
      allWeeksEmpty &&
      !hasInitializedFromInputRef.current
    ) {
      // Parse racksInput (can be comma or space separated, e.g., "3, 4, 5" or "3 4 5")
      const parsedRacks = racksInput
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
        .sort((a, b) => a - b);

      if (parsedRacks.length > 0) {
        // Update week 0 (and all weeks if applyToAllWeeks is true)
        const newMap = new Map(racksByWeek);
        if (applyToAllWeeks && weeksCount > 1) {
          for (let i = 0; i < weeksCount; i++) {
            newMap.set(i, [...parsedRacks]);
          }
        } else {
          newMap.set(0, [...parsedRacks]);
        }
        setRacksByWeek(newMap);
        hasInitializedFromInputRef.current = true;
      }
    }

    // Reset the flag when racksByWeek becomes empty again (form was reset)
    if (allWeeksEmpty && hasInitializedFromInputRef.current) {
      hasInitializedFromInputRef.current = false;
    }
  }, [racksInput, racksByWeek, applyToAllWeeks, weeksCount]);

  // Get selected racks for current week
  const selectedPlatforms = useMemo(() => {
    return racksByWeek.get(currentWeekIndex) || [];
  }, [racksByWeek, currentWeekIndex]);

  const handlePlatformSelectionChange = (selected: number[]) => {
    const newMap = new Map(racksByWeek);

    // Normal selection behavior
    if (applyToAllWeeks && weeksCount > 1) {
      // Apply to all weeks
      for (let i = 0; i < weeksCount; i++) {
        newMap.set(i, selected);
      }
    } else {
      // Apply only to current week
      newMap.set(currentWeekIndex, selected);
    }

    setRacksByWeek(newMap);
    // Also update the form's racksInput for validation (use first week's selection as default)
    if (currentWeekIndex === 0 || applyToAllWeeks) {
      form.setValue('racksInput', selected.join(','), { shouldValidate: true });
    }
  };

  const handleCapacityChange = (value: number) => {
    form.setValue('capacity', value);
    // Update current week's capacity
    if (applyToAllWeeks && weeksCount > 1) {
      const newMap = new Map(capacityByWeek);
      for (let i = 0; i < weeksCount; i++) {
        newMap.set(i, value);
      }
      setCapacityByWeek(newMap);
    } else {
      const newMap = new Map(capacityByWeek);
      newMap.set(currentWeekIndex, value);
      setCapacityByWeek(newMap);
    }
  };

  return {
    currentWeekIndex,
    setCurrentWeekIndex,
    racksByWeek,
    capacityByWeek,
    applyToAllWeeks,
    setApplyToAllWeeks,
    selectedPlatforms,
    currentWeekCapacity,
    weeksCount,
    handlePlatformSelectionChange,
    handleCapacityChange,
    setRacksByWeek,
    setCapacityByWeek,
  };
}
