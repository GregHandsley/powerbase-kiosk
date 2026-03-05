import { supabase } from '../../lib/supabaseClient';
import type { BookingInstanceAreaSlotRow } from '../../types/db';

export type AreaSlotInput = {
  area_key: string;
  start: string; // ISO
  end: string; // ISO
};

/**
 * Replaces all area slots for a booking instance: deletes existing and inserts the given list.
 * Used when saving/editing a booking (Sprint 3). Slot start/end should be within the instance window (enforced in UI).
 */
export async function saveAreaSlotsForInstance(
  instanceId: number,
  slots: AreaSlotInput[]
): Promise<{ error: Error | null }> {
  try {
    const { error: deleteError } = await supabase
      .from('booking_instance_area_slots')
      .delete()
      .eq('booking_instance_id', instanceId);

    if (deleteError) {
      if (
        deleteError.message?.includes('does not exist') ||
        deleteError.message?.includes('relation')
      ) {
        // Table not created yet; nothing to delete
        return { error: null };
      }
      return { error: deleteError as Error };
    }

    if (slots.length === 0) return { error: null };

    const rows = slots.map((s) => ({
      booking_instance_id: instanceId,
      area_key: s.area_key,
      start: s.start,
      end: s.end,
    }));

    const { error: insertError } = await supabase
      .from('booking_instance_area_slots')
      .insert(rows);

    if (insertError) {
      return { error: insertError as Error };
    }
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetches area slots for a single instance (e.g. when loading a booking for edit).
 */
export async function getAreaSlotsForInstance(
  instanceId: number
): Promise<{ data: BookingInstanceAreaSlotRow[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('booking_instance_area_slots')
      .select('id, booking_instance_id, area_key, start, end')
      .eq('booking_instance_id', instanceId)
      .order('start', { ascending: true });

    if (error) {
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('relation')
      ) {
        return { data: [], error: null };
      }
      return { data: [], error: error as Error };
    }
    return { data: (data ?? []) as BookingInstanceAreaSlotRow[], error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetches area slots for multiple instances. Returns a map instanceId -> slots.
 * Used when loading a booking series for edit.
 */
export async function getAreaSlotsForInstances(
  instanceIds: number[]
): Promise<Record<number, BookingInstanceAreaSlotRow[]>> {
  if (instanceIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('booking_instance_area_slots')
      .select('id, booking_instance_id, area_key, start, end')
      .in('booking_instance_id', instanceIds)
      .order('start', { ascending: true });

    if (error) {
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('relation')
      ) {
        return {};
      }
      throw error;
    }
    const slots = (data ?? []) as BookingInstanceAreaSlotRow[];
    const byInstance: Record<number, BookingInstanceAreaSlotRow[]> = {};
    for (const slot of slots) {
      const id = slot.booking_instance_id;
      if (!byInstance[id]) byInstance[id] = [];
      byInstance[id].push(slot);
    }
    return byInstance;
  } catch {
    return {};
  }
}
