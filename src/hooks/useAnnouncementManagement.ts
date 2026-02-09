import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  published_at: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  published_at?: string; // If not provided, uses now()
  active?: boolean; // Defaults to true
  expires_at?: string | null; // Optional expiry date
}

/**
 * Hook for admins to manage announcements (CRUD operations)
 */
export function useAnnouncementManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all announcements
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('published_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        throw error;
      }

      return (data ?? []) as Announcement[];
    },
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      if (!user?.id) throw new Error('User not authenticated');

      const insertData: Record<string, unknown> = {
        title: input.title.trim(),
        message: input.message.trim(),
        published_at: input.published_at || new Date().toISOString(),
        active: input.active ?? true,
        created_by: user.id,
      };

      // Only include expires_at if it's provided (column may not exist if migration hasn't run)
      if (input.expires_at) {
        insertData.expires_at = input.expires_at;
      }

      const { data, error } = await supabase
        .from('announcements')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] }); // Invalidate user-facing query too
      toast.success('Announcement created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create announcement: ${error.message}`);
    },
  });

  // Update announcement mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<CreateAnnouncementInput & { active: boolean }>;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (updates.title) updateData.title = updates.title.trim();
      if (updates.message) updateData.message = updates.message.trim();
      if (updates.published_at) updateData.published_at = updates.published_at;
      if (updates.active !== undefined) updateData.active = updates.active;
      // Only include expires_at if it's explicitly set (column may not exist if migration hasn't run)
      if (updates.expires_at !== undefined && updates.expires_at !== null) {
        updateData.expires_at = updates.expires_at;
      } else if (updates.expires_at === null) {
        // Only set to null if explicitly null (migration must be run first)
        updateData.expires_at = null;
      }

      const { data, error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update announcement: ${error.message}`);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const { data, error } = await supabase
        .from('announcements')
        .update({ active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success(
        `Announcement ${variables.active ? 'activated' : 'deactivated'}`
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to toggle announcement: ${error.message}`);
    },
  });

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete announcement: ${error.message}`);
    },
  });

  return {
    announcements,
    isLoading,
    createAnnouncement: createMutation.mutateAsync,
    updateAnnouncement: updateMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    deleteAnnouncement: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isToggling: toggleActiveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
