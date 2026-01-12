import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export type NotificationType =
  | 'last_minute_change'
  | 'booking:created'
  | 'booking:processed'
  | 'booking:edited'
  | 'booking:cancelled'
  | 'system:update';

export interface Notification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to fetch and manage notifications for the current user
 */
export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to most recent 50

      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }

      return (data ?? []) as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds (fallback)
  });

  // Realtime subscription for immediate updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Immediately invalidate and refetch notifications when a new one is created
          queryClient.invalidateQueries({
            queryKey: ['notifications', user.id],
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Also invalidate on updates (e.g., when marked as read)
          queryClient.invalidateQueries({
            queryKey: ['notifications', user.id],
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate on delete
          queryClient.invalidateQueries({
            queryKey: ['notifications', user.id],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Unread count
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Failed to delete notification:', error);
        throw new Error(error.message || 'Failed to delete notification');
      }

      // If no rows were deleted, the notification might not belong to this user or doesn't exist
      if (!data || data.length === 0) {
        console.warn(
          `Notification ${notificationId} not found or doesn't belong to user`
        );
        // Still invalidate to refresh the list
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
      // Show user-friendly error
      alert(
        `Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
  };
}

/**
 * Service function to create a notification
 * This can be called from anywhere in the app
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const { userId, type, title, message, link, metadata } = input;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message: message || null,
      link: link || null,
      metadata: metadata || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data as Notification;
}

/**
 * Create notifications for multiple users (e.g., bookings team, facility manager)
 */
export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<Notification[]> {
  if (userIds.length === 0) return [];

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type: input.type,
    title: input.title,
    message: input.message || null,
    link: input.link || null,
    metadata: input.metadata || null,
  }));

  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications)
    .select();

  if (error) {
    console.error('Error creating notifications:', error);
    return [];
  }

  return (data ?? []) as Notification[];
}

/**
 * Get user IDs for a specific role (e.g., all bookings team members)
 */
export async function getUserIdsByRole(
  role: 'admin' | 'coach' | 'bookings_team'
): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', role);

  if (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }

  return (data ?? []).map((p) => p.id);
}

/**
 * Delete all notifications related to a specific booking when it's processed/resolved
 * This clears notifications like "booking:created", "booking:edited", "last_minute_change"
 * that are no longer relevant once the booking is processed
 */
export async function deleteNotificationsForBooking(
  bookingId: number
): Promise<void> {
  try {
    // Delete notifications that reference this booking in their metadata
    // Types that should be cleared: booking:created, booking:edited, last_minute_change
    // Note: booking_id in metadata is stored as a number, so we extract it as text and compare
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('metadata->>booking_id', bookingId.toString())
      .in('type', ['booking:created', 'booking:edited', 'last_minute_change']);

    if (error) {
      console.error('Error deleting notifications for booking:', error);
      // Don't throw - this is a cleanup operation, shouldn't fail the main process
    }
  } catch (err) {
    console.error('Failed to delete notifications for booking:', err);
    // Don't throw - this is a cleanup operation
  }
}
