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

