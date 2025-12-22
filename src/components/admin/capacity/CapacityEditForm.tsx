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
                onChange={(e) => setPeriodType(e.target.value as PeriodType)}
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

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Number of Athletes
            </label>
            {loadingDefault ? (
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
          {startTime && endTime ? (
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

      {/* Repeat Options - Full Width */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase mb-3">
          Repeat Options
        </label>
        {existingCapacity && (
          <div className="mb-3 p-2 rounded-md bg-amber-900/20 border border-amber-700/50">
            <p className="text-xs text-amber-300">
              You are editing an existing schedule. Changes will only apply to this specific day ({format(initialDate, "EEEE, MMM d, yyyy")}).
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {existingCapacity ? (
            // When editing existing, only show "single" option (disabled)
            <label className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-950/50 opacity-60 cursor-not-allowed">
              <input
                type="radio"
                name="recurrence"
                value="single"
                checked={true}
                disabled
                className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">
                  This day ({dateStr})
                </div>
                <div className="text-xs text-slate-400">Editing only this specific day</div>
              </div>
            </label>
          ) : (
            // When creating new, show all options
            <>
              <label className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="recurrence"
                  value="single"
                  checked={recurrenceType === "single"}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    This day ({dateStr})
                  </div>
                  <div className="text-xs text-slate-400">Apply only to {dayName}</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="recurrence"
                  value="weekday"
                  checked={recurrenceType === "weekday"}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    Every weekday
                  </div>
                  <div className="text-xs text-slate-400">Mon-Fri</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="recurrence"
                  value="weekend"
                  checked={recurrenceType === "weekend"}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    Every weekend
                  </div>
                  <div className="text-xs text-slate-400">Sat-Sun</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="recurrence"
                  value="weekly"
                  checked={recurrenceType === "weekly"}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    Every week
                  </div>
                  <div className="text-xs text-slate-400">Same day weekly</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
                <input
                  type="radio"
                  name="recurrence"
                  value="all_future"
                  checked={recurrenceType === "all_future"}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="w-4 h-4 text-indigo-600 border-slate-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    This and future
                  </div>
                  <div className="text-xs text-slate-400">From {dateStr} onwards</div>
                </div>
              </label>
            </>
          )}
        </div>
      </div>
    </>
  );
}

