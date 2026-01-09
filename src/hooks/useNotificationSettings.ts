import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export interface NotificationSettings {
  id: number;
  notification_window_enabled: boolean;
  notification_window_day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  notification_window_time: string; // "HH:mm:ss"
  hard_restriction_enabled: boolean;
  hard_restriction_hours: number;
  last_minute_alert_roles: string[];
  last_minute_alert_user_ids: string[];
  reminder_emails_enabled: boolean;
  reminder_schedule: Array<{
    time: string; // "HH:mm"
    days: number[]; // [1,2,3,4,5] for weekdays
    frequency: "daily" | "weekly";
  }>;
  reminder_recipient_roles: string[];
  reminder_recipient_user_ids: string[];
  updated_at: string;
  updated_by: string | null;
}

export interface UpdateNotificationSettingsInput {
  notification_window_enabled?: boolean;
  notification_window_day_of_week?: number;
  notification_window_time?: string;
  hard_restriction_enabled?: boolean;
  hard_restriction_hours?: number;
  last_minute_alert_roles?: string[];
  last_minute_alert_user_ids?: string[];
  reminder_emails_enabled?: boolean;
  reminder_schedule?: Array<{
    time: string;
    days: number[];
    frequency: "daily" | "weekly";
  }>;
  reminder_recipient_roles?: string[];
  reminder_recipient_user_ids?: string[];
}

/**
 * Hook to fetch and manage notification settings
 */
export function useNotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error) {
        console.error("Error fetching notification settings:", error);
        throw error;
      }

      return data as NotificationSettings;
    },
    retry: 1,
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateNotificationSettingsInput) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("notification_settings")
        .update({
          ...updates,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1)
        .select()
        .single();

      if (error) throw error;
      return data as NotificationSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

