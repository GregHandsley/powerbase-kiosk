/**
 * Check for rack conflicts across weeks without creating a booking.
 * Used by the create-booking review step to validate before submit.
 */

import { addWeeks } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';
import { combineDateAndTime } from './utils';

export type ReviewConflict = {
  week: number; // 1-based display index
  weekIndex: number; // 0-based
  rack: number;
  conflictingBooking: string;
  conflictTime: string;
};

export type CheckConflictsParams = {
  sideId: number;
  startDate: string;
  startTime: string;
  endTime: string;
  weeks: number;
  racksByWeek: Map<number, number[]>;
};

export async function checkBookingConflictsForReview(
  params: CheckConflictsParams
): Promise<{ conflicts: ReviewConflict[] }> {
  const { sideId, startDate, startTime, endTime, weeks, racksByWeek } = params;
  const startTemplate = combineDateAndTime(startDate, startTime);
  const endTemplate = combineDateAndTime(startDate, endTime);
  const conflicts: ReviewConflict[] = [];

  for (let i = 0; i < weeks; i++) {
    const weekStart = addWeeks(startTemplate, i);
    const weekEnd = addWeeks(endTemplate, i);
    const weekRacks = racksByWeek.get(i) || [];

    const { data: overlappingInstances, error: overlapError } = await supabase
      .from('booking_instances')
      .select(
        `
        id,
        start,
        "end",
        racks,
        booking:bookings (
          title,
          status
        )
      `
      )
      .eq('side_id', sideId)
      .lt('start', weekEnd.toISOString())
      .gt('end', weekStart.toISOString())
      .order('start', { ascending: true });

    if (overlapError) {
      throw new Error(`Error checking for conflicts: ${overlapError.message}`);
    }

    const validInstances = (overlappingInstances ?? []).filter(
      (inst: unknown) => {
        const i = inst as { booking?: { status?: string } | null };
        const status = i.booking?.status;
        if (!status) return true;
        return status !== 'cancelled';
      }
    );

    for (const rack of weekRacks) {
      const conflictingInstance = validInstances.find((inst: unknown) => {
        const instRacks = Array.isArray((inst as { racks?: number[] }).racks)
          ? (inst as { racks: number[] }).racks
          : [];
        return instRacks.includes(rack);
      });

      if (conflictingInstance) {
        const inst = conflictingInstance as {
          start: string;
          end: string;
          booking?: { title?: string } | null;
        };
        const formatDateTime = (isoString: string) => {
          const date = new Date(isoString);
          return date.toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        };
        conflicts.push({
          week: i + 1,
          weekIndex: i,
          rack,
          conflictingBooking: inst.booking?.title ?? 'Unknown',
          conflictTime: `${formatDateTime(inst.start)} - ${formatDateTime(inst.end)}`,
        });
      }
    }
  }

  return { conflicts };
}
