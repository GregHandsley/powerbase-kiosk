import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { BookingStatus } from '../types/db';
import { endOfDay, parseISO, isAfter } from 'date-fns';
import { getUserNamesByIds } from '../utils/emailRecipients';

export type BookingsTeamFilter = {
  status?: BookingStatus | 'all';
  side?: 'Power' | 'Base' | 'all';
  dateFrom?: Date;
  dateTo?: Date;
  coachId?: string | 'all';
  organizationId?: string | 'all';
};

export type ProcessedSnapshot = {
  instanceCount: number;
  firstInstanceStart: string;
  firstInstanceEnd: string;
  firstInstanceCapacity?: number; // Deprecated - use allInstanceCapacities instead
  firstInstanceRacks: number[]; // Deprecated - use allInstanceRacks instead
  allRacks: number[];
  allInstanceStarts?: string[]; // Store all instance start dates for accurate deletion detection
  allInstanceTimes?: Array<{ start: string; end: string }>; // Store all instance times for accurate time change detection
  allInstanceCapacities?: Array<{ start: string; capacity: number }>; // Store capacity for each instance by date
  allInstanceRacks?: Array<{ start: string; racks: number[] }>; // Store racks for each instance by date
};

type BookingFromSupabase = {
  id: number;
  title: string;
  color: string | null;
  status: BookingStatus;
  created_at: string;
  created_by: string;
  last_edited_at: string | null;
  last_edited_by: string | null;
  processed_at: string | null;
  processed_by: string | null;
  processed_snapshot: ProcessedSnapshot | null;
  side:
    | {
        key: string;
        name: string;
      }
    | {
        key: string;
        name: string;
      }[]
    | null;
};

export type BookingForTeam = {
  id: number;
  title: string;
  color: string | null;
  status: BookingStatus;
  created_at: string;
  created_by: string;
  last_edited_at: string | null;
  last_edited_by: string | null;
  processed_at: string | null;
  processed_by: string | null;
  processed_snapshot: ProcessedSnapshot | null;
  side: {
    key: string;
    name: string;
  };
  creator: {
    id: string;
    full_name: string | null;
  } | null;
  processor: {
    id: string;
    full_name: string | null;
  } | null;
  instances: Array<{
    id: number;
    start: string;
    end: string;
    racks: number[];
    areas: string[];
    capacity?: number;
  }>;
};

export function useBookingsTeam(filters: BookingsTeamFilter = {}) {
  return useQuery<BookingForTeam[]>({
    queryKey: ['bookings-team', filters],
    queryFn: async () => {
      // Build base query
      let query = supabase
        .from('bookings')
        .select(
          `
          id,
          title,
          color,
          status,
          created_at,
          created_by,
          last_edited_at,
          last_edited_by,
          processed_at,
          processed_by,
          processed_snapshot,
          side:sides (
            key,
            name
          )
        `
        )
        .order('created_at', { ascending: false });

      // Apply status filter
      // When filtering for 'pending', also include 'pending_cancellation'
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'pending') {
          query = query.in('status', ['pending', 'pending_cancellation']);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Apply coach filter
      if (filters.coachId && filters.coachId !== 'all') {
        query = query.eq('created_by', filters.coachId);
      }

      // Apply side filter
      if (filters.side && filters.side !== 'all') {
        const { data: sideData } = await supabase
          .from('sides')
          .select('id')
          .eq('key', filters.side.toLowerCase())
          .maybeSingle();

        if (sideData) {
          query = query.eq('side_id', sideData.id);
        }
      }

      const { data: bookings, error } = await query;

      if (error) {
        console.error('Error fetching bookings for team:', error);
        throw error;
      }

      if (!bookings || bookings.length === 0) {
        return [];
      }

      // Fetch creator and processor profiles separately
      const creatorIds = new Set<string>();
      const processorIds = new Set<string>();
      bookings.forEach((booking: BookingFromSupabase) => {
        if (booking.created_by) creatorIds.add(booking.created_by);
        if (booking.processed_by) processorIds.add(booking.processed_by);
      });

      // Fetch all profiles at once using database function (bypasses RLS)
      const allProfileIds = Array.from(
        new Set([...creatorIds, ...processorIds])
      );
      const profilesMap = new Map<
        string,
        { id: string; full_name: string | null }
      >();

      if (allProfileIds.length > 0) {
        try {
          const nameMap = await getUserNamesByIds(allProfileIds);

          // Populate profiles map with fetched names
          nameMap.forEach((fullName, userId) => {
            profilesMap.set(userId, { id: userId, full_name: fullName });
          });
        } catch (error) {
          console.error('Error fetching user names:', error);
        }
      }

      // Fetch instances for each booking with date filtering
      // Filter out past sessions at database level to reduce data
      const currentTime = new Date();
      const bookingsWithInstances: BookingForTeam[] = await Promise.all(
        bookings.map(async (booking: BookingFromSupabase) => {
          let instancesQuery = supabase
            .from('booking_instances')
            .select('id, start, end, racks, areas, capacity')
            .eq('booking_id', booking.id)
            // Filter out past sessions: only include instances that haven't ended yet
            .gte('end', currentTime.toISOString())
            .order('start', { ascending: true });

          if (filters.dateFrom) {
            instancesQuery = instancesQuery.gte(
              'start',
              filters.dateFrom.toISOString()
            );
          }
          if (filters.dateTo) {
            instancesQuery = instancesQuery.lte(
              'start',
              endOfDay(filters.dateTo).toISOString()
            );
          }

          const { data: instances } = await instancesQuery;

          const creator = booking.created_by
            ? profilesMap.get(booking.created_by)
            : null;
          const processor = booking.processed_by
            ? profilesMap.get(booking.processed_by)
            : null;

          // Normalize side - Supabase may return it as an array or object
          const sideData = Array.isArray(booking.side)
            ? booking.side[0]
            : booking.side;
          const side = sideData || { key: '', name: '' };

          return {
            id: booking.id,
            title: booking.title,
            color: booking.color,
            status: booking.status || 'pending',
            created_at: booking.created_at,
            created_by: booking.created_by,
            last_edited_at: booking.last_edited_at,
            last_edited_by: booking.last_edited_by,
            processed_at: booking.processed_at,
            processed_by: booking.processed_by,
            processed_snapshot: booking.processed_snapshot
              ? (booking.processed_snapshot as ProcessedSnapshot)
              : null,
            side,
            creator: creator
              ? {
                  id: creator.id,
                  full_name: creator.full_name,
                }
              : null,
            processor: processor
              ? {
                  id: processor.id,
                  full_name: processor.full_name,
                }
              : null,
            instances: instances || [],
          };
        })
      );

      // Filter out bookings with no instances (if date filter was applied)
      const bookingsWithValidInstances = bookingsWithInstances.filter(
        (b) => b.instances.length > 0
      );

      // Sort by next session start time (earliest first)
      const now = new Date();
      return bookingsWithValidInstances.sort((a, b) => {
        // Find the next upcoming instance for each booking
        const getNextInstanceStart = (booking: BookingForTeam) => {
          const nextInstance = booking.instances.find((inst) => {
            const startTime = parseISO(inst.start);
            return isAfter(startTime, now);
          });
          // If no future instance, use the last instance (all in past)
          return nextInstance
            ? parseISO(nextInstance.start)
            : parseISO(booking.instances[booking.instances.length - 1].start);
        };

        const aNextStart = getNextInstanceStart(a);
        const bNextStart = getNextInstanceStart(b);

        return aNextStart.getTime() - bNextStart.getTime();
      });
    },
  });
}
