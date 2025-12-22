import { useState } from "react";
import { format } from "date-fns";
import { BookingInfoDisplay } from "./BookingInfoDisplay";

type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

interface PeriodTypeOverride {
  id: number;
  date: string;
  period_type: PeriodType;
  capacity: number;
  booking_id: number | null;
  notes: string | null;
}

type Props = {
  overrides: PeriodTypeOverride[];
  expandedOverrides: Set<number>;
  selectedInstances: Map<number, Set<number>>;
  onToggleExpanded: (overrideId: number) => void;
  onToggleInstanceSelection: (bookingId: number, instanceId: number) => void;
  onEdit: (override: PeriodTypeOverride) => void;
  onDelete: (id: number) => void;
  onDeleteSelectedInstances: (bookingId: number, instanceIds: number[]) => void;
  onDeleteSeries: (bookingId: number) => void;
  onAddOverride: () => void;
  loading: boolean;
};

/**
 * Section for managing period type overrides
 */
export function PeriodTypeOverridesSection({
  overrides,
  expandedOverrides,
  selectedInstances,
  onToggleExpanded,
  onToggleInstanceSelection,
  onEdit,
  onDelete,
  onDeleteSelectedInstances,
  onDeleteSeries,
  onAddOverride,
  loading,
}: Props) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Date-Specific Overrides</h3>
        <button
          onClick={onAddOverride}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          + Add Override
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {overrides.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            No overrides set. Click "Add Override" to set capacity for a specific date.
          </div>
        ) : (
          <div className="space-y-2">
            {overrides.map((override) => (
              <div
                key={override.id}
                className="p-3 rounded-md border border-slate-700 bg-slate-950/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-200">
                      {format(new Date(override.date), "EEE, MMM d, yyyy")} - {override.period_type}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Capacity: {override.capacity}
                      {override.notes && ` • ${override.notes}`}
                    </div>
                    {override.booking_id && (
                      <BookingInfoDisplay
                        override={override}
                        isExpanded={expandedOverrides.has(override.id)}
                        selectedForBooking={selectedInstances.get(override.booking_id) || new Set<number>()}
                        onToggleExpanded={() => onToggleExpanded(override.id)}
                        onToggleInstanceSelection={(instanceId) => onToggleInstanceSelection(override.booking_id!, instanceId)}
                        onDeleteSelected={() => {
                          const instanceIds = Array.from(selectedInstances.get(override.booking_id!) || new Set());
                          if (instanceIds.length === 0) {
                            alert("Please select at least one instance to delete");
                            return;
                          }
                          onDeleteSelectedInstances(override.booking_id!, instanceIds);
                        }}
                        onDeleteSeries={() => onDeleteSeries(override.booking_id!)}
                        loading={loading}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(override)}
                      className="px-3 py-1 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(override.id)}
                      disabled={loading}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                    >
                      Delete Override
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

