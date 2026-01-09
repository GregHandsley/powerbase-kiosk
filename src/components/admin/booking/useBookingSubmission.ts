import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { addWeeks } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import type { BookingFormValues } from "../../../schemas/bookingForm";
import { getSideIdByKeyNode, type SideKey } from "../../../nodes/data/sidesNodes";
import { combineDateAndTime } from "./utils";
import { isAfterCutoff, getBookingCutoff, getCutoffMessage } from "../../../utils/cutoff";
import { createTasksForUsers, getUserIdsByRole } from "../../../hooks/useTasks";
import toast from "react-hot-toast";

type WeekManagement = {
  racksByWeek: Map<number, number[]>;
  capacityByWeek: Map<number, number>;
  setRacksByWeek: (map: Map<number, number[]>) => void;
  setCapacityByWeek: (map: Map<number, number>) => void;
};

type CapacityValidation = {
  isValid: boolean;
  hasWarnings: boolean;
  violations: Array<{
    time: string;
    timeStr: string;
    used: number;
    limit: number;
    periodType: string;
    week?: number;
  }>;
  maxUsed: number;
  maxLimit: number;
};

/**
 * Hook to handle booking form submission
 */
export function useBookingSubmission(
  form: UseFormReturn<BookingFormValues>,
  role: "admin" | "coach",
  userId: string | null,
  timeRangeIsClosed: boolean,
  weekManagement: WeekManagement,
  capacityValidation: CapacityValidation
) {
  const queryClient = useQueryClient();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: BookingFormValues) => {
    if (!userId) {
      setSubmitError("You must be logged in to create bookings.");
      return;
    }

    setSubmitMessage(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const sideId = await getSideIdByKeyNode(values.sideKey as SideKey);

      const startTemplate = combineDateAndTime(values.startDate, values.startTime);
      const endTemplate = combineDateAndTime(values.startDate, values.endTime);

      if (endTemplate <= startTemplate) {
        throw new Error("End time must be after start time.");
      }

      // Check if booking time overlaps with closed periods
      if (timeRangeIsClosed) {
        throw new Error("Cannot create booking during closed hours. Please select a different time.");
      }

      // Check capacity validation
      if (!capacityValidation.isValid) {
        const violationsByWeek = new Map<number, typeof capacityValidation.violations>();
        capacityValidation.violations.forEach((v) => {
          const week = v.week || 1;
          if (!violationsByWeek.has(week)) {
            violationsByWeek.set(week, []);
          }
          violationsByWeek.get(week)!.push(v);
        });

        const errorParts: string[] = [];
        errorParts.push("⚠️ Capacity exceeded:");
        errorParts.push("");
        errorParts.push(`This booking would exceed the facility capacity by ${capacityValidation.maxUsed - capacityValidation.maxLimit} athlete${capacityValidation.maxUsed - capacityValidation.maxLimit !== 1 ? "s" : ""} at peak times.`);
        errorParts.push("");
        
        violationsByWeek.forEach((violations, week) => {
          const maxViolation = violations.reduce((max, v) => (v.used > max.used ? v : max), violations[0]);
          errorParts.push(`Week ${week}: Peak violation at ${maxViolation.timeStr}`);
          errorParts.push(`  Used: ${maxViolation.used} / Limit: ${maxViolation.limit} athletes (${maxViolation.periodType})`);
        });
        
        errorParts.push("");
        errorParts.push("Please reduce the number of athletes or adjust the booking time.");
        
        throw new Error(errorParts.join("\n"));
      }

      // Validate that all weeks have racks selected
      for (let i = 0; i < values.weeks; i++) {
        const weekRacks = weekManagement.racksByWeek.get(i) || [];
        if (weekRacks.length === 0) {
          throw new Error(`Week ${i + 1} has no racks selected. Please select at least one rack for each week.`);
        }
      }

      // Check for conflicts before creating the booking
      const conflicts: Array<{
        week: number;
        rack: number;
        conflictingBooking: string;
        conflictTime: string;
      }> = [];

      for (let i = 0; i < values.weeks; i++) {
        const weekStart = addWeeks(startTemplate, i);
        const weekEnd = addWeeks(endTemplate, i);
        const weekRacks = weekManagement.racksByWeek.get(i) || [];

        // Fetch all bookings that overlap with this week's time range
        const { data: overlappingInstances, error: overlapError } = await supabase
          .from("booking_instances")
          .select(
            `
            id,
            start,
            "end",
            racks,
            booking:bookings (
              title
            )
          `
          )
          .eq("side_id", sideId)
          .lt("start", weekEnd.toISOString())
          .gt("end", weekStart.toISOString())
          .order("start", { ascending: true });

        if (overlapError) {
          console.error("Error checking for conflicts:", overlapError);
          throw new Error(`Error checking for conflicts: ${overlapError.message}`);
        }

        // Check each selected rack for conflicts
        for (const rack of weekRacks) {
          const conflictingInstance = overlappingInstances?.find((inst) => {
            const instRacks = Array.isArray(inst.racks) ? inst.racks : [];
            return instRacks.includes(rack);
          });

          if (conflictingInstance) {
            const formatDateTime = (isoString: string) => {
              const date = new Date(isoString);
              return date.toLocaleString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            };

            conflicts.push({
              week: i + 1,
              rack,
              conflictingBooking:
                (conflictingInstance.booking as { title?: string })?.title ?? "Unknown",
              conflictTime: `${formatDateTime(conflictingInstance.start)} - ${formatDateTime(conflictingInstance.end)}`,
            });
          }
        }
      }

      // If conflicts found, show detailed error and abort
      if (conflicts.length > 0) {
        // Group conflicts by week and booking for better error message
        const conflictsByWeek = new Map<
          number,
          Map<string, { racks: number[]; conflictTime: string }>
        >();
        
        conflicts.forEach((conflict) => {
          if (!conflictsByWeek.has(conflict.week)) {
            conflictsByWeek.set(conflict.week, new Map());
          }
          const weekMap = conflictsByWeek.get(conflict.week)!;
          if (!weekMap.has(conflict.conflictingBooking)) {
            weekMap.set(conflict.conflictingBooking, {
              racks: [],
              conflictTime: conflict.conflictTime,
            });
          }
          weekMap.get(conflict.conflictingBooking)!.racks.push(conflict.rack);
        });

        // Build a more readable error message
        const errorParts: string[] = [];
        errorParts.push("⚠️ Booking conflicts detected:");
        errorParts.push("");
        
        conflictsByWeek.forEach((weekConflicts, week) => {
          errorParts.push(`Week ${week}:`);
          weekConflicts.forEach((details, bookingTitle) => {
            const racksList = details.racks.sort((a, b) => a - b).join(", ");
            errorParts.push(
              `  • "${bookingTitle}" is using racks ${racksList} (${details.conflictTime})`
            );
          });
          errorParts.push("");
        });
        
        errorParts.push("Please select different racks or adjust the booking time.");
        throw new Error(errorParts.join("\n"));
      }

      // Check cutoff deadline
      const cutoff = getBookingCutoff(startTemplate);
      const isAfterDeadline = isAfterCutoff(startTemplate);
      
      if (isAfterDeadline && role !== "admin") {
        // Non-admins cannot create bookings after cutoff
        const cutoffMessage = getCutoffMessage(startTemplate);
        throw new Error(
          `⚠️ Booking cutoff has passed.\n\n${cutoffMessage}\n\n` +
          `Bookings cannot be created or edited after the cutoff deadline. ` +
          `Please contact an administrator if this is an emergency.`
        );
      }

      const areasKeys = values.areas || [];

      // Admin can lock; coaches cannot
      const isLocked = role === "admin" ? !!values.isLocked : false;

      // Recurrence descriptor (for info/debug)
      const recurrence = {
        freq: "WEEKLY",
        weeks: values.weeks,
        startDate: values.startDate,
      };

      // 1) Insert into bookings
      // Get racks for the booking template (use first week's selection)
      const templateRacks = weekManagement.racksByWeek.get(0) || [];
      // Get capacity template (use first week's capacity)
      const templateCapacity = weekManagement.capacityByWeek.get(0) || values.capacity || 1;

      // Determine if this is a last-minute change
      const lastMinuteChange = isAfterDeadline;
      
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          title: values.title,
          side_id: sideId,
          start_template: startTemplate.toISOString(),
          end_template: endTemplate.toISOString(),
          recurrence,
          areas: areasKeys,
          racks: templateRacks,
          capacity_template: templateCapacity,
          color: values.color || null,
          created_by: userId,
          is_locked: isLocked,
          status: "pending", // New bookings start as pending
          last_minute_change: lastMinuteChange,
          cutoff_at: cutoff.toISOString(),
          override_by: lastMinuteChange && role === "admin" ? userId : null,
        })
        .select("*")
        .single();

      if (bookingError || !booking) {
        throw new Error(bookingError?.message || "Failed to create booking");
      }

      // 2) Materialise instances for the next N weeks
      const instancesPayload: {
        booking_id: number;
        side_id: number;
        start: string;
        end: string;
        areas: string[];
        racks: number[];
        capacity: number;
      }[] = [];

      for (let i = 0; i < values.weeks; i++) {
        const start = addWeeks(startTemplate, i);
        const end = addWeeks(endTemplate, i);
        // Get racks for this week, or use empty array if not set
        const weekRacks = weekManagement.racksByWeek.get(i) || [];
        // Get capacity for this week, or use default if not set
        const weekCapacity = weekManagement.capacityByWeek.get(i) || values.capacity || 1;
        
        if (weekRacks.length === 0) {
          throw new Error(`Week ${i + 1} has no racks selected. Please select at least one rack for each week.`);
        }
        
        instancesPayload.push({
          booking_id: booking.id,
          side_id: sideId,
          start: start.toISOString(),
          end: end.toISOString(),
          areas: areasKeys,
          racks: weekRacks,
          capacity: weekCapacity,
        });
      }

      const { error: instancesError } = await supabase
        .from("booking_instances")
        .insert(instancesPayload);

      if (instancesError) {
        // If instances fail to create, delete the booking to avoid orphaned records
        await supabase.from("bookings").delete().eq("id", booking.id);
        throw new Error(
          `Failed to create booking instances: ${instancesError.message}. The booking was not created.`
        );
      }

      // Invalidate queries to refresh the floorplan and live view
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-for-time"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["schedule-bookings"], exact: false });

      // Create tasks for all bookings (bookings team needs to know about all new bookings)
      try {
        // Get bookings team and admin user IDs
        const bookingsTeamIds = await getUserIdsByRole("bookings_team");
        const adminIds = await getUserIdsByRole("admin");
        const allNotifyIds = [...new Set([...bookingsTeamIds, ...adminIds])];

        if (allNotifyIds.length > 0) {
          await createTasksForUsers(allNotifyIds, {
            type: lastMinuteChange ? "last_minute_change" : "booking:created",
            title: lastMinuteChange ? "Last-Minute Booking Created" : "New Booking Created",
            message: lastMinuteChange
              ? `Booking "${values.title}" was created after the cutoff deadline.`
              : `New booking "${values.title}" requires processing.`,
            link: `/bookings-team?booking=${booking.id}`,
            metadata: {
              booking_id: booking.id,
              booking_title: values.title,
              created_by: userId,
              is_last_minute: lastMinuteChange,
            },
          });
        }
      } catch (taskError) {
        console.error("Failed to create tasks:", taskError);
        // Don't fail the booking creation if tasks fail
      }

      setSubmitMessage(
        `Created booking "${values.title}" with ${instancesPayload.length} instance${instancesPayload.length !== 1 ? "s" : ""}.`
      );
      
      // Clear rack selections and capacity to prevent red highlighting after booking creation
      weekManagement.setRacksByWeek(new Map());
      weekManagement.setCapacityByWeek(new Map());
      
      form.reset({
        ...form.getValues(),
        title: "",
        racksInput: "",
        areas: [],
        capacity: 1,
      });
    } catch (err: unknown) {
      console.error("onSubmit error", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Something went wrong creating booking";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    onSubmit,
    submitMessage,
    submitError,
    submitting,
  };
}

