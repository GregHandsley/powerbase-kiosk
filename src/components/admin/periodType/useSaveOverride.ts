import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";

type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

interface PeriodTypeOverride {
  id: number;
  date: string;
  period_type: PeriodType;
  capacity: number;
  booking_id: number | null;
  notes: string | null;
}

/**
 * Hook to save period type overrides
 */
export function useSaveOverride(
  editingOverride: PeriodTypeOverride | null,
  overrideDate: string,
  overridePeriodType: PeriodType,
  overrideCapacity: number,
  overrideNotes: string,
  onSuccess: () => void
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveOverride = async () => {
    setLoading(true);
    setError(null);
    try {
      if (editingOverride) {
        // Update existing override
        const { error } = await supabase
          .from("period_type_capacity_overrides")
          .update({
            capacity: overrideCapacity,
            notes: overrideNotes || null,
          })
          .eq("id", editingOverride.id);

        if (error) throw error;
      } else {
        // Insert new override
        const { error } = await supabase.from("period_type_capacity_overrides").insert({
          date: overrideDate,
          period_type: overridePeriodType,
          capacity: overrideCapacity,
          notes: overrideNotes || null,
        });

        if (error) throw error;
      }

      onSuccess();
    } catch (err) {
      console.error("Error saving override:", err);
      setError(err instanceof Error ? err.message : "Failed to save override");
    } finally {
      setLoading(false);
    }
  };

  return {
    saveOverride,
    loading,
    error,
  };
}

