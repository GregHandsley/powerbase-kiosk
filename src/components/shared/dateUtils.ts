/**
 * Utility functions for date and time formatting and manipulation
 */

/**
 * Format an ISO date string to time input format (HH:mm)
 */
export function formatTimeForInput(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Format an ISO date string to a readable date-time string
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate time difference between two time strings (HH:mm format)
 * Returns the difference in hours and minutes
 */
export function getTimeDifference(
  time1: string,
  time2: string
): { hours: number; minutes: number } {
  const [h1, m1] = time1.split(":").map(Number);
  const [h2, m2] = time2.split(":").map(Number);
  const totalMinutes1 = h1 * 60 + m1;
  const totalMinutes2 = h2 * 60 + m2;
  const diffMinutes = totalMinutes2 - totalMinutes1;
  return {
    hours: Math.floor(diffMinutes / 60),
    minutes: diffMinutes % 60,
  };
}

/**
 * Group instances by week (Monday as week start)
 */
export function groupInstancesByWeek<T extends { start: string }>(
  instances: T[]
): Map<number, T[]> {
  const weekMap = new Map<number, T[]>();
  instances.forEach((inst) => {
    const startDate = new Date(inst.start);
    // Get the start of the week (Monday)
    const weekStart = new Date(startDate);
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.getTime();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(inst);
  });
  return weekMap;
}

