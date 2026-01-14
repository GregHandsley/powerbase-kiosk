import { useState, useEffect, useMemo } from 'react';
import { format, getDay, startOfWeek, addDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
// import { getSideIdByKeyNode, type SideKey } from '../../nodes/data/sidesNodes';
import { useCapacityDefaults } from './capacity/useCapacityDefaults';
import { CapacityEditForm } from './capacity/CapacityEditForm';
import {
  useClosedTimes,
  isTimeClosed,
  // isTimeRangeClosed,
  type ClosedPeriod,
} from './capacity/useClosedTimes';
import { supabase } from '../../lib/supabaseClient';
import {
  doesScheduleApply,
  parseExcludedDates,
  type ScheduleData,
} from './capacity/scheduleUtils';

type RecurrenceType =
  | 'single'
  | 'weekday'
  | 'weekend'
  | 'all_future'
  | 'weekly';
type PeriodType =
  | 'High Hybrid'
  | 'Low Hybrid'
  | 'Performance'
  | 'General User'
  | 'Closed';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    capacity: number;
    periodType: PeriodType;
    recurrenceType: RecurrenceType;
    startTime: string;
    endTime: string;
    platforms: number[];
  }) => Promise<void>;
  onDelete?: () => void;
  initialDate: Date;
  initialTime: string; // HH:mm format
  initialEndTime?: string; // HH:mm format
  sideId: number;
  sideKey: 'Power' | 'Base';
  existingCapacity?: {
    capacity: number;
    periodType: PeriodType;
    platforms?: number[];
  } | null;
  existingRecurrenceType?: RecurrenceType;
};

