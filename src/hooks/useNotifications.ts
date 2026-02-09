import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { sendEmail } from '../services/email/emailService';
import { getUserEmailsByIds } from '../utils/emailRecipients';
import { useAuth } from '../context/AuthContext';

export type NotificationType =
  | 'last_minute_change'
  | 'booking:created'
  | 'booking:processed'
  | 'booking:edited'
  | 'booking:cancelled'
  | 'system:update'
  | 'feedback:response';

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

function formatNotificationType(type: NotificationType): string {
  const typeMap: Record<NotificationType, string> = {
    'booking:created': 'Booking Created',
    'booking:processed': 'Booking Processed',
    'booking:edited': 'Booking Edited',
    'booking:cancelled': 'Booking Cancelled',
    last_minute_change: 'Last Minute Change',
    'system:update': 'System Update',
    'feedback:response': 'Feedback Response',
  };
  return typeMap[type] || type;
}

function buildNotificationEmailHtml(input: CreateNotificationInput): string {
  const appUrl = window.location.origin;
  const linkUrl = input.link ? `${appUrl}${input.link}` : null;
  const safeMessage = input.message
    ? `<p style="margin: 12px 0; color: #d1d5db;">${input.message}</p>`
    : '';
  const linkHtml = linkUrl
    ? `<p style="margin: 16px 0;"><a href="${linkUrl}" style="color: #7c8cff; text-decoration: none;">View in app</a></p>`
    : '';

  return `
    <div style="background:#0f172a; padding:24px; font-family: Arial, sans-serif; color:#e2e8f0;">
      <div style="max-width:600px; margin:0 auto; background:#111827; border:1px solid #1f2937; border-radius:12px; padding:24px;">
        <h2 style="margin:0 0 12px 0; color:#f8fafc;">${input.title}</h2>
        ${safeMessage}
        ${linkHtml}
        <p style="margin:24px 0 0; font-size:12px; color:#94a3b8;">
          You can manage notification preferences in your Profile settings.
        </p>
      </div>
    </div>
  `;
}

async function sendNotificationEmailIfAllowed(
  userId: string,
  input: CreateNotificationInput
): Promise<void> {
  try {
    const { data: shouldSendEmail, error: prefError } = await supabase.rpc(
      'should_send_notification',
      {
        p_user_id: userId,
        p_type: input.type,
        p_channel: 'email',
      }
    );

    if (prefError) {
      console.warn('Error checking email notification preferences:', prefError);
      return;
    }

    if (shouldSendEmail !== true) {
      return;
    }

    const emailMap = await getUserEmailsByIds([userId]);
    const toEmail = emailMap.get(userId);
    if (!toEmail) {
      console.warn('No email found for user, skipping notification email', {
        userId,
        type: input.type,
      });
      return;
    }

    const subject = `${formatNotificationType(input.type)}: ${input.title}`;
    const html = buildNotificationEmailHtml(input);
    const result = await sendEmail({
      to: toEmail,
      subject,
      html,
    });

    if (!result.success) {
      console.error('Failed to send notification email:', result.error);
    }
  } catch (error) {
    console.error('Unexpected error sending notification email:', error);
  }
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
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('read_at', null) // Only show unread notifications
        .or('metadata->>channel.is.null,metadata->>channel.neq.task')
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
          table: 'tasks',
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
          table: 'tasks',
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
          table: 'tasks',
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
        .from('tasks')
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
        .from('tasks')
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
        .from('tasks')
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
 * This respects user notification preferences (checks if in-app notifications are enabled)
 * This can be called from anywhere in the app
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const { userId, type, title, message, link, metadata } = input;

  // Check user's notification preferences using the database function
  const { data: shouldSend, error: prefError } = await supabase.rpc(
    'should_send_notification',
    {
      p_user_id: userId,
      p_type: type,
      p_channel: 'in_app',
    }
  );

  // If preference check fails, log but continue (fail-open for reliability)
  if (prefError) {
    console.warn('Error checking notification preferences:', prefError);
    // Continue with notification creation (fail-open)
  } else if (shouldSend === false) {
    // User has disabled in-app notifications for this type
    console.log(
      `Skipping in-app notification for user ${userId}, type ${type} (preference disabled)`
    );
    return null;
  }

  const { data, error } = await supabase
    .from('tasks')
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

  // Send email notification if allowed by user preferences
  void sendNotificationEmailIfAllowed(userId, input);

  return data as Notification;
}

/**
 * Create notifications for multiple users (e.g., bookings team, facility manager)
 * Respects each user's notification preferences
 */
export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<Notification[]> {
  if (userIds.length === 0) return [];

  // Check preferences for each user and filter out those who have disabled notifications
  const usersToNotify: string[] = [];
  for (const userId of userIds) {
    const { data: shouldSend, error: prefError } = await supabase.rpc(
      'should_send_notification',
      {
        p_user_id: userId,
        p_type: input.type,
        p_channel: 'in_app',
      }
    );

    // Fail-open: if preference check fails, include the user
    if (prefError) {
      console.warn(
        `Error checking notification preferences for user ${userId}:`,
        prefError
      );
      usersToNotify.push(userId);
    } else if (shouldSend === true) {
      usersToNotify.push(userId);
    } else {
      console.log(
        `Skipping notification for user ${userId}, type ${input.type} (preference disabled)`
      );
    }
  }

  if (usersToNotify.length === 0) {
    return [];
  }

  const notifications = usersToNotify.map((userId) => ({
    user_id: userId,
    type: input.type,
    title: input.title,
    message: input.message || null,
    link: input.link || null,
    metadata: input.metadata || null,
  }));

  const { data, error } = await supabase
    .from('tasks')
    .insert(notifications)
    .select();

  if (error) {
    console.error('Error creating notifications:', error);
    return [];
  }

  // Send email notifications for users who have email enabled (and digest disabled)
  void Promise.all(
    usersToNotify.map((userId) =>
      sendNotificationEmailIfAllowed(userId, { ...input, userId })
    )
  );

  return (data ?? []) as Notification[];
}

/**
 * Get user IDs for a specific role (e.g., all bookings team members)
 * Now queries organization_memberships instead of profiles (2.3.1)
 */
export async function getUserIdsByRole(
  role:
    | 'admin'
    | 'bookings_team'
    | 'snc_coach'
    | 'fitness_coach'
    | 'customer_service_assistant'
    | 'duty_manager'
): Promise<string[]> {
  // Query organization_memberships for the role
  // Note: This gets users from ALL organizations with this role
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('role', role);

  if (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }

  return (data ?? []).map((m) => m.user_id);
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
      .from('tasks')
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
