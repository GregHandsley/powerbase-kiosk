import clsx from "clsx";
import type { ActiveInstance } from "../../../types/snapshot";

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
  sideId: number | null;
};

type Props = {
  editingBooking: ActiveInstance | null;
  selectedRacks: number[];
  rackValidationError: string | null;
  savingRacks: boolean;
  applyRacksToAll: boolean;
  setApplyRacksToAll: (value: boolean) => void;
  seriesInstancesForRacks: SeriesInstance[];
  weeksForRacks: number[];
  rackSelectionWeekIndex: number;
  setRackSelectionWeekIndex: (updater: (prev: number) => number) => void;
  currentWeekInstancesForRacks: SeriesInstance[];
  selectedInstancesForRacks: Set<number>;
  setSelectedInstancesForRacks: (value: Set<number>) => void;
  handleCancelRackSelection: () => void;
  handleSaveRacks: () => Promise<void> | void;
};

export function RackSelectionPanel({
  editingBooking,
  selectedRacks,
  rackValidationError,
  savingRacks,
  applyRacksToAll,
  setApplyRacksToAll,
  seriesInstancesForRacks,
  weeksForRacks,
  rackSelectionWeekIndex,
  setRackSelectionWeekIndex,
  currentWeekInstancesForRacks,
  selectedInstancesForRacks,
  setSelectedInstancesForRacks,
  handleCancelRackSelection,
  handleSaveRacks,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Select Platforms for {editingBooking?.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Click racks to select or deselect. Selected racks ({selectedRacks.length}) are highlighted. Racks used by other bookings are grayed out.
          </p>
          {rackValidationError && (
            <div className="mt-2 p-2 bg-red-900/20 border border-red-700 rounded-md">
              <p className="text-xs text-red-300 font-medium whitespace-pre-line">
                {rackValidationError}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancelRackSelection}
            disabled={savingRacks}
            className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50 rounded-md border border-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveRacks}
            disabled={
              savingRacks ||
              selectedRacks.length === 0 ||
              selectedInstancesForRacks.size === 0 ||
              !!rackValidationError
            }
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded-md",
              rackValidationError
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {savingRacks
              ? "Saving..."
              : rackValidationError
                ? "Conflicts Detected"
                : `Save${selectedInstancesForRacks.size > 1 ? ` (${selectedInstancesForRacks.size})` : ""}`}
          </button>
        </div>
      </div>

      {/* Series Instance Selection for Racks */}
      {seriesInstancesForRacks.length > 1 && (
        <div className="border border-slate-700 rounded-md bg-slate-950/60 p-2">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-300">
              Apply to Sessions ({seriesInstancesForRacks.length})
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={applyRacksToAll}
                onChange={(e) => setApplyRacksToAll(e.target.checked)}
                disabled={savingRacks}
                className="h-3 w-3 rounded border-slate-600 bg-slate-950"
              />
              <span>Apply to all</span>
            </label>
          </div>

          {/* Week Navigation for Rack Selection */}
          {weeksForRacks.length > 1 && (
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setRackSelectionWeekIndex((prev) => Math.max(0, prev - 1))}
                disabled={rackSelectionWeekIndex === 0 || savingRacks}
                className={clsx(
                  "px-2 py-1 text-xs rounded border",
                  rackSelectionWeekIndex === 0 || savingRacks
                    ? "border-slate-700 text-slate-600 cursor-not-allowed"
                    : "border-slate-600 text-slate-300 hover:bg-slate-800"
                )}
              >
                ← Previous Week
              </button>
              <span className="text-xs text-slate-400">
                Week {rackSelectionWeekIndex + 1} of {weeksForRacks.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setRackSelectionWeekIndex((prev) =>
                    Math.min(weeksForRacks.length - 1, prev + 1)
                  )
                }
                disabled={rackSelectionWeekIndex === weeksForRacks.length - 1 || savingRacks}
                className={clsx(
                  "px-2 py-1 text-xs rounded border",
                  rackSelectionWeekIndex === weeksForRacks.length - 1 || savingRacks
                    ? "border-slate-700 text-slate-600 cursor-not-allowed"
                    : "border-slate-600 text-slate-300 hover:bg-slate-800"
                )}
              >
                Next Week →
              </button>
            </div>
          )}

          <div className="max-h-24 overflow-auto">
            <div className="space-y-1">
              {currentWeekInstancesForRacks.map((inst) => {
                const isSelected = selectedInstancesForRacks.has(inst.id);
                const isCurrent = inst.id === editingBooking?.instanceId;
                const formatDateTime = (isoString: string) => {
                  const date = new Date(isoString);
                  return date.toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                };
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
                      onChange={(e) => {
                        const next = new Set(selectedInstancesForRacks);
                        if (e.target.checked) {
                          next.add(inst.id);
                        } else {
                          next.delete(inst.id);
                        }
                        setSelectedInstancesForRacks(next);
                      }}
                      disabled={savingRacks}
                      className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                    />
                    <span className="flex-1">
                      {formatDateTime(inst.start)} - {formatDateTime(inst.end)}
                      {isCurrent && <span className="ml-2 text-indigo-400">(Current)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {selectedInstancesForRacks.size} of {seriesInstancesForRacks.length} sessions selected
          </p>
        </div>
      )}
    </div>
  );
}


