import { supabase } from '../../lib/supabaseClient';
import type {
  BookingInstanceWithBookingRow,
  BookingStatus,
} from '../../types/db';

type RawInstanceRow = {
  id: number;
  booking_id: number;
  side_id: number;
  start: string;
  end: string;
  areas?: unknown;
  racks?: unknown;
  created_at: string;
  updated_at: string;
  booking?:
    | {
        title?: unknown;
        color?: unknown;
        is_locked?: unknown;
        created_by?: unknown;
        status?: unknown;
        processed_by?: unknown;
        processed_at?: unknown;
        last_edited_at?: unknown;
        last_edited_by?: unknown;
      }
    | {
        title?: unknown;
        color?: unknown;
        is_locked?: unknown;
        created_by?: unknown;
        status?: unknown;
        processed_by?: unknown;
        processed_at?: unknown;
        last_edited_at?: unknown;
        last_edited_by?: unknown;
      }[]
    | null;
};

type BookingRowFull = {
  title: string | null;
  color: string | null;
  is_locked: boolean | null;
  created_by: string | null;
  status: BookingStatus | null;
  processed_by: string | null;
  processed_at: string | null;
  last_edited_at: string | null;
  last_edited_by: string | null;
};

type InstanceRowFull = {
  id: number | null;
  booking_id: number | null;
  side_id: number | null;
  start: string | null;
  end: string | null;
  areas: unknown;
  racks: unknown;
  created_at: string | null;
  updated_at: string | null;
  booking: BookingRowFull[];
};

// Type coercion helpers
const asStringOrNull = (v: unknown): string | null =>
  typeof v === 'string' ? v : null;

const asNumberOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const asBooleanOrNull = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

function normalizeBooking(input: unknown): BookingRowFull {
  const b = asRecord(input);

  return {
    title: asStringOrNull(b?.title),
    color: asStringOrNull(b?.color),
    is_locked: asBooleanOrNull(b?.is_locked),
    created_by: asStringOrNull(b?.created_by),
    status: typeof b?.status === 'string' ? (b.status as BookingStatus) : null,
    processed_by: asStringOrNull(b?.processed_by),
    processed_at: asStringOrNull(b?.processed_at),
    last_edited_at: asStringOrNull(b?.last_edited_at),
    last_edited_by: asStringOrNull(b?.last_edited_by),
  };
}

function normalizeFallbackInstanceRow(input: unknown): InstanceRowFull {
  const row = asRecord(input);

  const bookingRaw = row?.booking;
  const bookingArray = Array.isArray(bookingRaw)
    ? bookingRaw
    : bookingRaw
      ? [bookingRaw]
      : [];

  return {
    id: asNumberOrNull(row?.id),
    booking_id: asNumberOrNull(row?.booking_id),
    side_id: asNumberOrNull(row?.side_id),
    start: asStringOrNull(row?.start),
    end: asStringOrNull(row?.end),
    // IMPORTANT: make these always present (your error says areas was optional)
    areas: row?.areas ?? [],
    racks: row?.racks ?? [],
    created_at: asStringOrNull(row?.created_at),
    updated_at: asStringOrNull(row?.updated_at),
    booking: bookingArray.map(normalizeBooking),
  };
}

