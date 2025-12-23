import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabaseClient";
import { format } from "date-fns";

type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

interface PeriodTypeDefault {
  id: number;
  period_type: PeriodType;
  default_capacity: number;
  side_id: number | null;
  platforms: number[] | null;
}

/**
 * Hook to save period type defaults
 */
export function useSaveDefault(
  defaults: Map<string, PeriodTypeDefault>,
  powerSideId: number | null,
  baseSideId: number | null,
  onSuccess: () => void
) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveDefault = async (
    periodType: PeriodType,
    sideKey: "Power" | "Base",
    capacity: number,
    platforms: number[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const sideId = sideKey === "Power" ? powerSideId : baseSideId;
      if (!sideId) {
        throw new Error(`Side ID not found for ${sideKey}`);
      }

      const key = `${periodType}_${sideId}`;
      const existing = defaults.get(key);

      // Get old default values BEFORE updating (to compare with existing schedules)
      const oldDefaultCapacity = existing?.default_capacity ?? null;
      const oldDefaultPlatforms = existing?.platforms ?? null;
      // Normalize old platforms to array for comparison
      const oldPlatformsArray = Array.isArray(oldDefaultPlatforms) 
        ? oldDefaultPlatforms.sort((a, b) => a - b)
        : oldDefaultPlatforms === null 
          ? null 
          : [];

      const updateData = {
        period_type: periodType,
        side_id: sideId,
        default_capacity: capacity,
        platforms: platforms,
      };

      if (existing && existing.id) {
        // Update existing
        const { error } = await supabase
          .from("period_type_capacity_defaults")
          .update(updateData)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new - first try to find if one exists with this period_type and side_id
        const { data: existingRecord } = await supabase
          .from("period_type_capacity_defaults")
          .select("id")
          .eq("period_type", periodType)
          .eq("side_id", sideId)
          .maybeSingle();

        if (existingRecord) {
          // Update existing record
          const { error } = await supabase
            .from("period_type_capacity_defaults")
            .update(updateData)
            .eq("id", existingRecord.id);

          if (error) throw error;
        } else {
          // Insert new record
          const { error } = await supabase
            .from("period_type_capacity_defaults")
            .insert(updateData);

          if (error) throw error;
        }
      }

      // Update existing capacity schedules that match the old default values
      // Only update schedules that haven't been customized
      if (oldDefaultCapacity !== null || oldDefaultPlatforms !== null) {
        // Fetch all capacity schedules with matching period_type and side_id
        const { data: schedules, error: schedulesError } = await supabase
          .from("capacity_schedules")
          .select("id, capacity, platforms")
          .eq("period_type", periodType)
          .eq("side_id", sideId);

        if (schedulesError) {
          console.error("Error fetching schedules to update:", schedulesError);
          // Don't throw - default was saved successfully, schedule updates are secondary
        } else if (schedules && schedules.length > 0) {
          // Normalize new platforms for comparison
          const newPlatformsArray = [...platforms].sort((a, b) => a - b);

          // Update schedules that match the old default
          const schedulesToUpdate: number[] = [];
          
          for (const schedule of schedules) {
            const schedulePlatforms = Array.isArray(schedule.platforms) 
              ? schedule.platforms.sort((a, b) => a - b)
              : schedule.platforms === null 
                ? null 
                : [];

            // Check if this schedule matches the old default
            const capacityMatches = schedule.capacity === oldDefaultCapacity;
            const platformsMatch = 
              oldPlatformsArray === null && schedulePlatforms === null
                ? true
                : oldPlatformsArray === null && Array.isArray(schedulePlatforms) && schedulePlatforms.length === 0
                  ? true
                  : Array.isArray(oldPlatformsArray) && Array.isArray(schedulePlatforms)
                    ? oldPlatformsArray.length === schedulePlatforms.length &&
                      oldPlatformsArray.every((p, i) => p === schedulePlatforms[i])
                    : false;

            // If both capacity and platforms match the old default, update to new default
            if (capacityMatches && platformsMatch) {
              schedulesToUpdate.push(schedule.id);
            }
          }

          // Update all matching schedules in batch
          if (schedulesToUpdate.length > 0) {
            const { error: updateError } = await supabase
              .from("capacity_schedules")
              .update({
                capacity: capacity,
                platforms: platforms.length > 0 ? platforms : null,
              })
              .in("id", schedulesToUpdate);

            if (updateError) {
              console.error("Error updating schedules:", updateError);
              // Don't throw - default was saved successfully
            } else {
              // Invalidate capacity schedules queries to refresh the UI
              await queryClient.invalidateQueries({ queryKey: ["capacity-schedules"], exact: false });
            }
          }
        }
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["default-platforms"], exact: false });
      
      // Wait for the refetch to complete before resolving
      await onSuccess();
    } catch (err) {
      console.error("Error saving default:", err);
      setError(err instanceof Error ? err.message : "Failed to save default capacity");
    } finally {
      setLoading(false);
    }
  };

  return {
    saveDefault,
    loading,
    error,
  };
}

