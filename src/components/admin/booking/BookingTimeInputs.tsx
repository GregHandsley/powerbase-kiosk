import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "../../../schemas/bookingForm";
import { isTimeClosed, isTimeRangeClosed } from "../capacity/useClosedTimes";
import clsx from "clsx";

type Props = {
  form: UseFormReturn<BookingFormValues>;
  closedTimes: Set<string>;
  availableRanges: Array<{ start: string; end: string }>;
  firstAvailableTime: string;
  endTimeManuallyChanged: boolean;
  onEndTimeChange: () => void;
};

/**
 * Component for time input fields with closed time validation
 */
export function BookingTimeInputs({
  form,
  closedTimes,
  availableRanges,
  firstAvailableTime,
  endTimeManuallyChanged,
  onEndTimeChange,
}: Props) {
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const isStartTimeClosed = startTime ? isTimeClosed(closedTimes, startTime) : false;
  const isEndTimeClosed = endTime ? isTimeClosed(closedTimes, endTime) : false;
  
  const timeRangeIsClosed = startTime && endTime 
    ? isTimeRangeClosed(closedTimes, startTime, endTime)
    : false;

  return (
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
          className={clsx(
            "w-full rounded-md border px-2 py-1 outline-none focus:ring-1",
            isStartTimeClosed
              ? "border-red-500 bg-red-950/20 text-red-300 focus:ring-red-500"
              : "border-slate-600 bg-slate-950 text-slate-100 focus:ring-indigo-500"
          )}
          value={form.watch("startTime") || firstAvailableTime}
          onChange={(e) => {
            form.setValue("startTime", e.target.value, { shouldValidate: true });
            // End time will auto-update via useEffect if not manually changed
          }}
        />
        {form.formState.errors.startTime && (
          <p className="text-red-400 mt-0.5 text-xs">
            {form.formState.errors.startTime.message}
          </p>
        )}
        {isStartTimeClosed && (
          <p className="text-red-400 mt-0.5 text-xs">
            This time is closed. Please select an available time.
          </p>
        )}
      </div>
      <div>
        <label className="block mb-1 font-medium">End</label>
        <input
          type="time"
          className={clsx(
            "w-full rounded-md border px-2 py-1 outline-none focus:ring-1",
            isEndTimeClosed
              ? "border-red-500 bg-red-950/20 text-red-300 focus:ring-red-500"
              : "border-slate-600 bg-slate-950 text-slate-100 focus:ring-indigo-500"
          )}
          value={form.watch("endTime") || "08:30"}
          onChange={(e) => {
            form.setValue("endTime", e.target.value, { shouldValidate: true });
            onEndTimeChange();
          }}
        />
        {form.formState.errors.endTime && (
          <p className="text-red-400 mt-0.5 text-xs">
            {form.formState.errors.endTime.message}
          </p>
        )}
        {isEndTimeClosed && (
          <p className="text-red-400 mt-0.5 text-xs">
            This time is closed. Please select an available time.
          </p>
        )}
        {timeRangeIsClosed && !isStartTimeClosed && !isEndTimeClosed && (
          <p className="text-red-400 mt-0.5 text-xs">
            This time range includes closed hours. Please adjust your times.
          </p>
        )}
      </div>
      {availableRanges.length > 0 && closedTimes.size > 0 && (
        <div className="col-span-3">
          <p className="text-xs text-slate-400 mt-1">
            Available times: {availableRanges.map((r, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {r.start} - {r.end}
              </span>
            ))}
          </p>
        </div>
      )}
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
  );
}

