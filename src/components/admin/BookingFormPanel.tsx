import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext";
import { BookingFormSchema, type BookingFormValues } from "../../schemas/bookingForm";
import { getSideIdByKeyNode, type SideKey } from "../../nodes/data/sidesNodes";
import { useClosedTimes, isTimeRangeClosed } from "./capacity/useClosedTimes";
import { useAreas } from "./booking/useAreas";
import { useTimeDefaults } from "./booking/useTimeDefaults";
import { useWeekManagement } from "./booking/useWeekManagement";
import { useBookingSubmission } from "./booking/useBookingSubmission";
import { BookingTimeInputs } from "./booking/BookingTimeInputs";
import { BookingPlatformSelection } from "./booking/BookingPlatformSelection";
import clsx from "clsx";

type Props = {
  role: "admin" | "coach";
  /** Optional initial values to pre-fill the form */
  initialValues?: Partial<BookingFormValues>;
  /** Callback when booking is successfully created */
  onSuccess?: () => void;
};

export function BookingFormPanel({ role, initialValues, onSuccess }: Props) {
  const { user } = useAuth();
  const { areas, areasLoading, areasError } = useAreas();

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
      capacity: 1,
      ...initialValues,
    },
  });

  // Reset form when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.reset({
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
        capacity: 1,
        ...initialValues,
      });
    }
  }, [initialValues, form, todayStr]);

  // Get side ID for closed times check
  const [sideId, setSideId] = useState<number | null>(null);
  const sideKey = form.watch("sideKey");
  const startDate = form.watch("startDate");

  useEffect(() => {
    getSideIdByKeyNode(sideKey as SideKey)
      .then(setSideId)
      .catch(console.error);
  }, [sideKey]);

  // Get closed times for the selected date and side
  const { closedTimes, isLoading: closedTimesLoading } = useClosedTimes(sideId, startDate || null);
  
  // Check if selected times are closed
    const startTime = form.watch("startTime");
    const endTime = form.watch("endTime");
    
  // Check if any time in the range is closed
  const timeRangeIsClosed = useMemo(() => {
    if (!startTime || !endTime) return false;
    return isTimeRangeClosed(closedTimes, startTime, endTime);
  }, [startTime, endTime, closedTimes]);

  // Time defaults management
  const {
    endTimeManuallyChanged,
    setEndTimeManuallyChanged,
    availableRanges,
    firstAvailableTime,
  } = useTimeDefaults(form, sideId, startDate, closedTimes, closedTimesLoading);

  // Week-by-week management
  const weekManagement = useWeekManagement(form);

  // Booking submission
  const {
    onSubmit,
    submitMessage,
    submitError,
    submitting,
  } = useBookingSubmission(
    form,
    role,
    user?.id || null,
    timeRangeIsClosed,
    weekManagement
  );

  // Call onSuccess when booking is successfully created
  useEffect(() => {
    if (submitMessage && onSuccess) {
      // Delay slightly to show the success message
      const timer = setTimeout(() => {
        onSuccess();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [submitMessage, onSuccess]);

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
        {/* Left column: basic details and time */}
        <div className="space-y-2">
          {/* Title */}
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

          {/* Side */}
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

          {/* Time inputs */}
          <BookingTimeInputs
            form={form}
            closedTimes={closedTimes}
            availableRanges={availableRanges}
            firstAvailableTime={firstAvailableTime}
            endTimeManuallyChanged={endTimeManuallyChanged}
            onEndTimeChange={() => setEndTimeManuallyChanged(true)}
              />
        </div>

        {/* Middle column: platforms */}
        <div className="space-y-2">
          <BookingPlatformSelection
            form={form}
                sideKey={form.watch("sideKey")}
            weekManagement={weekManagement}
          />
          </div>

        {/* Right column: areas, color, lock, submit */}
        <div className="space-y-2">
          {/* Areas */}
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
              {!areasLoading && !areasError && areas.length === 0 && (
                <p className="text-slate-400 text-[11px]">No areas configured.</p>
              )}
              {!areasLoading && !areasError && areas.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {areas.map((area) => (
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

          {/* Colour */}
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

          {/* Locked booking */}
          {role === "admin" && (
            <div className="flex items-center gap-2">
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

          {/* Submit button */}
          <div className="pt-2">
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

          {/* Messages */}
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
