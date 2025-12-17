import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabaseClient";
import type { ActiveInstance } from "../../../../types/snapshot";

export function useRackAssignments(bookings: ActiveInstance[]) {
  const queryClient = useQueryClient();

  const bookingById = useMemo(() => {
    const map = new Map<number, ActiveInstance>();
    bookings.forEach((b) => map.set(b.instanceId, b));
    return map;
  }, [bookings]);

  const initialAssignments = useMemo(() => {
    const map = new Map<number, number[]>(); // bookingId -> racks[]
    bookings.forEach((b) => {
      const nums = (b.racks ?? []).filter((r): r is number => typeof r === "number");
      if (nums.length) {
        map.set(b.instanceId, nums);
      }
    });
    return map;
  }, [bookings]);

  const [assignments, setAssignments] = useState<Map<number, number[]>>(initialAssignments);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const mapsEqual = (a: Map<number, number[]>, b: Map<number, number[]>) => {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      const other = b.get(k);
      if (!other || other.length !== v.length) return false;
      for (let i = 0; i < v.length; i++) {
        if (v[i] !== other[i]) return false;
      }
    }
    return true;
  };

  // Refresh assignments when snapshot/bookings change, but avoid loops
  useEffect(() => {
    if (!mapsEqual(assignments, initialAssignments)) {
      setAssignments(new Map(initialAssignments));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAssignments]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { instanceId: number; racks: number[] }[] = [];
      assignments.forEach((rackNumbers, bookingId) => {
        if (!rackNumbers || rackNumbers.length === 0) return;
        updates.push({ instanceId: bookingId, racks: rackNumbers });
      });

      if (updates.length === 0) return;

      const results = await Promise.all(
        updates.map((u) => supabase.from("booking_instances").update({ racks: u.racks }).eq("id", u.instanceId))
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        console.error("save updates error", firstError.message);
        alert(`Save failed: ${firstError.message}`);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  return {
    bookingById,
    assignments,
    setAssignments,
    initialAssignments,
    saving,
    savedAt,
    handleSave,
  };
}

