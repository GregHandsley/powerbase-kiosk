import { useState } from "react";
import { format } from "date-fns";
import { MiniScheduleFloorplan } from "../../shared/MiniScheduleFloorplan";
import type { SideKey } from "../../../nodes/data/sidesNodes";

type RecurrenceType = "single" | "weekday" | "weekend" | "all_future" | "weekly";
type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

type Props = {
  periodType: PeriodType;
  setPeriodType: (type: PeriodType) => void;
  recurrenceType: RecurrenceType;
  setRecurrenceType: (type: RecurrenceType) => void;
  startTime: string;
  setStartTime: (time: string) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  selectedPlatforms: number[];
  setSelectedPlatforms: (platforms: number[]) => void;
  defaultCapacity: number | null;
  loadingDefault: boolean;
  existingCapacity?: {
    capacity: number;
    periodType: PeriodType;
    platforms?: number[];
  } | null;
  capacityOverride: number | null;
  setCapacityOverride: (capacity: number | null) => void;
  useOverride: boolean;
  setUseOverride: (use: boolean) => void;
  initialDate: Date;
  sideKey: SideKey;
};

/**
 * Form fields for capacity editing (period type, capacity, time, platforms)
 */
export function CapacityEditForm({
  periodType,
  setPeriodType,
  recurrenceType,
  setRecurrenceType,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  selectedPlatforms,
  setSelectedPlatforms,
  defaultCapacity,
  loadingDefault,
  existingCapacity,
  capacityOverride,
  setCapacityOverride,
  useOverride,
  setUseOverride,
  initialDate,
  sideKey,
}: Props) {
  const dateStr = format(initialDate, "dd/MM/yyyy");
  const dayName = format(initialDate, "EEEE");

  return (
    <>
      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Left Column - Settings */}
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-3">
            Settings
          </label>

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Period Type
            </label>
            {existingCapacity ? (
              <div className="w-full rounded-md border border-slate-600 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                {periodType}
              </div>
            ) : (
              <select
                value={periodType}
                onChange={(e) => {
                  const newType = e.target.value as PeriodType;
                  setPeriodType(newType);
                  // When changing to "Closed", clear platforms
                  if (newType === "Closed") {
                    setSelectedPlatforms([]);
                  }
                }}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="High Hybrid">High Hybrid</option>
                <option value="Low Hybrid">Low Hybrid</option>
                <option value="Performance">Performance</option>
                <option value="General User">General User</option>
                <option value="Closed">Closed</option>
              </select>
            )}
          </div>

          {/* Recurrence Type - Only show when creating new schedule (not editing existing) */}
          {!existingCapacity && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Recurrence
              </label>
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="single">Single Day ({dayName})</option>
                <option value="weekday">Every Weekday (Mon-Fri)</option>
                <option value="weekend">Every Weekend (Sat-Sun)</option>
                <option value="weekly">Every {dayName}</option>
                <option value="all_future">All Future {dayName}s</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {recurrenceType === "single" && `Applies only to ${dateStr}`}
                {recurrenceType === "weekday" && "Applies to all weekdays (Monday-Friday)"}
                {recurrenceType === "weekend" && "Applies to all weekends (Saturday-Sunday)"}
                {recurrenceType === "weekly" && `Applies to every ${dayName}`}
                {recurrenceType === "all_future" && `Applies to all future ${dayName}s`}
              </p>
            </div>
          )}

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Number of Athletes
            </label>
            {periodType === "Closed" ? (
              // For "Closed" period type, always show 0 and disable editing
              <div className="text-sm text-slate-200 bg-slate-800/50 px-3 py-2 rounded-md border border-slate-600">
                0 Athletes (Closed periods have no capacity)
              </div>
            ) : loadingDefault ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : defaultCapacity !== null ? (
              <div className="space-y-2">
                {/* Only show override option when editing existing schedule */}
                {existingCapacity ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useOverride"
                        checked={useOverride}
                        onChange={(e) => {
                          setUseOverride(e.target.checked);
                          if (e.target.checked && !capacityOverride) {
                            setCapacityOverride(defaultCapacity);
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-600 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="useOverride" className="text-sm text-slate-300 cursor-pointer">
                        Override default capacity ({defaultCapacity} {defaultCapacity === 1 ? "athlete" : "athletes"})
                      </label>
                    </div>
                    {useOverride && (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={capacityOverride || defaultCapacity}
                        onChange={(e) => setCapacityOverride(parseInt(e.target.value) || defaultCapacity)}
                        className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    )}
                    {!useOverride && (
                      <div className="text-sm text-slate-200 bg-slate-800/50 px-3 py-2 rounded-md">
                        {defaultCapacity} {defaultCapacity === 1 ? "Athlete" : "Athletes"} (default)
                      </div>
                    )}
                  </>
                ) : (
                  // New schedule - always use default, no override option
                  <div className="text-sm text-slate-200 bg-slate-800/50 px-3 py-2 rounded-md">
                    {defaultCapacity} {defaultCapacity === 1 ? "Athlete" : "Athletes"}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-amber-400">
                No default capacity set. Please set a default capacity for this period type first.
              </div>
            )}
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Platform Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-3">
            Platforms
          </label>
          {periodType === "Closed" ? (
            // For "Closed" period type, show disabled message
            <div className="border border-slate-700 rounded-md bg-slate-950/60 p-4 text-center">
              <p className="text-xs text-slate-400">
                Closed periods have no platforms available for booking
              </p>
            </div>
          ) : startTime && endTime ? (
            <MiniScheduleFloorplan
              sideKey={sideKey}
              selectedRacks={selectedPlatforms}
              onRackClick={(rackNumber, replaceSelection = false) => {
                if (replaceSelection) {
                  setSelectedPlatforms([rackNumber]);
                  return;
                }
                const newSelected = selectedPlatforms.includes(rackNumber)
                  ? selectedPlatforms.filter((r) => r !== rackNumber)
                  : [...selectedPlatforms, rackNumber].sort((a, b) => a - b);
                setSelectedPlatforms(newSelected);
              }}
              startTime={(() => {
                const [hours, minutes] = startTime.split(":").map(Number);
                const date = new Date(initialDate);
                date.setHours(hours, minutes, 0, 0);
                return date.toISOString();
              })()}
              endTime={(() => {
                const [hours, minutes] = endTime.split(":").map(Number);
                const date = new Date(initialDate);
                date.setHours(hours, minutes, 0, 0);
                return date.toISOString();
              })()}
              showTitle={false}
              allowConflictingRacks={false}
              ignoreBookings={true}
            />
          ) : (
            <div className="border border-slate-700 rounded-md bg-slate-950/60 p-4 text-center">
              <p className="text-xs text-slate-400">
                Please set start and end times to view floorplan
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner - Only show when editing existing schedule */}
      {existingCapacity && (
        <div className="p-3 rounded-md bg-amber-900/20 border border-amber-700/50">
          <p className="text-sm text-amber-300 font-medium">
            Editing individual day
          </p>
          <p className="text-xs text-amber-300/80 mt-1">
            Changes will only apply to {format(initialDate, "EEEE, MMM d, yyyy")}. The rest of the series will remain unchanged.
          </p>
        </div>
      )}
    </>
  );
}

