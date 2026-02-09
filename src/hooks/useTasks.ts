import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import {
  createNotification,
  createNotificationsForUsers,
} from './useNotifications';
import type { NotificationType } from './useNotifications';
import { useAuth } from '../context/AuthContext';

export type TaskType =
  | 'last_minute_change'
  | 'booking:created'
  | 'booking:processed'
  | 'booking:edited'
  | 'booking:cancelled'
  | 'system:update';

export interface Task {
  id: number;
  user_id: string;
  type: TaskType;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface CreateTaskInput {
  userId: string;
  type: TaskType;
  title: string;
  message?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to fetch and manage tasks for the current user
 */
export function useTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch tasks - dynamically generated from pending bookings
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const now = new Date();
      const generatedTasks: Task[] = [];

      // Check if user is admin or bookings_team
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const isBookingsTeam =
        profile?.role === 'admin' || profile?.role === 'bookings_team';

      if (isBookingsTeam) {
        // Fetch pending bookings and pending cancellations
        const { data: pendingBookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(
            `
            id,
            title,
            status,
            created_at,
            last_edited_at,
            last_minute_change,
            side:sides (
              name
            )
          `
          )
          .in('status', ['pending', 'pending_cancellation'])
          .order('created_at', { ascending: false });

        if (bookingsError) {
          console.error('Error fetching pending bookings:', bookingsError);
        } else if (pendingBookings) {
          // Generate tasks from pending bookings
          for (const booking of pendingBookings) {
            // Check if booking has future instances (not past)
            const { data: instances } = await supabase
              .from('booking_instances')
              .select('start, end')
              .eq('booking_id', booking.id)
              .gte('end', now.toISOString())
              .limit(1);

            // Only create task if booking has future instances
            if (instances && instances.length > 0) {
              // Normalize side - Supabase may return it as an array or object
              const sideData = Array.isArray(booking.side)
                ? booking.side[0]
                : booking.side;
              const sideName = sideData?.name || 'Unknown';

              if (booking.status === 'pending_cancellation') {
                // For cancellations, use last_edited_at (when cancellation was requested) or created_at as fallback
                const cancellationDate =
                  booking.last_edited_at || booking.created_at;
                generatedTasks.push({
                  id: -booking.id, // Negative ID to avoid conflicts with real tasks
                  user_id: user.id,
                  type: 'booking:cancelled',
                  title: 'Pending Cancellation',
                  message: `Booking "${booking.title}" (${sideName}) is pending cancellation.`,
                  link: `/bookings-team?booking=${booking.id}`,
                  read_at: null,
                  created_at: cancellationDate,
                  metadata: {
                    booking_id: booking.id,
                    booking_title: booking.title,
                  },
                });
              } else {
                // Regular pending booking
                generatedTasks.push({
                  id: -booking.id, // Negative ID to avoid conflicts with real tasks
                  user_id: user.id,
                  type: booking.last_minute_change
                    ? 'last_minute_change'
                    : 'booking:created',
                  title: booking.last_minute_change
                    ? 'Last-Minute Booking Created'
                    : 'New Booking Created',
                  message: booking.last_minute_change
                    ? `Booking "${booking.title}" (${sideName}) was created after the notification window deadline.`
                    : `New booking "${booking.title}" (${sideName}) requires processing.`,
                  link: `/bookings-team?booking=${booking.id}`,
                  read_at: null,
                  created_at: booking.created_at,
                  metadata: {
                    booking_id: booking.id,
                    booking_title: booking.title,
                    is_last_minute: booking.last_minute_change || false,
                  },
                });
              }
            }
          }
        }
      }

      // Also fetch any other non-booking tasks (system updates, etc.)
      // Exclude booking-related tasks since we generate them dynamically
      const bookingTaskTypes = [
        'booking:created',
        'booking:edited',
        'last_minute_change',
        'booking:cancelled',
      ];
      const { data: allOtherTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('metadata->>channel', 'task')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter out booking-related tasks in JavaScript
      const otherTasks =
        allOtherTasks?.filter(
          (t) => !bookingTaskTypes.includes(t.type as TaskType)
        ) || [];

      if (tasksError) {
        console.error('Error fetching other tasks:', tasksError);
      }

      // Combine generated booking tasks with other tasks
      const allTasks = [...generatedTasks, ...(otherTasks || [])].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allTasks as Task[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Realtime subscription for immediate updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`tasks:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Immediately invalidate and refetch tasks when a new one is created
          queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
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
          queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
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
          queryClient.invalidateQueries({ queryKey: ['tasks', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Unread count (tasks that need attention)
  // Generated tasks (negative IDs) are always "unread" until booking is processed
  const unreadCount = tasks.filter((t) => !t.read_at || t.id < 0).length;

  // Mark as read mutation
  // Note: Generated booking tasks (negative IDs) cannot be marked as read
  const markAsReadMutation = useMutation({
    mutationFn: async (taskId: number) => {
      if (!user?.id) return;

      // Generated tasks (negative IDs) cannot be marked as read
      if (taskId < 0) {
        console.warn(
          'Cannot mark generated task as read - it will disappear when booking is processed'
        );
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ read_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
  });

  // Mark all as read mutation
  // Note: Generated booking tasks (negative IDs) cannot be marked as read
  // They will disappear when the booking is processed
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      // Only mark real tasks (positive IDs) as read
      // Get all real task IDs that are unread
      const realUnreadTasks = tasks.filter((t) => t.id > 0 && !t.read_at);

      if (realUnreadTasks.length === 0) return;

      const taskIds = realUnreadTasks.map((t) => t.id);

      const { error } = await supabase
        .from('tasks')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('id', taskIds)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Failed to delete task:', error);
        throw new Error(error.message || 'Failed to delete task');
      }

      // If no rows were deleted, the task might not belong to this user or doesn't exist
      if (!data || data.length === 0) {
        console.warn(`Task ${taskId} not found or doesn't belong to user`);
        // Still invalidate to refresh the list
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      // Show user-friendly error
      alert(
        `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    },
  });

  return {
    tasks,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
  };
}

/**
 * Service function to create a task
 * This can be called from anywhere in the app
 * Respects notification preferences and sends email if enabled
 */
export async function createTask(input: CreateTaskInput): Promise<Task | null> {
  const notification = await createNotification({
    userId: input.userId,
    type: input.type as NotificationType,
    title: input.title,
    message: input.message,
    link: input.link,
    metadata: {
      ...(input.metadata || {}),
      channel: 'task',
    },
  });

  return notification as Task | null;
}

/**
 * Create tasks for multiple users (e.g., bookings team, facility manager)
 * Respects notification preferences and sends email if enabled
 */
export async function createTasksForUsers(
  userIds: string[],
  input: Omit<CreateTaskInput, 'userId'>
): Promise<Task[]> {
  const notifications = await createNotificationsForUsers(userIds, {
    type: input.type as NotificationType,
    title: input.title,
    message: input.message,
    link: input.link,
    metadata: {
      ...(input.metadata || {}),
      channel: 'task',
    },
  });

  return notifications as Task[];
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
 * Delete all tasks related to a specific booking when it's processed/resolved
 * This clears tasks like "booking:created", "booking:edited", "last_minute_change"
 * that are no longer relevant once the booking is processed
 */
export async function deleteTasksForBooking(bookingId: number): Promise<void> {
  try {
    // Delete tasks that reference this booking in their metadata
    // Types that should be cleared: booking:created, booking:edited, last_minute_change, booking:cancelled
    // Note: booking_id in metadata is stored as a number, so we extract it as text and compare
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('metadata->>booking_id', bookingId.toString())
      .in('type', [
        'booking:created',
        'booking:edited',
        'last_minute_change',
        'booking:cancelled',
      ]);

    if (error) {
      console.error('Error deleting tasks for booking:', error);
      // Don't throw - this is a cleanup operation, shouldn't fail the main process
    }
  } catch (err) {
    console.error('Failed to delete tasks for booking:', err);
    // Don't throw - this is a cleanup operation
  }
}
