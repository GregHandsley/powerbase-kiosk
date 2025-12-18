import { useMemo } from "react";
import clsx from "clsx";
import { formatDateTime, groupInstancesByWeek } from "../../shared/dateUtils";
import { WeekNavigation } from "./WeekNavigation";

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
};

type SeriesInstancesListProps = {
  instances: SeriesInstance[];
  selectedInstances: Set<number>;
  currentInstanceId: number;
  onInstanceToggle: (instanceId: number) => void;
  applyToAll: boolean;
  onApplyToAllChange: (checked: boolean) => void;
  currentWeekIndex: number;
  onWeekIndexChange: (index: number) => void;
  disabled?: boolean;
};

/**
 * List of series instances with week navigation and selection
 */
export function SeriesInstancesList({
  instances,
  selectedInstances,
  currentInstanceId,
  onInstanceToggle,
  applyToAll,
  onApplyToAllChange,
  currentWeekIndex,
  onWeekIndexChange,
  disabled = false,
}: SeriesInstancesListProps) {
  // Group instances by week
  const instancesByWeek = useMemo(
    () => groupInstancesByWeek(instances),
    [instances]
  );

  const weeks = useMemo(
    () => Array.from(instancesByWeek.keys()).sort((a, b) => a - b),
    [instancesByWeek]
  );

  const currentWeek = weeks[currentWeekIndex] ?? weeks[0] ?? null;
  const currentWeekInstances = currentWeek
    ? instancesByWeek.get(currentWeek) ?? []
    : [];

  if (instances.length <= 1) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-slate-300">
          All Sessions in Series ({instances.length})
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => onApplyToAllChange(e.target.checked)}
            disabled={disabled}
            className="h-3 w-3 rounded border-slate-600 bg-slate-950"
          />
          <span>Apply to all</span>
        </label>
      </div>

      <WeekNavigation
        currentWeekIndex={currentWeekIndex}
        totalWeeks={weeks.length}
        onPrevious={() => onWeekIndexChange(Math.max(0, currentWeekIndex - 1))}
        onNext={() =>
          onWeekIndexChange(Math.min(weeks.length - 1, currentWeekIndex + 1))
        }
        disabled={disabled}
      />

      <div className="border border-slate-700 rounded-md bg-slate-950/60 p-2 max-h-32 overflow-auto">
        <div className="space-y-1">
          {currentWeekInstances.map((inst) => {
            const isSelected = selectedInstances.has(inst.id);
            const isCurrent = inst.id === currentInstanceId;
            return (
              <label
                key={inst.id}
                className={clsx(
                  "flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer",
                  isCurrent
                    ? "bg-indigo-900/30 border border-indigo-700 text-indigo-200"
                    : isSelected
                      ? "bg-slate-800/50 border border-slate-600 text-slate-200"
                      : "text-slate-400 hover:bg-slate-800/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onInstanceToggle(inst.id)}
                  disabled={disabled}
                  className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                />
                <span className="flex-1">
                  {formatDateTime(inst.start)} - {formatDateTime(inst.end)}
                  {isCurrent && (
                    <span className="ml-2 text-indigo-400">(Current)</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-1">
        {selectedInstances.size} of {instances.length} sessions selected
      </p>
    </div>
  );
}

