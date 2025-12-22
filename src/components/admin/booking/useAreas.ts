import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";

type AreaRow = {
  id: number;
  side_id: number;
  key: string;
  name: string;
};

/**
 * Hook to fetch areas from the database
 */
export function useAreas() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadAreas() {
      setAreasLoading(true);
      setAreasError(null);
      const { data, error } = await supabase
        .from("areas")
        .select("id, side_id, key, name")
        .order("side_id", { ascending: true })
        .order("name", { ascending: true });

      if (!isMounted) return;
      if (error) {
        console.warn("loadAreas error", error.message);
        setAreasError(error.message);
      } else {
        setAreas((data ?? []) as AreaRow[]);
      }
      setAreasLoading(false);
    }
    loadAreas();
    return () => {
      isMounted = false;
    };
  }, []);

  return { areas, areasLoading, areasError };
}