function normalizeInstanceRow(
  row: RawInstanceRow
): BookingInstanceWithBookingRow {
  const bookingRaw = row.booking ?? null;
  const bookingObj = Array.isArray(bookingRaw)
    ? (bookingRaw[0] ?? null)
    : bookingRaw;

  return {
    id: row.id,
    booking_id: row.booking_id,
    side_id: row.side_id,
    start: row.start,
    end: row.end,
    areas: Array.isArray(row.areas) ? (row.areas as unknown[]).map(String) : [],
    racks: Array.isArray(row.racks)
      ? (row.racks as unknown[])
          .map((n) => Number(n))
          .filter((n) => !Number.isNaN(n))
      : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    booking: bookingObj
      ? {
          title:
            typeof bookingObj.title === 'string' || bookingObj.title === null
              ? bookingObj.title
              : null,
          color:
            typeof bookingObj.color === 'string' || bookingObj.color === null
              ? bookingObj.color
              : null,
          is_locked: bookingObj.is_locked === true,
          created_by:
            typeof bookingObj.created_by === 'string' ||
            bookingObj.created_by === null
              ? bookingObj.created_by
              : null,
          status:
            typeof bookingObj.status === 'string'
              ? (bookingObj.status as BookingStatus)
              : undefined,
          processed_by:
            typeof bookingObj.processed_by === 'string' ||
            bookingObj.processed_by === null
              ? bookingObj.processed_by
              : undefined,
          processed_at:
            typeof bookingObj.processed_at === 'string' ||
            bookingObj.processed_at === null
              ? bookingObj.processed_at
              : undefined,
          last_edited_at:
            typeof bookingObj.last_edited_at === 'string' ||
            bookingObj.last_edited_at === null
              ? bookingObj.last_edited_at
              : undefined,
          last_edited_by:
            typeof bookingObj.last_edited_by === 'string' ||
            bookingObj.last_edited_by === null
              ? bookingObj.last_edited_by
              : undefined,
        }
      : null,
  };
}

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

  // Try with status fields first (if migration has been run)
  const query = supabase
    .from('booking_instances')
    .select(
      `
      id,
      booking_id,
      side_id,
      start,
      "end",
      areas,
      racks,
      created_at,
      updated_at,
      booking:bookings (
        title,
        color,
        is_locked,
        created_by,
        status,
        processed_by,
        processed_at,
        last_edited_at,
        last_edited_by
      )
    `
    )
    .eq('side_id', sideId)
    .gte('start', startOfDay.toISOString())
    .lt('start', endOfNextDay.toISOString())
    .order('start', { ascending: true });

  let { data, error } = await query;

  // If error is about missing columns, fallback to basic query (migration not run yet)
  if (
    error &&
    (error.message?.includes('does not exist') ||
      error.message?.includes('column'))
  ) {
    // Fallback to basic query without status fields
    const fallbackQuery = supabase
      .from('booking_instances')
      .select(
        `
        id,
        booking_id,
        side_id,
        start,
        "end",
        areas,
        racks,
        created_at,
        updated_at,
        booking:bookings (
          title,
          color,
          is_locked,
          created_by
        )
      `
      )
      .eq('side_id', sideId)
      .gte('start', startOfDay.toISOString())
      .lt('start', endOfNextDay.toISOString())
      .order('start', { ascending: true });

    const fallbackResult = await fallbackQuery;
    if (!fallbackResult.error) {
      // Map fallback data to add missing booking fields
      data = (fallbackResult.data ?? []).map(normalizeFallbackInstanceRow);
      error = null;
    } else {
      // If fallback also fails, return the original error
      error = fallbackResult.error;
    }
  }

  const rows = (data ?? []).map((row) =>
    normalizeInstanceRow(row as RawInstanceRow)
  );

  return {
    data: rows,
    error,
  };
}

/**
 * Optional helper to fetch future instances for a specific rack.
 */
export async function getFutureInstancesForRackNode(
  sideId: number,
  rackNumber: number,
  fromIso: string,
  toIso: string
) {
  // Try with status fields first (if migration has been run)
  const query = supabase
    .from('booking_instances')
    .select(
      `
      id,
      booking_id,
      side_id,
      start,
      "end",
      areas,
      racks,
      created_at,
      updated_at,
      booking:bookings (
        title,
        color,
        is_locked,
        created_by,
        status,
        processed_by,
        processed_at,
        last_edited_at,
        last_edited_by
      )
    `
    )
    .eq('side_id', sideId)
    .contains('racks', [rackNumber])
    .gte('start', fromIso)
    .lt('start', toIso)
    .order('start', { ascending: true });

  let { data, error } = await query;

  // If error is about missing columns, fallback to basic query (migration not run yet)
  if (
    error &&
    (error.message?.includes('does not exist') ||
      error.message?.includes('column'))
  ) {
    // Fallback to basic query without status fields
    const fallbackQuery = supabase
      .from('booking_instances')
      .select(
        `
        id,
        booking_id,
        side_id,
        start,
        "end",
        areas,
        racks,
        created_at,
        updated_at,
        booking:bookings (
          title,
          color,
          is_locked,
          created_by
        )
      `
      )
      .eq('side_id', sideId)
      .contains('racks', [rackNumber])
      .gte('start', fromIso)
      .lt('start', toIso)
      .order('start', { ascending: true });

    const fallbackResult = await fallbackQuery;
    if (!fallbackResult.error) {
      // Map fallback data to add missing booking fields
      data = (fallbackResult.data ?? []).map(normalizeFallbackInstanceRow);
      error = null;
    } else {
      // If fallback also fails, return the original error
      error = fallbackResult.error;
    }
  }

  const rows = (data ?? []).map((row) =>
    normalizeInstanceRow(row as RawInstanceRow)
  );

  return {
    data: rows,
    error,
  };
}
