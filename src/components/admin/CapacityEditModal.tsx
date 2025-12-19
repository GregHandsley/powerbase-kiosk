import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "../../lib/supabaseClient";

type RecurrenceType = "single" | "weekday" | "weekend" | "all_future" | "weekly";
type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    capacity: number;
    periodType: PeriodType;
    recurrenceType: RecurrenceType;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  onDelete?: () => void;
  initialDate: Date;
  initialTime: string; // HH:mm format
  initialEndTime?: string; // HH:mm format
  sideId: number;
  existingCapacity?: {
    capacity: number;
    periodType: PeriodType;
  } | null;
  existingRecurrenceType?: RecurrenceType;
};

export function CapacityEditModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialTime,
  initialEndTime,
  existingCapacity,
  existingRecurrenceType,
}: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>(
    existingCapacity?.periodType || "General User"
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(existingRecurrenceType || "single");
  const [startTime, setStartTime] = useState(initialTime);
  const [endTime, setEndTime] = useState(initialEndTime || "23:59");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultCapacity, setDefaultCapacity] = useState<number | null>(null);
  const [capacityOverride, setCapacityOverride] = useState<number | null>(existingCapacity?.capacity || null);
  const [useOverride, setUseOverride] = useState(false);
  const [loadingDefault, setLoadingDefault] = useState(false);

  // Fetch default capacity for the selected period type
  useEffect(() => {
    if (isOpen && periodType) {
      setLoadingDefault(true);
      supabase
        .from("period_type_capacity_defaults")
        .select("default_capacity")
        .eq("period_type", periodType)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching default capacity:", error);
            setDefaultCapacity(null);
          } else {
            setDefaultCapacity(data?.default_capacity ?? null);
          }
          setLoadingDefault(false);
        });
    }
  }, [isOpen, periodType]);

  useEffect(() => {
    if (isOpen) {
      setPeriodType(existingCapacity?.periodType || "General User");
      // When editing existing, force to "single" to only edit that day
      // When creating new, allow any recurrence type
      setRecurrenceType(existingCapacity ? "single" : (existingRecurrenceType || "single"));
      setStartTime(initialTime);
      setEndTime(initialEndTime || "23:59");
      setError(null);
    }
  }, [isOpen, initialTime, initialEndTime, existingCapacity, existingRecurrenceType]);

  // Update capacity override when default capacity or existing capacity changes
  useEffect(() => {
    if (isOpen && existingCapacity && defaultCapacity !== null) {
      const hasOverride = existingCapacity.capacity !== defaultCapacity;
      setUseOverride(hasOverride);
      if (hasOverride) {
        setCapacityOverride(existingCapacity.capacity);
      } else {
        setCapacityOverride(null);
      }
    } else if (isOpen && !existingCapacity) {
      setUseOverride(false);
      setCapacityOverride(null);
    }
  }, [isOpen, existingCapacity, defaultCapacity]);

  if (!isOpen) return null;

  const dayName = format(initialDate, "EEEE");
  const dateStr = format(initialDate, "dd/MM/yyyy");

  const handleSave = async () => {
    if (endTime <= startTime) {
      setError("End time must be after start time");
      return;
    }

    const capacityToUse = useOverride && capacityOverride !== null ? capacityOverride : defaultCapacity;

    if (capacityToUse === null) {
      setError("No default capacity set for this period type. Please set a default capacity first.");
      return;
    }

    if (capacityToUse < 0) {
      setError("Capacity cannot be negative");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        capacity: capacityToUse,
        periodType,
        recurrenceType,
        startTime,
        endTime,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save capacity");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[DELETE] Delete button clicked in CapacityEditModal", { hasOnDelete: !!onDelete });
    if (!onDelete) {
      console.warn("[DELETE] No onDelete handler provided");
      return;
    }
    // Don't show confirmation here - let the parent component handle it
    // The onDelete callback will trigger the delete confirmation in CapacityManagement
    console.log("[DELETE] Calling onDelete callback");
    onDelete();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">Edit Capacity</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Settings Section */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-3">
              Settings
            </label>

            {/* Period Type */}
            <div className="mb-4">
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
            <div className="mb-4">
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
            <div className="grid grid-cols-2 gap-3 mb-4">
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

          {/* Repeat Options */}
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
            <div className="space-y-2">
              {existingCapacity ? (
                // When editing existing, only show "single" option (disabled)
                <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 opacity-60 cursor-not-allowed">
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
                  <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
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
                      <div className="text-xs text-slate-400">Apply only to {dayName}, {dateStr}</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
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
                        Every weekday (Mon-Fri)
                      </div>
                      <div className="text-xs text-slate-400">Apply to all weekdays</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
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
                        Every weekend (Sat-Sun)
                      </div>
                      <div className="text-xs text-slate-400">Apply to all weekends</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
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
                      <div className="text-xs text-slate-400">Apply to this day every week</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-md border border-slate-700 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50">
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
                        This and future events
                      </div>
                      <div className="text-xs text-slate-400">Apply to {dayName} from {dateStr} onwards</div>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-900/20 border border-red-700">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

