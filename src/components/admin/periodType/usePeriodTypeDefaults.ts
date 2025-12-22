import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";

type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

interface PeriodTypeDefault {
  id: number;
  period_type: PeriodType;
  default_capacity: number;
  side_id: number | null;
  platforms: number[] | null;
}

/**
 * Hook to fetch and manage period type defaults
 */
export function usePeriodTypeDefaults() {
  const [defaults, setDefaults] = useState<Map<string, PeriodTypeDefault>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchDefaults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("period_type_capacity_defaults")
      .select("*")
      .order("period_type");

    if (error) {
      console.error("Error fetching defaults:", error);
      setLoading(false);
      return;
    }

    const defaultsMap = new Map<string, PeriodTypeDefault>();
    data?.forEach((default_) => {
      const sideId = default_.side_id || null;
      const key = `${default_.period_type}_${sideId || 'null'}`;
      const platforms = Array.isArray(default_.platforms) ? default_.platforms : [];
      defaultsMap.set(key, {
        ...default_,
        platforms: platforms as number[],
      } as PeriodTypeDefault);
    });

    setDefaults(defaultsMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchDefaults();
  }, []);

  return {
    defaults,
    loading,
    refetch: async () => {
      await fetchDefaults();
    },
  };
}

