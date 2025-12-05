import { useEffect, useState } from "react";
import { getSnapshot } from "../snapshot";
import type { Snapshot } from "../types";
import { supabase } from "../supabaseClient";

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const now = new Date();
        const data = await getSnapshot(now);
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err: unknown) {
        console.error("useSnapshot error", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }
    };

    load();

    const channel = supabase
      .channel("booking_instances_both")
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
  }, []);

  return { snapshot, error };
}
