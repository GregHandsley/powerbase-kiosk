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
import { BookingFormFields } from "./booking/BookingFormFields";
import { BookingTimeInputs } from "./booking/BookingTimeInputs";
import { BookingPlatformSelection } from "./booking/BookingPlatformSelection";
import clsx from "clsx";

type Props = {
  role: "admin" | "coach";
};

export function BookingFormPanel({ role }: Props) {
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
    },
  });

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
          <BookingFormFields
            form={form}
            role={role}
            areas={areas}
            areasLoading={areasLoading}
            areasError={areasError}
          />
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

        {/* Right column: submit */}
        <div className="space-y-2">
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
