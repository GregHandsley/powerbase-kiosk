import { supabase } from "./supabaseClient";
import type { ActiveInstance, SideSnapshot, Snapshot } from "./types";

type ActiveBookingInstanceRow = {
  id: number;
  booking_id: number;
  start: string;
  end: string;
  areas: string[] | null;
  racks: number[] | null;
  bookings: {
    title: string | null;
    color: string | null;
  } | null;
};

type FutureBookingInstanceRow = {
  start: string;
  areas: string[] | null;
  racks: number[] | null;
};

/**
 * Look up the Side row by key ('Power' or 'Base').
 */
async function getSideByKey(sideKey: "Power" | "Base") {
  const { data, error } = await supabase
    .from("sides")
    .select("id, key")
    .eq("key", sideKey)
    .single();

  if (error || !data) {
    console.error("getSideByKey error", error);
    throw new Error(`Side not found for key ${sideKey}`);
  }

  return data as { id: number; key: string };
}

/**
 * Snapshot for a single side at a given time.
 */
export async function getSideSnapshot(
  sideKey: "Power" | "Base",
  at: Date
): Promise<SideSnapshot> {
  const side = await getSideByKey(sideKey);
  const atIso = at.toISOString();

  // 1) Active instances now: start <= at < end
  const { data: activeData, error: activeError } = await supabase
    .from("booking_instances")
    .select(
      `
      id,
      booking_id,
      start,
      end,
      areas,
      racks,
      bookings (
        title,
        color
      )
    `
    )
    .eq("side_id", side.id)
    .lte("start", atIso)
    .gt("end", atIso)
    .order("start", { ascending: true });

  if (activeError) {
    console.error("Error fetching active instances", activeError);
    throw activeError;
  }

  const currentInstances: ActiveInstance[] = ((activeData ?? []) as unknown as ActiveBookingInstanceRow[]).map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    title: row.bookings?.title ?? "Untitled booking",
    color: row.bookings?.color ?? null,
    start: row.start,
    end: row.end,
    racks: (row.racks ?? []) as number[],
    areas: (row.areas ?? []) as string[],
  }));

  // 2) Next-use info in a lookahead window
  const LOOKAHEAD_HOURS = 36;
  const lookaheadEnd = new Date(at.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);
  const lookaheadIso = lookaheadEnd.toISOString();

  const { data: futureData, error: futureError } = await supabase
    .from("booking_instances")
    .select("start, areas, racks")
    .eq("side_id", side.id)
    .gt("start", atIso)
    .lte("start", lookaheadIso)
    .order("start", { ascending: true });

  if (futureError) {
    console.error("Error fetching future instances", futureError);
    throw futureError;
  }

  const nextUseByRack: Record<string, string | null> = {};
  const nextUseByArea: Record<string, string | null> = {};

  ((futureData ?? []) as FutureBookingInstanceRow[]).forEach((row) => {
    const startTime: string = row.start;
    const racks: number[] = row.racks ?? [];
    const areas: string[] = row.areas ?? [];

    racks.forEach((r) => {
      const key = String(r);
      if (!nextUseByRack[key]) {
        nextUseByRack[key] = startTime;
      }
    });

    areas.forEach((a) => {
      const key = a;
      if (!nextUseByArea[key]) {
        nextUseByArea[key] = startTime;
      }
    });
  });

  return {
    at: atIso,
    sideKey,
    sideId: side.id,
    currentInstances,
    nextUseByRack,
    nextUseByArea,
  };
}

/**
 * Snapshot for both sides at a given time.
 */
export async function getSnapshot(at: Date): Promise<Snapshot> {
  const [power, base] = await Promise.all([
    getSideSnapshot("Power", at),
    getSideSnapshot("Base", at),
  ]);

  return {
    at: at.toISOString(),
    power,
    base,
  };
}
