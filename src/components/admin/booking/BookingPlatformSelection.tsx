import type { UseFormReturn } from "react-hook-form";
import { addWeeks } from "date-fns";
import type { BookingFormValues } from "../../../schemas/bookingForm";
import { MiniScheduleFloorplan } from "../../shared/MiniScheduleFloorplan";
import { combineDateAndTime } from "./utils";
import clsx from "clsx";

type WeekManagement = {
  currentWeekIndex: number;
  setCurrentWeekIndex: (index: number | ((prev: number) => number)) => void;
  selectedPlatforms: number[];
  currentWeekCapacity: number;
  weeksCount: number;
  applyToAllWeeks: boolean;
  setApplyToAllWeeks: (value: boolean) => void;
  handlePlatformSelectionChange: (selected: number[]) => void;
  handleCapacityChange: (value: number) => void;
};

type Props = {
  form: UseFormReturn<BookingFormValues>;
  sideKey: "Power" | "Base";
  weekManagement: WeekManagement;
};

/**
 * Component for platform selection with week-by-week support
 */
export function BookingPlatformSelection({ form, sideKey, weekManagement }: Props) {
  const {
    currentWeekIndex,
    setCurrentWeekIndex,
    selectedPlatforms,
    currentWeekCapacity,
    weeksCount,
    applyToAllWeeks,
    setApplyToAllWeeks,
    handlePlatformSelectionChange,
    handleCapacityChange,
  } = weekManagement;

  // Calculate start and end times for availability checking for the current week
  const timeRange = (() => {
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
  })();

  return (
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
              title={applyToAllWeeks ? "Uncheck 'Apply to all weeks' to edit individual weeks" : "Previous week"}
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-400 min-w-[80px] text-center">
              Week {currentWeekIndex + 1} of {weeksCount}
              {!applyToAllWeeks && (
                <span className="block text-[10px] text-indigo-400 mt-0.5">(Individual editing enabled)</span>
              )}
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
              title={applyToAllWeeks ? "Uncheck 'Apply to all weeks' to edit individual weeks" : "Next week"}
            >
              Next →
            </button>
          </div>
        )}
      </div>
      {weeksCount > 1 && (
        <div className="mb-2 space-y-1">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAllWeeks}
              onChange={(e) => setApplyToAllWeeks(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-950"
            />
            <span>Apply to all weeks</span>
          </label>
          {!applyToAllWeeks && (
            <p className="text-[10px] text-slate-500 ml-5 italic">
              Unlocked: You can now edit platforms and number of athletes individually for each week
            </p>
          )}
        </div>
      )}
      
      {timeRange.start && timeRange.end ? (
        <MiniScheduleFloorplan
          sideKey={sideKey}
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
        <div className="space-y-1 mt-1">
          <p className="text-[10px] text-slate-500">
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
          <p className="text-[10px] text-slate-500">
            {applyToAllWeeks ? (
              `Number of athletes: ${currentWeekCapacity} for all ${weeksCount} weeks`
            ) : (
              `Number of athletes: ${currentWeekCapacity} for week ${currentWeekIndex + 1}`
            )}
          </p>
        </div>
      )}
      
      {/* Number of Athletes input - under Platforms */}
      <div className="mt-3">
        <label className="block mb-1 font-medium text-xs">Number of Athletes</label>
        <input
          type="number"
          min={1}
          max={100}
          value={currentWeekCapacity}
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
          onChange={(e) => {
            handleCapacityChange(parseInt(e.target.value) || 1);
          }}
        />
        {form.formState.errors.capacity && (
          <p className="text-red-400 mt-0.5 text-xs">
            {form.formState.errors.capacity.message}
          </p>
        )}
      </div>
    </div>
  );
}

