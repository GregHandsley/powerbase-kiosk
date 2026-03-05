import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabaseClient';
import { getAreaSlotsForInstances } from '../../../../nodes/data/areaSlotsNodes';
import type { ActiveInstance } from '../../../../types/snapshot';
import type { SeriesInstance } from '../types';

export function useSeriesInstances(
  booking: ActiveInstance | null,
  isOpen: boolean
) {
  return useQuery<SeriesInstance[]>({
    queryKey: ['booking-series', booking?.bookingId],
    queryFn: async () => {
      if (!booking) return [];

      const { data, error } = await supabase
        .from('booking_instances')
        .select('id, start, end, racks, areas, side_id, capacity')
        .eq('booking_id', booking.bookingId)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching series instances:', error);
        return [];
      }

      const instances = (data ?? []).map((inst) => ({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        racks: Array.isArray(inst.racks) ? inst.racks : [],
        areas: Array.isArray(inst.areas) ? inst.areas : [],
        sideId: inst.side_id,
        capacity:
          typeof (inst as { capacity?: number }).capacity === 'number'
            ? (inst as { capacity: number }).capacity
            : undefined,
      }));

      const ids = instances.map((i) => i.id);
      const slotsByInstance = await getAreaSlotsForInstances(ids);
      return instances.map((inst) => ({
        ...inst,
        area_slots: slotsByInstance[inst.id] ?? [],
      }));
    },
    enabled: !!booking && isOpen,
  });
}
