import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addWeeks } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { BookingFormSchema, type BookingFormValues } from "../../schemas/bookingForm";
import { useAuth } from "../../context/AuthContext";
import { getSideIdByKeyNode, type SideKey } from "../../nodes/data/sidesNodes";
import { MiniScheduleFloorplan } from "../shared/MiniScheduleFloorplan";
import clsx from "clsx";

type AreaRow = {
  id: number;
  side_id: number;
  key: string;
  name: string;
};

type Props = {
  role: "admin" | "coach";
};

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  // date: yyyy-mm-dd, time: HH:mm
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function BookingFormPanel({ role }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(BookingFormSchema),
    defaultValues: {
      title: "",
      sideKey: "Power",
      startDate: todayStr,
      startTime: "07:00",
      endTime: "08:30",
      weeks: 1,
      racksInput: "",
      areas: [],
      color: "#4f46e5",
      isLocked: false,
    },
  });

  // Load areas for both sides once, then we filter client-side
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

  const filteredAreas = useMemo(() => {
    // We need side_ids, so we map sideKey → side_id via another query normally,
    // but for now we just show all areas and let the user choose logically.
    // If you want strict per-side filtering, we can join on sides table.
    // For now, filter by sideKey name via a simple join in a later sprint.
    return areas;
  }, [areas]);

  // Track selected racks per week
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [racksByWeek, setRacksByWeek] = useState<Map<number, number[]>>(new Map());
  const [applyToAllWeeks, setApplyToAllWeeks] = useState(true); // Default to true for convenience

  // Get the number of weeks from the form
  const weeksCount = form.watch("weeks") || 1;

  // Initialize racksByWeek when weeks count changes
  useEffect(() => {
    const newMap = new Map(racksByWeek);
    // Remove weeks that are beyond the new count
    for (let i = weeksCount; i < 20; i++) {
      newMap.delete(i);
    }
    // Initialize empty arrays for new weeks
    for (let i = 0; i < weeksCount; i++) {
      if (!newMap.has(i)) {
        newMap.set(i, []);
      }
    }
    setRacksByWeek(newMap);
    // Reset to first week if current week is out of bounds
    if (currentWeekIndex >= weeksCount) {
      setCurrentWeekIndex(0);
    }
  }, [weeksCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // When applyToAllWeeks changes to true, sync all weeks with current week's selection
  useEffect(() => {
    if (applyToAllWeeks && weeksCount > 1) {
      const currentRacks = racksByWeek.get(currentWeekIndex) || [];
      // Always sync, even if empty (so all weeks are consistent)
      const newMap = new Map(racksByWeek);
      for (let i = 0; i < weeksCount; i++) {
        newMap.set(i, [...currentRacks]); // Create a copy to avoid reference issues
      }
      setRacksByWeek(newMap);
    }
  }, [applyToAllWeeks, weeksCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get selected racks for current week
  const selectedPlatforms = useMemo(() => {
    return racksByWeek.get(currentWeekIndex) || [];
  }, [racksByWeek, currentWeekIndex]);

  const handlePlatformSelectionChange = (selected: number[]) => {
    const newMap = new Map(racksByWeek);
    
    // Normal selection behavior
    if (applyToAllWeeks && weeksCount > 1) {
      // Apply to all weeks
      for (let i = 0; i < weeksCount; i++) {
        newMap.set(i, selected);
      }
    } else {
      // Apply only to current week
      newMap.set(currentWeekIndex, selected);
    }
    
    setRacksByWeek(newMap);
    // Also update the form's racksInput for validation (use first week's selection as default)
    if (currentWeekIndex === 0 || applyToAllWeeks) {
      form.setValue("racksInput", selected.join(","), { shouldValidate: true });
    }
  };

  // Calculate start and end times for availability checking for the current week
  const timeRange = useMemo(() => {
    const startDate = form.watch("startDate");
    const startTime = form.watch("startTime");
    const endTime = form.watch("endTime");
    
    if (!startDate || !startTime || !endTime) {
      return { start: null, end: null };
    }

    const baseStart = combineDateAndTime(startDate, startTime);
    const baseEnd = combineDateAndTime(startDate, endTime);
    
    // Add weeks offset for the current week
    const start = addWeeks(baseStart, currentWeekIndex);
    const end = addWeeks(baseEnd, currentWeekIndex);
    
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [form.watch("startDate"), form.watch("startTime"), form.watch("endTime"), currentWeekIndex]);

  async function onSubmit(values: BookingFormValues) {
    if (!user) {
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

      // Validate that all weeks have racks selected
      for (let i = 0; i < values.weeks; i++) {
        const weekRacks = racksByWeek.get(i) || [];
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
        const weekRacks = racksByWeek.get(i) || [];

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
      const templateRacks = racksByWeek.get(0) || [];

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
          color: values.color || null,
          created_by: user.id,
          is_locked: isLocked,
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
      }[] = [];

      for (let i = 0; i < values.weeks; i++) {
        const start = addWeeks(startTemplate, i);
        const end = addWeeks(endTemplate, i);
        // Get racks for this week, or use empty array if not set
        const weekRacks = racksByWeek.get(i) || [];
        
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

      // Invalidate queries to refresh the floorplan and schedule views
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-for-time"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });

      setSubmitMessage(
        `Created booking "${values.title}" with ${instancesPayload.length} instance${instancesPayload.length !== 1 ? "s" : ""}.`
      );
      
      // Clear rack selections to prevent red highlighting after booking creation
      setRacksByWeek(new Map());
      
      form.reset({
        ...form.getValues(),
        title: "",
        racksInput: "",
        areas: [],
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
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Create Booking</h2>
          <p className="text-xs text-slate-300">
            Define a weekly squad block and materialise platform allocations for the next few weeks.
          </p>
        </div>
        <span className="text-[10px] rounded-full bg-slate-800 px-2 py-1 text-slate-300">
          Role: {role}
        </span>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-3 md:grid-cols-3 text-xs"
      >
        {/* Left column: core details */}
        <div className="space-y-2">
          <div>
            <label className="block mb-1 font-medium">Title</label>
            <input
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
              {...form.register("title")}
              placeholder="e.g. Loughborough S&C – Squad A"
            />
            {form.formState.errors.title && (
              <p className="text-red-400 mt-0.5">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1 font-medium">Side</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => form.setValue("sideKey", "Power", { shouldValidate: true })}
                className={clsx(
                  "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition",
                  form.watch("sideKey") === "Power"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900"
                )}
              >
                Power
              </button>
              <button
                type="button"
                onClick={() => form.setValue("sideKey", "Base", { shouldValidate: true })}
                className={clsx(
                  "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition",
                  form.watch("sideKey") === "Base"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900"
                )}
              >
                Base
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <label className="block mb-1 font-medium">Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                {...form.register("startDate")}
              />
              {form.formState.errors.startDate && (
                <p className="text-red-400 mt-0.5">
                  {form.formState.errors.startDate.message}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1 font-medium">Start</label>
              <input
                type="time"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                {...form.register("startTime")}
              />
              {form.formState.errors.startTime && (
                <p className="text-red-400 mt-0.5">
                  {form.formState.errors.startTime.message}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1 font-medium">End</label>
              <input
                type="time"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                {...form.register("endTime")}
              />
              {form.formState.errors.endTime && (
                <p className="text-red-400 mt-0.5">
                  {form.formState.errors.endTime.message}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1 font-medium">Weeks</label>
              <input
                type="number"
                min={1}
                max={16}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                {...form.register("weeks", { valueAsNumber: true })}
              />
              {form.formState.errors.weeks && (
                <p className="text-red-400 mt-0.5">
                  {form.formState.errors.weeks.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Middle column: racks + areas */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-xs">Platforms</label>
              {weeksCount > 1 && timeRange.start && timeRange.end && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentWeekIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentWeekIndex === 0 || applyToAllWeeks}
                    className={clsx(
                      "px-2 py-1 text-xs rounded border",
                      currentWeekIndex === 0 || applyToAllWeeks
                        ? "border-slate-700 text-slate-600 cursor-not-allowed"
                        : "border-slate-600 text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-slate-400 min-w-[80px] text-center">
                    Week {currentWeekIndex + 1} of {weeksCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentWeekIndex((prev) => Math.min(weeksCount - 1, prev + 1))}
                    disabled={currentWeekIndex === weeksCount - 1 || applyToAllWeeks}
                    className={clsx(
                      "px-2 py-1 text-xs rounded border",
                      currentWeekIndex === weeksCount - 1 || applyToAllWeeks
                        ? "border-slate-700 text-slate-600 cursor-not-allowed"
                        : "border-slate-600 text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
            {weeksCount > 1 && (
              <div className="mb-2">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllWeeks}
                    onChange={(e) => setApplyToAllWeeks(e.target.checked)}
                    className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                  />
                  <span>Apply rack selection to all weeks</span>
                </label>
              </div>
            )}
            
            {timeRange.start && timeRange.end ? (
              <MiniScheduleFloorplan
                sideKey={form.watch("sideKey")}
                selectedRacks={selectedPlatforms}
                onRackClick={(rackNumber, replaceSelection = false) => {
                  // If replaceSelection is true, replace the entire selection with just this rack
                  if (replaceSelection) {
                    handlePlatformSelectionChange([rackNumber]);
                    return;
                  }
                  
                  // Normal toggle behavior
                  const newSelected = selectedPlatforms.includes(rackNumber)
                    ? selectedPlatforms.filter((r) => r !== rackNumber)
                    : [...selectedPlatforms, rackNumber].sort((a, b) => a - b);
                  
                  handlePlatformSelectionChange(newSelected);
                }}
                startTime={timeRange.start}
                endTime={timeRange.end}
                showTitle={false}
                allowConflictingRacks={false}
              />
            ) : (
              <div className="w-full">
                <div className="border border-slate-700 rounded-md bg-slate-950/60 p-4 text-center">
                  <p className="text-xs text-slate-400">
                    Please select date and time to view floorplan
                  </p>
                </div>
              </div>
            )}
            {form.formState.errors.racksInput && (
              <p className="text-red-400 mt-1 text-xs">
                {form.formState.errors.racksInput.message}
              </p>
            )}
            {weeksCount > 1 && (
              <p className="text-[10px] text-slate-500 mt-1">
                {applyToAllWeeks ? (
                  selectedPlatforms.length > 0 ? (
                    `${selectedPlatforms.length} rack${selectedPlatforms.length !== 1 ? "s" : ""} selected for all ${weeksCount} weeks`
                  ) : (
                    `No racks selected (will apply to all ${weeksCount} weeks)`
                  )
                ) : (
                  selectedPlatforms.length > 0 ? (
                    `${selectedPlatforms.length} rack${selectedPlatforms.length !== 1 ? "s" : ""} selected for week ${currentWeekIndex + 1}`
                  ) : (
                    `No racks selected for week ${currentWeekIndex + 1}`
                  )
                )}
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Areas{" "}
              <span className="text-[10px] text-slate-400">(Coming soon)</span>
            </label>
            <div className="border border-slate-700 rounded-md p-2 max-h-32 overflow-auto bg-slate-950/60 opacity-50 pointer-events-none">
              {areasLoading && (
                <p className="text-slate-400 text-[11px]">Loading areas…</p>
              )}
              {areasError && (
                <p className="text-red-400 text-[11px]">Error: {areasError}</p>
              )}
              {!areasLoading && !areasError && filteredAreas.length === 0 && (
                <p className="text-slate-400 text-[11px]">No areas configured.</p>
              )}
              {!areasLoading && !areasError && filteredAreas.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {filteredAreas.map((area) => (
                    <label
                      key={area.id}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400"
                    >
                      <input
                        type="checkbox"
                        value={area.key}
                        disabled
                        className="h-3 w-3 rounded border-slate-600 bg-slate-950 cursor-not-allowed"
                        {...form.register("areas")}
                      />
                      <span>
                        {area.name}{" "}
                        <span className="text-slate-500">({area.key})</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 italic">
              Area selection will be available in a later update
            </p>
          </div>
        </div>

        {/* Right column: colour + lock + submit */}
        <div className="space-y-2">
          <div>
            <label className="block mb-1 font-medium">Colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-7 rounded border border-slate-700 bg-slate-950"
                {...form.register("color")}
              />
              <input
                className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                {...form.register("color")}
                placeholder="#4f46e5"
              />
            </div>
          </div>

          {role === "admin" && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="isLocked"
                className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                {...form.register("isLocked")}
              />
              <label htmlFor="isLocked" className="text-xs">
                Locked booking (coaches cannot move/modify)
              </label>
            </div>
          )}

          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className={clsx(
                "w-full inline-flex items-center justify-center rounded-md py-1.5 text-xs font-medium",
                "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {submitting ? "Creating booking..." : "Create booking"}
            </button>
          </div>

          {submitMessage && (
            <p className="text-[11px] text-emerald-400 mt-1">{submitMessage}</p>
          )}
          {submitError && (
            <div className="mt-2 p-3 bg-red-900/20 border border-red-700/50 rounded-md">
              <p className="text-sm text-red-300 font-medium mb-1">Error</p>
              <pre className="text-xs text-red-400 whitespace-pre-wrap font-sans">
                {submitError}
              </pre>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
