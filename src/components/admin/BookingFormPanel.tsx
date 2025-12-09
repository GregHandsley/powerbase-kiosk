import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addWeeks } from "date-fns";
import { supabase } from "../../lib/supabaseClient";
import { BookingFormSchema, type BookingFormValues } from "../../schemas/bookingForm";
import { useAuth } from "../../context/AuthContext";
import { getSideIdByKeyNode, type SideKey } from "../../nodes/data/sidesNodes";
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
      weeks: 4,
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

      // Parse rack numbers from comma-separated string
      const racks = values.racksInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n));

      if (!racks.length) {
        throw new Error("No valid rack numbers found.");
      }

      const areasKeys = values.areas;

      // Admin can lock; coaches cannot
      const isLocked = role === "admin" ? !!values.isLocked : false;

      // Recurrence descriptor (for info/debug)
      const recurrence = {
        freq: "WEEKLY",
        weeks: values.weeks,
        startDate: values.startDate,
      };

      // 1) Insert into bookings
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          title: values.title,
          side_id: sideId,
          start_template: startTemplate.toISOString(),
          end_template: endTemplate.toISOString(),
          recurrence,
          areas: areasKeys,
          racks,
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
        instancesPayload.push({
          booking_id: booking.id,
          side_id: sideId,
          start: start.toISOString(),
          end: end.toISOString(),
          areas: areasKeys,
          racks,
        });
      }

      const { error: instancesError } = await supabase
        .from("booking_instances")
        .insert(instancesPayload);

      if (instancesError) {
        throw new Error(instancesError.message);
      }

      setSubmitMessage(
        `Created booking "${values.title}" with ${instancesPayload.length} instances.`
      );
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
            <select
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
              {...form.register("sideKey")}
            >
              <option value="Power">Power</option>
              <option value="Base">Base</option>
            </select>
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
            <label className="block mb-1 font-medium">Racks</label>
            <input
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
              {...form.register("racksInput")}
              placeholder="e.g. 1,2,3"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Comma-separated rack numbers. We will later replace this with a click-on-floorplan UI.
            </p>
            {form.formState.errors.racksInput && (
              <p className="text-red-400 mt-0.5">
                {form.formState.errors.racksInput.message}
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Areas{" "}
              <span className="text-[10px] text-slate-400">(filtered by side in a later sprint)</span>
            </label>
            <div className="border border-slate-700 rounded-md p-2 max-h-32 overflow-auto bg-slate-950/60">
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
                      className="inline-flex items-center gap-1 text-[11px] text-slate-200"
                    >
                      <input
                        type="checkbox"
                        value={area.key}
                        className="h-3 w-3 rounded border-slate-600 bg-slate-950"
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
            {form.formState.errors.areas && (
              <p className="text-red-400 mt-0.5">
                {form.formState.errors.areas.message as string}
              </p>
            )}
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
            <p className="text-[11px] text-red-400 mt-1">{submitError}</p>
          )}
        </div>
      </form>
    </div>
  );
}
