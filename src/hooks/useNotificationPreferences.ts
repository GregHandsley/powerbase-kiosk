import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { NotificationType } from './useNotifications';

// Re-export NotificationType for convenience
export type { NotificationType } from './useNotifications';

export interface NotificationPreference {
  user_id: string;
  type: NotificationType;
  in_app: boolean;
  email: boolean;
  enabled: boolean;
  email_digest_enabled?: boolean;
  email_digest_frequency?: 'daily' | 'weekly' | 'never';
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferenceInput {
  in_app?: boolean;
  email?: boolean;
  enabled?: boolean;
  email_digest_enabled?: boolean;
  email_digest_frequency?: 'daily' | 'weekly' | 'never';
}

export interface NotificationPreferenceDefaults {
  type: NotificationType;
  in_app: boolean;
  email: boolean;
  enabled: boolean;
}

// Default preferences for each notification type
// All email notifications are OFF by default (opt-in)
const DEFAULT_PREFERENCES: Record<
  NotificationType,
  NotificationPreferenceDefaults
> = {
  'booking:created': {
    type: 'booking:created',
    in_app: true,
    email: false, // OFF by default
    enabled: true,
  },
  'booking:processed': {
    type: 'booking:processed',
    in_app: true,
    email: false, // OFF by default (changed from true)
    enabled: true,
  },
  'booking:edited': {
    type: 'booking:edited',
    in_app: true,
    email: false, // OFF by default
    enabled: true,
  },
  'booking:cancelled': {
    type: 'booking:cancelled',
    in_app: true,
    email: false, // OFF by default (changed from true)
    enabled: true,
  },
  last_minute_change: {
    type: 'last_minute_change',
    in_app: true,
    email: false, // OFF by default (changed from true)
    enabled: true,
  },
  'system:update': {
    type: 'system:update',
    in_app: true,
    email: false, // OFF by default
    enabled: true,
  },
  'feedback:response': {
    type: 'feedback:response',
    in_app: true,
    email: false, // OFF by default (changed from true)
    enabled: true,
  },
};

/**
 * Hook to fetch and manage INDIVIDUAL USER notification preferences
 *
 * This is for regular users to control what notifications they receive:
 * - Which notification types they want (booking:created, system:update, etc.)
 * - Whether to receive in-app notifications
 * - Whether to receive email notifications
 * - Master enable/disable per notification type
 *
 * For system-wide admin settings (notification windows, reminder schedules),
 * see useNotificationSettings() instead.
 */
export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all preferences for the current user
  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .order('type', { ascending: true });

      if (error) {
        console.error('Error fetching notification preferences:', error);
        throw error;
      }

      return (data ?? []) as NotificationPreference[];
    },
    enabled: !!user?.id,
  });

  // Get preference for a specific type, with defaults
  const getPreference = (
    type: NotificationType
  ): NotificationPreferenceDefaults => {
    const existing = preferences.find((p) => p.type === type);
    if (existing) {
      return {
        type: existing.type,
        in_app: existing.in_app,
        email: existing.email,
        enabled: existing.enabled,
      };
    }
    return DEFAULT_PREFERENCES[type];
  };

  // Update preference mutation
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({
      type,
      updates,
    }: {
      type: NotificationType;
      updates: UpdateNotificationPreferenceInput;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          type,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as NotificationPreference;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notification-preferences', user?.id],
      });
    },
  });

  // Reset all preferences to defaults
  const resetToDefaultsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Delete all existing preferences
      const { error: deleteError } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Preferences will be created on-demand with defaults
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notification-preferences', user?.id],
      });
    },
  });

  return {
    preferences,
    isLoading,
    getPreference,
    updatePreference: updatePreferenceMutation.mutateAsync,
    resetToDefaults: resetToDefaultsMutation.mutateAsync,
    isUpdating: updatePreferenceMutation.isPending,
    isResetting: resetToDefaultsMutation.isPending,
    defaultPreferences: DEFAULT_PREFERENCES,
  };
}
