import { useState } from 'react';
import { format, getDay } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';
import { parseExcludedDates } from './scheduleUtils';

type DeleteConfirmState = {
  isOpen: boolean;
  scheduleIds: number[];
  selectedDate: Date | null;
  scheduleInfo: {
    recurrenceType: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    periodType: string;
  } | null;
};

export function useScheduleDeletion(sideId: number | null) {
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    scheduleIds: [],
    selectedDate: null,
    scheduleInfo: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'future' | 'all'>(
    'single'
  );

  const confirmDeleteSchedule = async (
    onSuccess: () => void
  ): Promise<void> => {
    if (
      !sideId ||
      deleteConfirm.scheduleIds.length === 0 ||
      !deleteConfirm.selectedDate ||
      !deleteConfirm.scheduleInfo
    ) {
      return;
    }

    setDeleting(true);
    try {
      const { data: freshSchedules, error: fetchError } = await supabase
        .from('capacity_schedules')
        .select('*')
        .eq('side_id', sideId);

      if (fetchError) {
        throw new Error(`Failed to fetch schedules: ${fetchError.message}`);
      }

      const selectedDateStr = format(deleteConfirm.selectedDate, 'yyyy-MM-dd');
      let idsToDelete: number[] = [];

      if (deleteMode === 'single') {
        const selectedDayOfWeek = getDay(deleteConfirm.selectedDate!);

        const matchingSchedule = (freshSchedules || []).find((schedule) => {
          const matchesPattern =
            schedule.day_of_week === selectedDayOfWeek &&
            schedule.start_time === deleteConfirm.scheduleInfo!.startTime &&
            schedule.end_time === deleteConfirm.scheduleInfo!.endTime &&
            schedule.period_type === deleteConfirm.scheduleInfo!.periodType &&
            schedule.recurrence_type ===
              deleteConfirm.scheduleInfo!.recurrenceType;

          if (!matchesPattern) return false;

          if (schedule.recurrence_type === 'single') {
            return schedule.start_date === selectedDateStr;
          }

          return true;
        });

        if (matchingSchedule) {
          if (matchingSchedule.recurrence_type === 'single') {
            idsToDelete = [matchingSchedule.id];

            // Also delete the corresponding period_type_capacity_override if it exists
            await supabase
              .from('period_type_capacity_overrides')
              .delete()
              .eq('date', selectedDateStr)
              .eq('period_type', matchingSchedule.period_type);
          } else {
            const excludedDates = parseExcludedDates(
              matchingSchedule.excluded_dates
            );

            if (!excludedDates.includes(selectedDateStr)) {
              excludedDates.push(selectedDateStr);

              const { error: updateError } = await supabase
                .from('capacity_schedules')
                .update({ excluded_dates: excludedDates })
                .eq('id', matchingSchedule.id);

              if (updateError) {
                throw new Error(
                  `Failed to exclude date: ${updateError.message}`
                );
              }

              setDeleteConfirm({
                isOpen: false,
                scheduleIds: [],
                selectedDate: null,
                scheduleInfo: null,
              });
              setDeleting(false);
              onSuccess();
              return;
            } else {
              setDeleting(false);
              setDeleteConfirm({
                isOpen: false,
                scheduleIds: [],
                selectedDate: null,
                scheduleInfo: null,
              });
              return;
            }
          }
        } else {
          throw new Error('No matching schedule found to exclude date from');
        }
      } else if (deleteMode === 'future') {
        // For "future" mode, we need to handle schedules that started in the past differently:
        // - If schedule starts on or after selected date → delete it
        // - If schedule started before selected date → set end_date to day before selected date (to keep past events)

        const matchingSchedules = (freshSchedules || []).filter((schedule) => {
          return (
            schedule.start_time === deleteConfirm.scheduleInfo!.startTime &&
            schedule.end_time === deleteConfirm.scheduleInfo!.endTime &&
            schedule.period_type === deleteConfirm.scheduleInfo!.periodType &&
            schedule.recurrence_type ===
              deleteConfirm.scheduleInfo!.recurrenceType
          );
        });

        if (matchingSchedules.length === 0) {
          throw new Error(
            `No schedules found matching the pattern. Looking for: ${deleteConfirm.scheduleInfo!.recurrenceType}, ${deleteConfirm.scheduleInfo!.startTime}-${deleteConfirm.scheduleInfo!.endTime}, ${deleteConfirm.scheduleInfo!.periodType}`
          );
        }

        // Separate schedules into two groups:
        // 1. Schedules that start on or after selected date → delete these
        // 2. Schedules that started before selected date → update end_date to preserve past events
        const schedulesToDelete: number[] = [];
        const schedulesToUpdate: Array<{ id: number; end_date: string }> = [];

        // Calculate the day before selected date (to end the schedule there)
        const selectedDate = new Date(deleteConfirm.selectedDate!);
        selectedDate.setDate(selectedDate.getDate() - 1);
        const endDateStr = format(selectedDate, 'yyyy-MM-dd');
        const selectedDateStr = format(
          deleteConfirm.selectedDate!,
          'yyyy-MM-dd'
        );
        const selectedDayOfWeek = getDay(deleteConfirm.selectedDate!);

        for (const schedule of matchingSchedules) {
          if (deleteConfirm.scheduleInfo!.recurrenceType === 'single') {
            // For single schedules, only delete if exact date match
            if (schedule.start_date === selectedDateStr) {
              schedulesToDelete.push(schedule.id);
            }
          } else {
            // For recurring schedules, we need to check if this schedule entry's day_of_week
            // is on or after the selected date's day_of_week
            const scheduleDayOfWeek = schedule.day_of_week;
            let shouldDelete = false;

            if (deleteConfirm.scheduleInfo!.recurrenceType === 'weekday') {
              // For weekday: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
              // Delete if schedule's day_of_week >= selected day_of_week
              if (
                scheduleDayOfWeek >= selectedDayOfWeek &&
                scheduleDayOfWeek >= 1 &&
                scheduleDayOfWeek <= 5
              ) {
                shouldDelete = true;
              }
            } else if (
              deleteConfirm.scheduleInfo!.recurrenceType === 'weekend'
            ) {
              // For weekend: Saturday=6, Sunday=0
              // If selected is Saturday (6), delete both Saturday (6) and Sunday (0)
              // If selected is Sunday (0), only delete Sunday (0), keep Saturday (6)
              if (selectedDayOfWeek === 6) {
                // Delete both Saturday and Sunday
                shouldDelete =
                  scheduleDayOfWeek === 6 || scheduleDayOfWeek === 0;
              } else if (selectedDayOfWeek === 0) {
                // Only delete Sunday
                shouldDelete = scheduleDayOfWeek === 0;
              }
            } else {
              // For weekly and all_future, we need to check if this schedule entry would apply
              // to the selected date or any date after it
              // Since these have one entry per day_of_week, we compare day_of_week
              if (scheduleDayOfWeek === selectedDayOfWeek) {
                // Same day of week - delete if it would apply to selected date or later
                if (schedule.start_date >= selectedDateStr) {
                  // Starts on or after selected date → delete
                  shouldDelete = true;
                } else if (
                  !schedule.end_date ||
                  schedule.end_date >= selectedDateStr
                ) {
                  // Started before but extends to or past selected date → delete
                  shouldDelete = true;
                }
              } else {
                // Different day of week - only delete if schedule starts on or after selected date
                // (this handles the case where we're deleting a series that hasn't started yet)
                if (schedule.start_date >= selectedDateStr) {
                  shouldDelete = true;
                }
              }
            }

            if (shouldDelete) {
              schedulesToDelete.push(schedule.id);
            } else {
              // Schedule entry is for a day before the selected date
              // Update end_date to preserve past events
              if (!schedule.end_date || schedule.end_date >= selectedDateStr) {
                schedulesToUpdate.push({
                  id: schedule.id,
                  end_date: endDateStr,
                });
              }
            }
          }
        }

        // Update schedules that started in the past
        for (const scheduleUpdate of schedulesToUpdate) {
          const { error: updateError } = await supabase
            .from('capacity_schedules')
            .update({ end_date: scheduleUpdate.end_date })
            .eq('id', scheduleUpdate.id);

          if (updateError) {
            throw new Error(
              `Failed to update schedule end date: ${updateError.message}`
            );
          }
        }

        // Delete schedules that start on or after selected date
        idsToDelete = schedulesToDelete;
      } else if (deleteMode === 'all') {
        // For "all" mode, delete all matching schedules regardless of date
        const matchingSchedules = (freshSchedules || []).filter((schedule) => {
          return (
            schedule.start_time === deleteConfirm.scheduleInfo!.startTime &&
            schedule.end_time === deleteConfirm.scheduleInfo!.endTime &&
            schedule.period_type === deleteConfirm.scheduleInfo!.periodType &&
            schedule.recurrence_type ===
              deleteConfirm.scheduleInfo!.recurrenceType
          );
        });

        if (matchingSchedules.length === 0) {
          throw new Error(
            `No schedules found matching the pattern. Looking for: ${deleteConfirm.scheduleInfo!.recurrenceType}, ${deleteConfirm.scheduleInfo!.startTime}-${deleteConfirm.scheduleInfo!.endTime}, ${deleteConfirm.scheduleInfo!.periodType}`
          );
        }

        idsToDelete = matchingSchedules.map((s) => s.id);
      }

      if (idsToDelete.length === 0 && deleteMode === 'single') {
        // For single mode, we should have found something to delete or exclude
        throw new Error('No matching schedule found to delete');
      }

      // Only delete if there are schedules to delete
      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('capacity_schedules')
          .delete()
          .in('id', idsToDelete);

        if (error) {
          throw new Error(error.message);
        }
      }

      setDeleteConfirm({
        isOpen: false,
        scheduleIds: [],
        selectedDate: null,
        scheduleInfo: null,
      });
      onSuccess();
    } catch (error) {
      alert(
        `Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleteConfirm,
    setDeleteConfirm,
    deleting,
    deleteMode,
    setDeleteMode,
    confirmDeleteSchedule,
  };
}
