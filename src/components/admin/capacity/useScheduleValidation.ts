import { format } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';

type ScheduleToCheck = {
  side_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  period_type: string;
  recurrence_type: string;
  start_date: string;
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function doTimeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);
  return start1Min < end2Min && end1Min > start2Min;
}

export async function validateNoOverlaps(
  sideId: number,
  schedulesToCheck: ScheduleToCheck[],
  excludeScheduleIds: number[] = []
): Promise<string | null> {
  const { data: existingSchedules, error } = await supabase
    .from('capacity_schedules')
    .select('*')
    .eq('side_id', sideId);

  if (error) {
    return `Error checking for conflicts: ${error.message}`;
  }

  // Filter out schedules we're about to replace (exclude by ID)
  const schedulesToCheckAgainst = (existingSchedules || []).filter(
    (schedule) => !excludeScheduleIds.includes(schedule.id)
  );

  const conflicts: Array<{
    day: string;
    time: string;
    existingPeriod: string;
    recurrence: string;
  }> = [];

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  for (const newSchedule of schedulesToCheck) {
    for (const existing of schedulesToCheckAgainst) {
      let appliesToSameDay = false;

      if (newSchedule.day_of_week !== existing.day_of_week) {
        continue;
      }

      if (
        newSchedule.recurrence_type === 'single' &&
        existing.recurrence_type === 'single'
      ) {
        appliesToSameDay = newSchedule.start_date === existing.start_date;
      } else if (
        newSchedule.recurrence_type === 'weekday' &&
        existing.recurrence_type === 'weekday'
      ) {
        appliesToSameDay =
          newSchedule.day_of_week >= 1 && newSchedule.day_of_week <= 5;
      } else if (
        newSchedule.recurrence_type === 'weekend' &&
        existing.recurrence_type === 'weekend'
      ) {
        appliesToSameDay =
          newSchedule.day_of_week === 0 || newSchedule.day_of_week === 6;
      } else if (
        newSchedule.recurrence_type === 'weekly' &&
        existing.recurrence_type === 'weekly'
      ) {
        const newStart = new Date(newSchedule.start_date);
        const existingEnd = existing.end_date
          ? new Date(existing.end_date)
          : null;
        if (!existingEnd || newStart <= existingEnd) {
          appliesToSameDay = true;
        }
      } else if (
        newSchedule.recurrence_type === 'all_future' &&
        existing.recurrence_type === 'all_future'
      ) {
        const newStart = new Date(newSchedule.start_date);
        const existingEnd = existing.end_date
          ? new Date(existing.end_date)
          : null;
        if (!existingEnd || newStart <= existingEnd) {
          appliesToSameDay = true;
        }
      } else {
        const newStart = new Date(newSchedule.start_date);
        const existingStart = new Date(existing.start_date);
        const existingEnd = existing.end_date
          ? new Date(existing.end_date)
          : null;

        if (newSchedule.recurrence_type === 'single') {
          if (
            newStart >= existingStart &&
            (!existingEnd || newStart <= existingEnd)
          ) {
            appliesToSameDay = true;
          }
        } else if (existing.recurrence_type === 'single') {
          if (existingStart >= newStart) {
            appliesToSameDay = true;
          }
        } else {
          if (!existingEnd || newStart <= existingEnd) {
            appliesToSameDay = true;
          }
        }
      }

      if (
        appliesToSameDay &&
        doTimeRangesOverlap(
          newSchedule.start_time,
          newSchedule.end_time,
          existing.start_time,
          existing.end_time
        )
      ) {
        const recurrenceLabel =
          newSchedule.recurrence_type === 'single'
            ? format(new Date(newSchedule.start_date), 'MMM d, yyyy')
            : newSchedule.recurrence_type === 'weekday'
              ? 'Weekdays'
              : newSchedule.recurrence_type === 'weekend'
                ? 'Weekends'
                : newSchedule.recurrence_type === 'weekly'
                  ? 'Weekly'
                  : 'All future';

        conflicts.push({
          day: dayNames[newSchedule.day_of_week],
          time: `${newSchedule.start_time} - ${newSchedule.end_time}`,
          existingPeriod: existing.period_type,
          recurrence: recurrenceLabel,
        });
      }
    }
  }

  if (conflicts.length > 0) {
    const conflictMessages = conflicts.map(
      (c) =>
        `  • ${c.day} (${c.recurrence}) ${c.time}: Already booked as "${c.existingPeriod}"`
    );
    return `Schedule conflicts detected:\n${conflictMessages.join('\n')}\n\nPlease select a different time or remove the existing schedule first.`;
  }

  return null;
}