export function CapacityEditModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialTime,
  initialEndTime,
  sideId,
  sideKey,
  existingCapacity,
  existingRecurrenceType,
}: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>(
    existingCapacity?.periodType || 'General User'
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    existingRecurrenceType || 'single'
  );
  const [startTime, setStartTime] = useState(initialTime);
  const [endTime, setEndTime] = useState(initialEndTime || '23:59');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityOverride, setCapacityOverride] = useState<number | null>(
    existingCapacity?.capacity || null
  );
  const [useOverride, setUseOverride] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>(
    existingCapacity?.platforms || []
  );

  // Fetch default capacity and platforms
  const { defaultCapacity, defaultPlatforms, loadingDefault } =
    useCapacityDefaults(
      isOpen,
      periodType,
      sideId,
      existingCapacity?.platforms
    );

  // Fetch closed times for the selected date
  const dateStr = format(initialDate, 'yyyy-MM-dd');
  const {
    closedTimes,
    closedPeriods,
    // isLoading: closedTimesLoading,
  } = useClosedTimes(sideId, dateStr);

  // Fetch all capacity schedules for the selected date to check for overlaps
  const dayOfWeek = getDay(initialDate);
  const weekStart = startOfWeek(initialDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  const { data: allSchedules = [] } = useQuery({
    queryKey: ['capacity-schedules-for-adaptive-end', sideId, dateStr],
    queryFn: async () => {
      if (!sideId) return [];

      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('capacity_schedules')
        .select('*')
        .eq('side_id', sideId)
        .lte('start_date', weekEndStr)
        .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

      if (error) {
        console.error('Error fetching capacity schedules:', error);
        return [];
      }

      return (data ?? []).map((schedule) => ({
        ...schedule,
        excluded_dates: parseExcludedDates(schedule.excluded_dates),
        platforms: Array.isArray(schedule.platforms) ? schedule.platforms : [],
      })) as ScheduleData[];
    },
    enabled: !!sideId && isOpen,
  });

  // Calculate adaptive default end time based on all schedules (not just closed periods)
  const adaptiveEndTime = useMemo(() => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    // Find all schedules that apply to this date
    const applicableSchedules = allSchedules.filter((schedule) => {
      // Check if schedule applies to this date by checking day_of_week and date range
      // Check if date is excluded
      if (schedule.excluded_dates?.includes(dateStr)) {
        return false;
      }

      // Check if schedule applies to this day of week
      if (schedule.recurrence_type === 'single') {
        return (
          schedule.day_of_week === dayOfWeek && schedule.start_date === dateStr
        );
      } else if (schedule.recurrence_type === 'weekday') {
        return (
          schedule.day_of_week === dayOfWeek &&
          dayOfWeek >= 1 &&
          dayOfWeek <= 5 &&
          schedule.start_date <= dateStr &&
          (!schedule.end_date || schedule.end_date >= dateStr)
        );
      } else if (schedule.recurrence_type === 'weekend') {
        return (
          schedule.day_of_week === dayOfWeek &&
          (dayOfWeek === 0 || dayOfWeek === 6) &&
          schedule.start_date <= dateStr &&
          (!schedule.end_date || schedule.end_date >= dateStr)
        );
      } else if (schedule.recurrence_type === 'weekly') {
        return (
          schedule.day_of_week === dayOfWeek &&
          schedule.start_date <= dateStr &&
          (!schedule.end_date || schedule.end_date >= dateStr)
        );
      } else if (schedule.recurrence_type === 'all_future') {
        return (
          schedule.day_of_week === dayOfWeek &&
          schedule.start_date <= dateStr &&
          (!schedule.end_date || schedule.end_date >= dateStr)
        );
      }
      return false;
    });

    // Find the earliest start time of any schedule that starts after our start time
    // This ensures we don't overlap with any existing schedule
    let earliestStart: number | null = null;

    // Check all applicable schedules
    for (const schedule of applicableSchedules) {
      const [scheduleStartHour, scheduleStartMinute] = schedule.start_time
        .split(':')
        .map(Number);
      const scheduleStartMinutes = scheduleStartHour * 60 + scheduleStartMinute;

      // Find schedules that start after our start time (we need to end before they start)
      if (scheduleStartMinutes > startMinutes) {
        if (earliestStart === null || scheduleStartMinutes < earliestStart) {
          earliestStart = scheduleStartMinutes;
        }
      }
    }

    // Also check closed periods (they take priority - must end before closed period starts)
    for (const period of closedPeriods) {
      const [periodStartHour, periodStartMinute] = period.startTime
        .split(':')
        .map(Number);
      const periodStartMinutes = periodStartHour * 60 + periodStartMinute;

      if (periodStartMinutes > startMinutes) {
        if (earliestStart === null || periodStartMinutes < earliestStart) {
          earliestStart = periodStartMinutes;
        }
      }
    }

    // If we found a schedule or closed period, use its start time as the default end time
    if (earliestStart !== null) {
      const hours = Math.floor(earliestStart / 60);
      const minutes = earliestStart % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return '23:59'; // No schedule found after start time
  }, [startTime, allSchedules, closedPeriods, dayOfWeek, dateStr]);

  // Initialize selected platforms from defaults if not set
  // For "Closed" period type, always use empty array (no platforms)
  useEffect(() => {
    if (periodType === 'Closed') {
      setSelectedPlatforms([]);
    } else if (
      isOpen &&
      !existingCapacity?.platforms &&
      defaultPlatforms.length > 0
    ) {
      setSelectedPlatforms(defaultPlatforms);
    }
  }, [isOpen, existingCapacity?.platforms, defaultPlatforms, periodType]);

  // Update capacity override when default capacity or existing capacity changes
  useEffect(() => {
    if (isOpen && existingCapacity && defaultCapacity !== null) {
      const hasOverride = existingCapacity.capacity !== defaultCapacity;
      setUseOverride(hasOverride);
      if (hasOverride) {
        setCapacityOverride(existingCapacity.capacity);
      } else {
        setCapacityOverride(null);
      }
    } else if (isOpen && !existingCapacity) {
      setUseOverride(false);
      setCapacityOverride(null);
    }
  }, [isOpen, existingCapacity, defaultCapacity]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPeriodType(existingCapacity?.periodType || 'General User');
      // When editing existing, preserve the original recurrence type (don't force to 'single')
      // When creating new, allow any recurrence type
      setRecurrenceType(
        existingCapacity
          ? existingRecurrenceType || 'single'
          : existingRecurrenceType || 'single'
      );
      setStartTime(initialTime);
      // Use adaptive end time if no initial end time is provided
      setEndTime(initialEndTime || adaptiveEndTime);
      // For "Closed" period type, always use empty array (no platforms)
      if (existingCapacity?.periodType === 'Closed') {
        setSelectedPlatforms([]);
      } else {
        setSelectedPlatforms(existingCapacity?.platforms || []);
      }
      setError(null);
    }
  }, [
    isOpen,
    initialTime,
    initialEndTime,
    existingCapacity,
    existingRecurrenceType,
    adaptiveEndTime,
  ]);

  // Update end time when start time changes (if no initial end time)
  useEffect(() => {
    if (isOpen && !initialEndTime && !existingCapacity) {
      setEndTime(adaptiveEndTime);
    }
  }, [isOpen, startTime, adaptiveEndTime, initialEndTime, existingCapacity]);

  // When period type changes to "Closed", enforce no platforms and capacity 0
  useEffect(() => {
    if (periodType === 'Closed') {
      setSelectedPlatforms([]);
      setCapacityOverride(0);
      setUseOverride(false);
    }
  }, [periodType]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (endTime <= startTime) {
      setError('End time must be after start time');
      return;
    }

    // Validate that end time doesn't extend into closed periods
    // Pass isEndTime: true to allow end times that are exactly at the start of a closed period
    if (isTimeClosed(closedTimes, endTime, closedPeriods, true)) {
      setError(
        'End time cannot extend into a closed period. Please choose an earlier end time.'
      );
      return;
    }

    // Validate that the time range doesn't overlap with closed periods
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Check if any part of the time range overlaps with closed periods
    for (const period of closedPeriods) {
      const [periodStartHour, periodStartMinute] = period.startTime
        .split(':')
        .map(Number);
      const [periodEndHour, periodEndMinute] = period.endTime
        .split(':')
        .map(Number);
      const periodStartMinutes = periodStartHour * 60 + periodStartMinute;
      const periodEndMinutes = periodEndHour * 60 + periodEndMinute;

      // Check if time ranges overlap
      // Our range: [startMinutes, endMinutes) - exclusive end
      // Closed period: [periodStartMinutes, periodEndMinutes) - exclusive end
      // They overlap if: startMinutes < periodEndMinutes && endMinutes > periodStartMinutes
      // BUT: if endMinutes === periodStartMinutes, that's allowed (booking ends exactly when closed period starts)
      if (
        startMinutes < periodEndMinutes &&
        endMinutes > periodStartMinutes &&
        endMinutes !== periodStartMinutes
      ) {
        setError(
          'This time range overlaps with a closed period. Please adjust the start or end time.'
        );
        return;
      }
    }

    // For recurring schedules, validate the entire chain
    // We need to check closed times for all dates that this schedule will apply to
    if (recurrenceType !== 'single') {
      try {
        // Import the validation function
        const { isTimeRangeClosed } = await import('./capacity/useClosedTimes');

        // Check the next 8 weeks to validate the chain
        // This covers weekday (5 days/week * 8 weeks = 40 days), weekend (2 days/week * 8 weeks = 16 days),
        // weekly (8 occurrences), and all_future (8 occurrences)
        const datesToCheck: Date[] = [];
        // const today = new Date(initialDate);
        // const dayOfWeek = today.getDay();

        if (recurrenceType === 'weekday') {
          // Check next 8 weeks of weekdays (Mon-Fri)
          for (let week = 0; week < 8; week++) {
            for (let day = 1; day <= 5; day++) {
              const date = new Date(initialDate);
              // Calculate days to add: get to the start of the week, then add week offset and day offset
              const currentDayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
              const daysToMonday =
                currentDayOfWeek === 0 ? 1 : 1 - currentDayOfWeek;
              const daysToAdd = week * 7 + daysToMonday + (day - 1);
              date.setDate(initialDate.getDate() + daysToAdd);
              if (date >= initialDate) {
                datesToCheck.push(date);
              }
            }
          }
        } else if (recurrenceType === 'weekend') {
          // Check next 8 weeks of weekends (Sat-Sun)
          for (let week = 0; week < 8; week++) {
            for (const day of [6, 0]) {
              const date = new Date(initialDate);
              const currentDayOfWeek = date.getDay();
              // Get to Saturday of current week
              const daysToSaturday =
                day === 6
                  ? (6 - currentDayOfWeek + 7) % 7 || 7
                  : (0 - currentDayOfWeek + 7) % 7 || 7;
              const daysToAdd = week * 7 + daysToSaturday;
              date.setDate(initialDate.getDate() + daysToAdd);
              if (date >= initialDate) {
                datesToCheck.push(date);
              }
            }
          }
        } else if (
          recurrenceType === 'weekly' ||
          recurrenceType === 'all_future'
        ) {
          // Check next 8 occurrences (same day of week)
          for (let week = 0; week < 8; week++) {
            const date = new Date(initialDate);
            date.setDate(initialDate.getDate() + week * 7);
            if (date >= initialDate) {
              datesToCheck.push(date);
            }
          }
        }

        // Helper function to fetch closed times for a specific date
        const fetchClosedTimesForDate = async (
          sideId: number,
          dateStr: string
        ): Promise<{
          closedTimes: Set<string>;
          closedPeriods: ClosedPeriod[];
        }> => {
          const dayOfWeek = getDay(new Date(dateStr));
          const dateObj = new Date(dateStr);
          const weekStart = new Date(dateObj);
          weekStart.setDate(dateObj.getDate() - dayOfWeek);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);

          const { data, error } = await supabase
            .from('capacity_schedules')
            .select('*')
            .eq('side_id', sideId)
            .eq('period_type', 'Closed')
            .lte('start_date', format(weekEnd, 'yyyy-MM-dd'))
            .or(
              `end_date.is.null,end_date.gte.${format(weekStart, 'yyyy-MM-dd')}`
            );

          if (error) {
            console.error('Error fetching closed times:', error);
            return { closedTimes: new Set(), closedPeriods: [] };
          }

          const closedTimeSet = new Set<string>();
          const periods: ClosedPeriod[] = [];

          data?.forEach((schedule) => {
            const scheduleData: ScheduleData = {
              ...schedule,
              excluded_dates: parseExcludedDates(schedule.excluded_dates),
            };

            const appliesToDate = doesScheduleApply(
              scheduleData,
              dayOfWeek,
              dateStr,
              schedule.start_time
            );

            if (appliesToDate) {
              periods.push({
                startTime: schedule.start_time,
                endTime: schedule.end_time,
              });

              const startHour = parseInt(schedule.start_time.split(':')[0]);
              const endHour = parseInt(schedule.end_time.split(':')[0]);

              for (let h = startHour; h < endHour; h++) {
                closedTimeSet.add(`${String(h).padStart(2, '0')}:00`);
              }
            }
          });

          return { closedTimes: closedTimeSet, closedPeriods: periods };
        };

        // Check each date in the chain
        for (const checkDate of datesToCheck) {
          const checkDateStr = format(checkDate, 'yyyy-MM-dd');
          const {
            closedTimes: checkClosedTimes,
            closedPeriods: checkClosedPeriods,
          } = await fetchClosedTimesForDate(sideId!, checkDateStr);

          if (
            isTimeRangeClosed(
              checkClosedTimes,
              startTime,
              endTime,
              checkClosedPeriods
            )
          ) {
            setError(
              `This time range overlaps with a closed period on ${format(
                checkDate,
                'EEEE, MMM d, yyyy'
              )}. Please adjust the start or end time.`
            );
            return;
          }
        }
      } catch (err) {
        console.error('Error validating chain:', err);
        // Don't block save if validation fails, but log the error
      }
    }

    // For "Closed" period type, enforce capacity 0 and no platforms
    const finalCapacity =
      periodType === 'Closed'
        ? 0
        : useOverride && capacityOverride !== null
          ? capacityOverride
          : defaultCapacity;
    const finalPlatforms = periodType === 'Closed' ? [] : selectedPlatforms;

    if (finalCapacity === null) {
      setError(
        'No default capacity set for this period type. Please set a default capacity first.'
      );
      return;
    }

    if (finalCapacity < 0) {
      setError('Capacity cannot be negative');
      return;
    }

    // Validate that closed periods have no platforms
    if (periodType === 'Closed' && finalPlatforms.length > 0) {
      setError('Closed periods cannot have platforms selected.');
      return;
    }

    // Validate that closed periods have capacity 0
    if (periodType === 'Closed' && finalCapacity !== 0) {
      setError('Closed periods must have capacity of 0.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        capacity: finalCapacity,
        periodType,
        recurrenceType,
        startTime,
        endTime,
        platforms: finalPlatforms,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save capacity');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DELETE] Delete button clicked in CapacityEditModal', {
      hasOnDelete: !!onDelete,
    });
    if (!onDelete) {
      console.warn('[DELETE] No onDelete handler provided');
      return;
    }
    // Don't show confirmation here - let the parent component handle it
    // The onDelete callback will trigger the delete confirmation in CapacityManagement
    console.log('[DELETE] Calling onDelete callback');
    onDelete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">
            Edit Capacity
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <CapacityEditForm
          periodType={periodType}
          setPeriodType={setPeriodType}
          recurrenceType={recurrenceType}
          setRecurrenceType={setRecurrenceType}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          selectedPlatforms={selectedPlatforms}
          setSelectedPlatforms={setSelectedPlatforms}
          defaultCapacity={defaultCapacity}
          loadingDefault={loadingDefault}
          existingCapacity={existingCapacity}
          capacityOverride={capacityOverride}
          setCapacityOverride={setCapacityOverride}
          useOverride={useOverride}
          setUseOverride={setUseOverride}
          initialDate={initialDate}
          sideKey={sideKey}
        />

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-900/20 border border-red-700">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
