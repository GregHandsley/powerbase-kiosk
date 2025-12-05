import { useEffect, useState } from "react";
import { getSideSnapshot } from "../snapshot";
import type { SideSnapshot } from "../types";
import { supabase } from "../supabaseClient";

export function useSideSnapshot(sideKey: "Power" | "Base") {
  const [snapshot, setSnapshot] = useState<SideSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const now = new Date();
        const data = await getSideSnapshot(sideKey, now);
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err: unknown) {
        console.error("useSideSnapshot error", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }
    };

    // initial load
    load();

    // realtime subscription: any change in booking_instances -> reload
    const channel = supabase
      .channel(`booking_instances_${sideKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_instances",
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sideKey]);

  return { snapshot, error };
}
