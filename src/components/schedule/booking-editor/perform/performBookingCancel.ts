import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabaseClient';
import {
  createTasksForUsers,
  getUserIdsByRole,
} from '../../../../hooks/useTasks';
import type { ActiveInstance } from '../../../../types/snapshot';
import type { SeriesInstance } from '../types';
import type { CancelMode } from '../types';

export type PerformBookingCancelParams = {
  booking: ActiveInstance;
  userId: string;
  seriesInstances: SeriesInstance[];
  cancelMode: CancelMode;
  setCancelling: (value: boolean) => void;
  setError: (value: string | null) => void;
  setShowCancelDialog: (value: boolean) => void;
  queryClient: QueryClient;
};

export async function performBookingCancel(
  params: PerformBookingCancelParams
): Promise<boolean> {
  const {
    booking,
    userId,
    seriesInstances,
    cancelMode,
    setCancelling,
    setError,
    setShowCancelDialog,
    queryClient,
  } = params;

  setCancelling(true);
  setError(null);

  try {
    const now = new Date();
    const selectedDate = new Date(booking.start);

    let instancesToCancel: number[] = [];

    if (cancelMode === 'single') {
      instancesToCancel = [booking.instanceId];
    } else if (cancelMode === 'future') {
      instancesToCancel = seriesInstances
        .filter((inst) => {
          const instDate = new Date(inst.start);
          return instDate >= selectedDate;
        })
        .map((inst) => inst.id);
    } else if (cancelMode === 'all') {
      instancesToCancel = seriesInstances.map((inst) => inst.id);
    }

    if (instancesToCancel.length === 0) {
      throw new Error('No instances to cancel');
    }

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('title, status, recurrence, processed_at, processed_snapshot')
      .eq('id', booking.bookingId)
      .single();

    if (!bookingData) {
      throw new Error('Booking not found');
    }

    const allInstancesCancelled =
      instancesToCancel.length === seriesInstances.length;

    const requiresFormalCancellation = Boolean(
      bookingData.status === 'processed' ||
      bookingData.status === 'pending_cancellation' ||
      bookingData.processed_at ||
      bookingData.processed_snapshot
    );

    if (!requiresFormalCancellation) {
      if (allInstancesCancelled) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            last_edited_at: now.toISOString(),
            last_edited_by: userId,
          })
          .eq('id', booking.bookingId);

        if (bookingError) {
          throw new Error(bookingError.message);
        }
      } else {
        const { error: deleteError } = await supabase
          .from('booking_instances')
          .delete()
          .in('id', instancesToCancel);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({
            last_edited_at: now.toISOString(),
            last_edited_by: userId,
          })
          .eq('id', booking.bookingId);

        if (bookingUpdateError) {
          throw new Error(bookingUpdateError.message);
        }
      }
    } else {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'pending_cancellation',
          last_edited_at: now.toISOString(),
          last_edited_by: userId,
        })
        .eq('id', booking.bookingId);

      if (bookingError) {
        throw new Error(bookingError.message);
      }

      if (userId) {
        const { data: bookingFullData } = await supabase
          .from('bookings')
          .select('organization_id, site_id, title, created_by')
          .eq('id', booking.bookingId)
          .single();

        if (bookingFullData?.organization_id) {
          const { ActivityLogger } =
            await import('../../../../lib/activityLogger');
          ActivityLogger.booking
            .cancellationRequested(
              bookingFullData.organization_id,
              bookingFullData.site_id ?? null,
              userId,
              booking.bookingId,
              {
                title: bookingFullData.title,
                cancel_mode: cancelMode,
                instances_cancelled: instancesToCancel.length,
                total_instances: seriesInstances.length,
              }
            )
            .catch((err) => {
              console.error(
                'Failed to log booking cancellation request activity:',
                err
              );
            });
        }
      }
    }

    let allNotifyIds: string[] = [];
    if (requiresFormalCancellation) {
      try {
        const bookingsTeamIds = await getUserIdsByRole('bookings_team');
        const adminIds = await getUserIdsByRole('admin');
        allNotifyIds = [...new Set([...bookingsTeamIds, ...adminIds])];

        if (allNotifyIds.length > 0) {
          const cancelledCount = instancesToCancel.length;
          const totalCount = seriesInstances.length;
          const isPartial = cancelledCount < totalCount;

          const createdTasks = await createTasksForUsers(allNotifyIds, {
            type: 'booking:cancelled',
            title: isPartial
              ? `Booking Partially Cancelled`
              : 'Booking Cancellation Request',
            message: isPartial
              ? `Booking "${bookingData.title || 'Untitled'}" has ${cancelledCount} of ${totalCount} sessions marked for cancellation.`
              : `Booking "${bookingData.title || 'Untitled'}" has been requested for cancellation and needs to be removed from Legend.`,
            link: `/bookings-team?booking=${booking.bookingId}`,
            metadata: {
              booking_id: booking.bookingId,
              booking_title: bookingData.title || null,
              cancelled_by: userId,
              cancelled_instance_ids: instancesToCancel,
              cancel_mode: cancelMode,
              is_partial: isPartial,
            },
          });

          if (createdTasks.length > 0) {
            await Promise.all(
              allNotifyIds.map((id) =>
                queryClient.invalidateQueries({ queryKey: ['tasks', id] })
              )
            );
          }
        }
      } catch (taskError) {
        console.error('Failed to create tasks for cancellation:', taskError);
        if (taskError instanceof Error) {
          console.error('Task creation error details:', {
            message: taskError.message,
            stack: taskError.stack,
            bookingId: booking.bookingId,
            allNotifyIds,
          });
        }
        setError(
          `Booking cancelled, but failed to notify bookings team. Please check console for details.`
        );
      }
    }

    await queryClient.invalidateQueries({
      queryKey: ['snapshot'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-instances-debug'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-instances-for-time'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-series'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-series-racks'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['schedule-bookings'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['bookings-team'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['my-bookings'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['tasks'],
      exact: false,
    });
    await queryClient.refetchQueries({
      queryKey: ['snapshot'],
      exact: false,
    });
    return true;
  } catch (err) {
    console.error('Failed to cancel booking', err);
    setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    return false;
  } finally {
    setCancelling(false);
    setShowCancelDialog(false);
  }
}
