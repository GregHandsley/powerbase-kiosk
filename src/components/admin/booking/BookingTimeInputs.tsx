import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "../../../schemas/bookingForm";
import { isTimeClosed, isTimeRangeClosed, type ClosedPeriod } from "../capacity/useClosedTimes";
import { TimePicker } from "../../shared/TimePicker";
import clsx from "clsx";


type Props = {
  form: UseFormReturn<BookingFormValues>;
  closedTimes: Set<string>;
  closedPeriods?: ClosedPeriod[];
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
  closedPeriods = [],
  firstAvailableTime,
  endTimeManuallyChanged,
  onEndTimeChange,
}: Props) {
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const isStartTimeClosed = startTime ? isTimeClosed(closedTimes, startTime, closedPeriods, false) : false;
  const isEndTimeClosed = endTime ? isTimeClosed(closedTimes, endTime, closedPeriods, true) : false;
  
  const timeRangeIsClosed = startTime && endTime 
    ? isTimeRangeClosed(closedTimes, startTime, endTime, closedPeriods)
    : false;

  return (
    <div className="space-y-2">
      <div>
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
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[120px]">
          <label className="block mb-1 font-medium">Start</label>
        <TimePicker
          value={form.watch("startTime") || firstAvailableTime}
          onChange={(time) => {
            form.setValue("startTime", time, { shouldValidate: true });
          }}
          error={isStartTimeClosed}
          closedTimes={closedTimes}
          closedPeriods={closedPeriods}
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
        <div className="flex-1 min-w-[120px]">
          <label className="block mb-1 font-medium">End</label>
        <TimePicker
          value={form.watch("endTime") || "08:30"}
          onChange={(time) => {
            form.setValue("endTime", time, { shouldValidate: true });
            onEndTimeChange();
          }}
          error={isEndTimeClosed}
          closedTimes={closedTimes}
          closedPeriods={closedPeriods}
          isEndTime={true}
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
  );
}

