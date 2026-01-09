import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export interface EmailPreferences {
  user_id: string;
  receive_last_minute_alerts: boolean;
  receive_reminder_emails: boolean;
  reminder_frequency: "daily" | "weekly" | "never";
  receive_confirmation_emails: boolean;
  updated_at: string;
}

export interface UpdateEmailPreferencesInput {
  receive_last_minute_alerts?: boolean;
  receive_reminder_emails?: boolean;
  reminder_frequency?: "daily" | "weekly" | "never";
  receive_confirmation_emails?: boolean;
}

/**
 * Hook to fetch and manage user email preferences
 */
export function useEmailPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["email-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("email_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found", which is fine (will create on first update)
        console.error("Error fetching email preferences:", error);
        throw error;
      }

      // If no preferences exist, return defaults
      if (!data) {
        return {
          user_id: user.id,
          receive_last_minute_alerts: true,
          receive_reminder_emails: true,
          reminder_frequency: "daily" as const,
          receive_confirmation_emails: true,
          updated_at: new Date().toISOString(),
        } as EmailPreferences;
      }

      return data as EmailPreferences;
    },
    enabled: !!user?.id,
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateEmailPreferencesInput) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("email_notification_preferences")
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-preferences", user?.id] });
    },
  });

  return {
    preferences,
    isLoading,
    updatePreferences: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

