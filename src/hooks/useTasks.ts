import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
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

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to most recent 50

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      return (data ?? []) as Task[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds (fallback)
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
  const unreadCount = tasks.filter((t) => !t.read_at).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (taskId: number) => {
      if (!user?.id) return;

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
 */
export async function createTask(input: CreateTaskInput): Promise<Task | null> {
  const { userId, type, title, message, link, metadata } = input;

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
    console.error('Error creating task:', error);
    return null;
  }

  return data as Task;
}

/**
 * Create tasks for multiple users (e.g., bookings team, facility manager)
 */
export async function createTasksForUsers(
  userIds: string[],
  input: Omit<CreateTaskInput, 'userId'>
): Promise<Task[]> {
  if (userIds.length === 0) return [];

  const tasks = userIds.map((userId) => ({
    user_id: userId,
    type: input.type,
    title: input.title,
    message: input.message || null,
    link: input.link || null,
    metadata: input.metadata || null,
  }));

  const { data, error } = await supabase.from('tasks').insert(tasks).select();

  if (error) {
    console.error('Error creating tasks:', error);
    return [];
  }

  return (data ?? []) as Task[];
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
 * Delete all tasks related to a specific booking when it's processed/resolved
 * This clears tasks like "booking:created", "booking:edited", "last_minute_change"
 * that are no longer relevant once the booking is processed
 */
export async function deleteTasksForBooking(bookingId: number): Promise<void> {
  try {
    // Delete tasks that reference this booking in their metadata
    // Types that should be cleared: booking:created, booking:edited, last_minute_change
    // Note: booking_id in metadata is stored as a number, so we extract it as text and compare
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('metadata->>booking_id', bookingId.toString())
      .in('type', ['booking:created', 'booking:edited', 'last_minute_change']);

    if (error) {
      console.error('Error deleting tasks for booking:', error);
      // Don't throw - this is a cleanup operation, shouldn't fail the main process
    }
  } catch (err) {
    console.error('Failed to delete tasks for booking:', err);
    // Don't throw - this is a cleanup operation
  }
}
