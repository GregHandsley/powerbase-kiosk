import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../context/AuthContext";
import { createTasksForUsers, getUserIdsByRole } from "../../../../hooks/useTasks";
import type { ActiveInstance } from "../../../../types/snapshot";
import type { BookingStatus } from "../../../../types/db";

export function useRackAssignments(bookings: ActiveInstance[]) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
      // Find which bookings actually changed by comparing assignments to initialAssignments
      const changedBookings: { instanceId: number; racks: number[]; bookingId: number }[] = [];
      
      assignments.forEach((rackNumbers, instanceId) => {
        const initialRacks = initialAssignments.get(instanceId) ?? [];
        const currentRacks = rackNumbers ?? [];
        
        // Compare racks to see if they changed
        const racksChanged = 
          initialRacks.length !== currentRacks.length ||
          !initialRacks.every((rack) => currentRacks.includes(rack)) ||
          !currentRacks.every((rack) => initialRacks.includes(rack));
        
        if (racksChanged && currentRacks.length > 0) {
          // Find the booking for this instance
          const booking = bookings.find((b) => b.instanceId === instanceId);
          if (booking) {
            changedBookings.push({ instanceId, racks: currentRacks, bookingId: booking.bookingId });
          }
        }
      });

      if (changedBookings.length === 0) return;

      // Update booking instances for changed bookings only
      const results = await Promise.all(
        changedBookings.map((u) => supabase.from("booking_instances").update({ racks: u.racks }).eq("id", u.instanceId))
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        console.error("save updates error", firstError.message);
        alert(`Save failed: ${firstError.message}`);
        return;
      }

      // Update booking records and create tasks for changed bookings only
      if (user?.id) {
        const uniqueBookingIds = [...new Set(changedBookings.map((u) => u.bookingId))];
        
        for (const bookingId of uniqueBookingIds) {
          // Get current booking status
          const { data: currentBooking } = await supabase
            .from("bookings")
            .select("status, title")
            .eq("id", bookingId)
            .maybeSingle();

          if (currentBooking) {
            const updateData: {
              last_edited_at: string;
              last_edited_by: string;
              status?: BookingStatus;
            } = {
              last_edited_at: new Date().toISOString(),
              last_edited_by: user.id,
            };

            // If booking was processed, reset to pending so bookings team can review the rack changes
            if (currentBooking.status === "processed") {
              updateData.status = "pending";
            }

            await supabase
              .from("bookings")
              .update(updateData)
              .eq("id", bookingId);

            // Create tasks for bookings team if booking was processed or if it's a change
            if (currentBooking.status === "processed" || updateData.status === "pending") {
              try {
                const bookingsTeamIds = await getUserIdsByRole("bookings_team");
                const adminIds = await getUserIdsByRole("admin");
                const allNotifyIds = [...new Set([...bookingsTeamIds, ...adminIds])];

                if (allNotifyIds.length > 0) {
                  await createTasksForUsers(allNotifyIds, {
                    type: "booking:edited",
                    title: currentBooking.status === "processed"
                      ? "Processed Booking Edited"
                      : "Booking Edited",
                    message: currentBooking.status === "processed"
                      ? `Processed booking "${currentBooking.title || "Untitled"}" had racks/platforms changed and needs reprocessing.`
                      : `Booking "${currentBooking.title || "Untitled"}" had racks/platforms changed.`,
                    link: `/bookings-team?booking=${bookingId}`,
                    metadata: {
                      booking_id: bookingId,
                      booking_title: currentBooking.title || null,
                      changed_by: user.id,
                      was_processed: currentBooking.status === "processed",
                    },
                  });
                }
              } catch (taskError) {
                console.error("Failed to create tasks:", taskError);
                // Don't fail the save if tasks fail
              }
            }
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["bookings-team"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
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

