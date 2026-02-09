import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  published_at: string;
}

/**
 * Hook to fetch new announcements for the current user
 */
export function useAnnouncements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc('get_new_announcements', {
        p_user_id: user.id,
      });

      if (error) {
        console.error('Error fetching announcements:', error);
        // If function doesn't exist, return empty array (migration not run yet)
        if (error.message?.includes('function') || error.code === '42883') {
          console.warn(
            'get_new_announcements function not found. Run migrations/add_announcements.sql'
          );
        }
        return [];
      }

      console.log('Announcements fetched:', data);
      return (data ?? []) as Announcement[];
    },
    enabled: !!user?.id,
    staleTime: 0, // Always check for new announcements
  });

  // Mutation to acknowledge announcements
  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('acknowledge_announcements', {
        p_user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate to refresh the list (should be empty after ack)
      queryClient.invalidateQueries({
        queryKey: ['announcements', user?.id],
      });
    },
  });

  return {
    announcements,
    isLoading,
    hasNewAnnouncements: announcements.length > 0,
    acknowledge: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
  };
}
