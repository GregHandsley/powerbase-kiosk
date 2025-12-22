import { useState, useEffect } from "react";
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
 * Hook to fetch and manage period type overrides
 */
export function usePeriodTypeOverrides() {
  const [overrides, setOverrides] = useState<PeriodTypeOverride[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOverrides = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("period_type_capacity_overrides")
      .select("*")
      .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching overrides:", error);
      setLoading(false);
      return;
    }

    setOverrides((data as PeriodTypeOverride[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOverrides();
  }, []);

  return {
    overrides,
    loading,
    refetch: fetchOverrides,
  };
}

