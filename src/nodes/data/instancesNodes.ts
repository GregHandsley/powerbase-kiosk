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

// type BookingRowFull = {
//   title: string | null;
//   color: string | null;
//   is_locked: boolean | null;
//   created_by: string | null;
//   status: BookingStatus | null;
//   processed_by: string | null;
//   processed_at: string | null;
//   last_edited_at: string | null;
//   last_edited_by: string | null;
// };

// // Type coercion helpers
// const asStringOrNull = (v: unknown): string | null =>
//   typeof v === 'string' ? v : null;

// const asBooleanOrNull = (v: unknown): boolean | null =>
//   typeof v === 'boolean' ? v : null;

// const asRecord = (v: unknown): Record<string, unknown> | null =>
//   v && typeof v === 'object' && !Array.isArray(v)
//     ? (v as Record<string, unknown>)
//     : null;

// Note: normalizeFallbackInstanceRow is no longer used since we now normalize
// fallback data directly to BookingInstanceWithBookingRow using normalizeInstanceRow
// Keeping the function commented out in case it's needed for future reference
// function normalizeFallbackInstanceRow(input: unknown): InstanceRowFull {
//   const row = asRecord(input);
//
//   const bookingRaw = row?.booking;
//   const bookingArray = Array.isArray(bookingRaw)
//     ? bookingRaw
//     : bookingRaw
//       ? [bookingRaw]
//       : [];
//
//   return {
//     id: asNumberOrNull(row?.id),
//     booking_id: asNumberOrNull(row?.booking_id),
//     side_id: asNumberOrNull(row?.side_id),
//     start: asStringOrNull(row?.start),
//     end: asStringOrNull(row?.end),
//     areas: row?.areas ?? [],
//     racks: row?.racks ?? [],
//     created_at: asStringOrNull(row?.created_at),
//     updated_at: asStringOrNull(row?.updated_at),
//     booking: bookingArray.map(normalizeBooking),
//   };
// }

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
export async function getInstancesAtNode(
  sideId: number,
  atIso: string
): Promise<{ data: BookingInstanceWithBookingRow[]; error: Error | null }> {
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

  const { data, error: initialError } = await query;
  let error = initialError;
  let normalizedData: BookingInstanceWithBookingRow[] = [];

  // Normalize data if query succeeded
  if (!error && data) {
    normalizedData = (data ?? []).map((row) =>
      normalizeInstanceRow(row as RawInstanceRow)
    );
  }

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
      // Map fallback data to BookingInstanceWithBookingRow format
      normalizedData = (fallbackResult.data ?? []).map((row) =>
        normalizeInstanceRow(row as RawInstanceRow)
      );
      error = null;
    } else {
      // If fallback also fails, return the original error
      error = fallbackResult.error;
    }
  }

  // Filter out cancelled bookings (but keep pending_cancellation until confirmed)
  // Supabase doesn't support filtering on joined table fields
  const validRows = normalizedData.filter((row) => {
    const status = row.booking?.status;
    // Only exclude fully cancelled bookings
    // pending_cancellation bookings should still appear and block capacity until confirmed
    // If status is undefined/null, include it (backward compatibility)
    if (!status) return true;
    return status !== 'cancelled';
  });

  return {
    data: validRows,
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
): Promise<{ data: BookingInstanceWithBookingRow[]; error: Error | null }> {
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

  const { data, error: initialError } = await query;
  let error = initialError;
  let normalizedData: BookingInstanceWithBookingRow[] = [];

  // Normalize data if query succeeded
  if (!error && data) {
    normalizedData = (data ?? []).map((row) =>
      normalizeInstanceRow(row as RawInstanceRow)
    );
  }

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
      // Map fallback data to BookingInstanceWithBookingRow format
      normalizedData = (fallbackResult.data ?? []).map((row) =>
        normalizeInstanceRow(row as RawInstanceRow)
      );
      error = null;
    } else {
      // If fallback also fails, return the original error
      error = fallbackResult.error;
    }
  }

  // Filter out cancelled bookings (but keep pending_cancellation until confirmed)
  // Supabase doesn't support filtering on joined table fields
  const validRows = normalizedData.filter((row) => {
    const status = row.booking?.status;
    // Only exclude fully cancelled bookings
    // pending_cancellation bookings should still appear and block capacity until confirmed
    // If status is undefined/null, include it (backward compatibility)
    if (!status) return true;
    return status !== 'cancelled';
  });

  return {
    data: validRows,
    error,
  };
}
