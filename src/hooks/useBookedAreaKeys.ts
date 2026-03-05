/**
 * Fetches area keys that are already booked for the given side and time range,
 * and free intervals per area for partially available areas.
 * Used by the create-booking flow to grey out "Booked", show "Partially available", and restrict time options.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { addWeeks } from 'date-fns';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { combineDateAndTime } from '../components/admin/booking/utils';
import { getAreaSlotsForInstances } from '../nodes/data/areaSlotsNodes';

function slotsOverlap(
  slotStartIso: string,
  slotEndIso: string,
  windowStartIso: string,
  windowEndIso: string
): boolean {
  return slotStartIso < windowEndIso && slotEndIso > windowStartIso;
}

/** Merge busy intervals (ISO) and subtract from window to get free intervals (HH:mm). */
function mergeAndSubtract(
  busy: Array<{ start: string; end: string }>,
  windowStartIso: string,
  windowEndIso: string
): Array<{ start: string; end: string }> {
  const windowStartMs = new Date(windowStartIso).getTime();
  const windowEndMs = new Date(windowEndIso).getTime();
  if (busy.length === 0) {
    return [
      {
        start: format(new Date(windowStartMs), 'HH:mm'),
        end: format(new Date(windowEndMs), 'HH:mm'),
      },
    ];
  }
  const sorted = [...busy].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  const merged: Array<{ start: string; end: string }> = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ start: b.start, end: b.end });
      continue;
    }
    const lastEnd = new Date(last.end).getTime();
    if (new Date(b.start).getTime() <= lastEnd) {
      if (new Date(b.end).getTime() > lastEnd) last.end = b.end;
    } else {
      merged.push({ start: b.start, end: b.end });
    }
  }
  const free: Array<{ start: string; end: string }> = [];
  let pos = windowStartMs;
  for (const seg of merged) {
    const segStart = new Date(seg.start).getTime();
    const segEnd = new Date(seg.end).getTime();
    if (segStart > pos) {
      free.push({
        start: format(new Date(pos), 'HH:mm'),
        end: format(new Date(Math.min(segStart, windowEndMs)), 'HH:mm'),
      });
    }
    pos = Math.max(pos, segEnd);
    if (pos >= windowEndMs) break;
  }
  if (pos < windowEndMs) {
    free.push({
      start: format(new Date(pos), 'HH:mm'),
      end: format(new Date(windowEndMs), 'HH:mm'),
    });
  }
  return free;
}

export function useBookedAreaKeys(
  sideId: number | null,
  startDate: string | null,
  startTime: string | null,
  endTime: string | null,
  currentWeekIndex: number
): {
  bookedAreaKeys: Set<string>;
  freeIntervalsByArea: Map<string, Array<{ start: string; end: string }>>;
  isLoading: boolean;
} {
  const startIso =
    startDate && startTime
      ? addWeeks(
          combineDateAndTime(startDate, startTime),
          currentWeekIndex
        ).toISOString()
      : null;
  const endIso =
    startDate && endTime
      ? addWeeks(
          combineDateAndTime(startDate, endTime),
          currentWeekIndex
        ).toISOString()
      : null;

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['booking-instances-for-areas', sideId, startIso, endIso],
    queryFn: async () => {
      if (!sideId || !startIso || !endIso) return [];

      const { data, error } = await supabase
        .from('booking_instances')
        .select(
          `
          id,
          booking:bookings ( status )
        `
        )
        .eq('side_id', sideId)
        .lt('start', endIso)
        .gt('end', startIso)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching instances for booked areas:', error);
        return [];
      }

      const valid = (data ?? []).filter(
        (row: { id: unknown; booking?: Array<{ status?: string }> | null }) => {
          const status = row.booking?.[0]?.status;
          if (!status) return true;
          return status !== 'cancelled';
        }
      );

      return valid as Array<{ id: number }>;
    },
    enabled: !!sideId && !!startIso && !!endIso,
  });

  const { data: areaData, isLoading: slotsLoading } = useQuery({
    queryKey: [
      'booked-area-keys-and-intervals',
      instances
        .map((i) => i.id)
        .sort()
        .join(','),
      startIso ?? '',
      endIso ?? '',
    ],
    queryFn: async () => {
      if (instances.length === 0 || !startIso || !endIso)
        return {
          bookedAreaKeys: [] as string[],
          freeIntervalsByArea: {} as Record<
            string,
            Array<{ start: string; end: string }>
          >,
        };

      const ids = instances.map((i) => i.id);
      const slotsByInstance = await getAreaSlotsForInstances(ids);
      const booked: string[] = [];
      const busyByArea: Record<
        string,
        Array<{ start: string; end: string }>
      > = {};

      for (const inst of instances) {
        const slots = slotsByInstance[inst.id] ?? [];
        for (const slot of slots) {
          if (slot.area_key.startsWith('rack_')) continue;
          if (!slotsOverlap(slot.start, slot.end, startIso, endIso)) continue;
          booked.push(slot.area_key);
          const overlapStart = new Date(
            Math.max(
              new Date(slot.start).getTime(),
              new Date(startIso).getTime()
            )
          ).toISOString();
          const overlapEnd = new Date(
            Math.min(new Date(slot.end).getTime(), new Date(endIso).getTime())
          ).toISOString();
          if (!busyByArea[slot.area_key]) busyByArea[slot.area_key] = [];
          busyByArea[slot.area_key].push({
            start: overlapStart,
            end: overlapEnd,
          });
        }
      }

      const freeIntervalsByArea: Record<
        string,
        Array<{ start: string; end: string }>
      > = {};
      for (const areaKey of Object.keys(busyByArea)) {
        const free = mergeAndSubtract(busyByArea[areaKey], startIso, endIso);
        if (free.length > 0) freeIntervalsByArea[areaKey] = free;
      }

      return {
        bookedAreaKeys: [...new Set(booked)],
        freeIntervalsByArea,
      };
    },
    enabled: instances.length > 0 && !!startIso && !!endIso,
  });

  const bookedAreaKeys = useMemo(
    () => new Set(areaData?.bookedAreaKeys ?? []),
    [areaData?.bookedAreaKeys]
  );

  const freeIntervalsByArea = useMemo(() => {
    const map = new Map<string, Array<{ start: string; end: string }>>();
    const raw = areaData?.freeIntervalsByArea ?? {};
    for (const [k, v] of Object.entries(raw)) map.set(k, v);
    return map;
  }, [areaData?.freeIntervalsByArea]);

  return {
    bookedAreaKeys,
    freeIntervalsByArea,
    isLoading: isLoading || slotsLoading,
  };
}
