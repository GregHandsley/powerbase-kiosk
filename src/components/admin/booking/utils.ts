/**
 * Utility functions for booking form
 */

export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  // date: yyyy-mm-dd, time: HH:mm
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Calculate end time that is `minutes` after start time, respecting closed periods
 * Returns null if no valid end time can be found
 */
export function calculateEndTime(
  startTime: string,
  minutes: number,
  closedTimes: Set<string>
): string | null {
  const [startHour, startMinute] = startTime.split(':').map(Number);

  // Check if start time itself is closed
  const startTimeStr = `${String(startHour).padStart(2, '0')}:00`;
  if (closedTimes.has(startTimeStr)) {
    return null;
  }

  // Calculate total minutes from midnight
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = startTotalMinutes + minutes;

  // Convert back to hours and minutes
  let endHour = Math.floor(endTotalMinutes / 60);
  let endMinute = endTotalMinutes % 60;

  // If we go past midnight, cap at 23:59
  if (endHour >= 24) {
    endHour = 23;
    endMinute = 59;
  }

  // Check each hour from start to end to see if any are closed
  for (let hour = startHour; hour <= endHour; hour++) {
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    if (closedTimes.has(timeStr)) {
      // If we hit a closed hour, try to end just before it (at 59 minutes of previous hour)
      if (hour > startHour) {
        const safeEndHour = hour - 1;
        return `${String(safeEndHour).padStart(2, '0')}:59`;
      }
      // If the first hour after start is closed, return null
      return null;
    }
  }

  // If end time falls exactly on a closed hour boundary, adjust it
  const endTimeStr = `${String(endHour).padStart(2, '0')}:00`;
  if (closedTimes.has(endTimeStr) && endMinute === 0) {
    // End time is exactly on a closed hour, end at 59 of previous hour
    if (endHour > startHour) {
      return `${String(endHour - 1).padStart(2, '0')}:59`;
    }
    return null;
  }

  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}
