import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// import { format } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';

// type PeriodType =
//   | 'High Hybrid'
//   | 'Low Hybrid'
//   | 'Performance'
//   | 'General User'
//   | 'Closed';

// interface PeriodTypeOverride {
//   id: number;
//   date: string;
//   period_type: PeriodType;
//   capacity: number;
//   booking_id: number | null;
//   notes: string | null;
// }

/**
 * Hook to handle booking deletion (selected instances or entire series)
 */
export function useDeleteBooking(onOverridesRefetch: () => void) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteSelectedInstances = async (
    bookingId: number,
    instanceIds: number[]
  ) => {
    if (instanceIds.length === 0) return false;

    setLoading(true);
    setError(null);
    try {
      // Delete the selected instances
      const { error: deleteError } = await supabase
        .from('booking_instances')
        .delete()
        .in('id', instanceIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Check if there are any remaining instances
      const { data: remainingInstances, error: checkError } = await supabase
        .from('booking_instances')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1);

      if (checkError) {
        console.warn('Error checking remaining instances:', checkError);
      }

      // If no instances remain, delete the booking
      if (!remainingInstances || remainingInstances.length === 0) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);

        if (bookingError) {
          console.warn(
            'Failed to delete booking after deleting all instances:',
            bookingError
          );
        }
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: ['booking-info', bookingId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-instances', bookingId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['snapshot'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-series'],
        exact: false,
      });

      // Refresh overrides
      onOverridesRefetch();

      return true;
    } catch (err) {
      console.error('Failed to delete instances', err);
      setError(
        `Failed to delete bookings: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteSeries = async (bookingId: number) => {
    setLoading(true);
    setError(null);
    try {
      // Delete all instances
      const { error: instancesError } = await supabase
        .from('booking_instances')
        .delete()
        .eq('booking_id', bookingId);

      if (instancesError) {
        throw new Error(instancesError.message);
      }

      // Delete the booking
      const { error: bookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (bookingError) {
        throw new Error(bookingError.message);
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: ['booking-info', bookingId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-instances', bookingId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['snapshot'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-series'],
        exact: false,
      });

      // Refresh overrides
      onOverridesRefetch();

      return true;
    } catch (err) {
      console.error('Failed to delete series', err);
      setError(
        `Failed to delete booking series: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    deleteSelectedInstances,
    deleteSeries,
    loading,
    error,
  };
}
