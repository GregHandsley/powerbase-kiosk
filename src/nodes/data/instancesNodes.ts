import { supabase } from "../../lib/supabaseClient";
import type { BookingInstanceRow } from "../../types/db";

/**
 * Returns all booking_instances for a side from the start of the day containing `atIso`
 * through to the end of the next day. We'll decide "current" vs "future" in computeSnapshot.
 */
export async function getInstancesAtNode(sideId: number, atIso: string) {
  const atDate = new Date(atIso);
  if (Number.isNaN(atDate.getTime())) {
    throw new Error(`Invalid atIso passed to getInstancesAtNode: ${atIso}`);
  }

  const startOfDay = new Date(atDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfNextDay = new Date(startOfDay);
  endOfNextDay.setDate(endOfNextDay.getDate() + 2); // today + next day

  const { data, error } = await supabase
    .from("booking_instances")
    .select("*")
    .eq("side_id", sideId)
    .gte("start", startOfDay.toISOString())
    .lt("start", endOfNextDay.toISOString())
    .order("start", { ascending: true });

  return {
    data: (data ?? []) as BookingInstanceRow[],
    error,
  };
}

/**
 * Optional helper to fetch future instances for a specific rack.
 * Not used yet, but handy if we want per-rack queries later.
 */
export async function getFutureInstancesForRackNode(
  sideId: number,
  rackNumber: number,
  fromIso: string,
  toIso: string
) {
  const { data, error } = await supabase
    .from("booking_instances")
    .select("*")
    .eq("side_id", sideId)
    // JSONB contains rackNumber in the racks array
    .contains("racks", [rackNumber])
    .gte("start", fromIso)
    .lt("start", toIso)
    .order("start", { ascending: true });

  return {
    data: (data ?? []) as BookingInstanceRow[],
    error,
  };
}
