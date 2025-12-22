import { format } from "date-fns";

type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

interface PeriodTypeOverride {
  id: number;
  date: string;
  period_type: PeriodType;
  capacity: number;
  notes: string | null;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingOverride: PeriodTypeOverride | null;
  overrideDate: string;
  setOverrideDate: (date: string) => void;
  overridePeriodType: PeriodType;
  setOverridePeriodType: (type: PeriodType) => void;
  overrideCapacity: number;
  setOverrideCapacity: (capacity: number) => void;
  overrideNotes: string;
  setOverrideNotes: (notes: string) => void;
  loading: boolean;
};

/**
 * Modal for creating/editing period type overrides
 */
export function OverrideModal({
  isOpen,
  onClose,
  onSave,
  editingOverride,
  overrideDate,
  setOverrideDate,
  overridePeriodType,
  setOverridePeriodType,
  overrideCapacity,
  setOverrideCapacity,
  overrideNotes,
  setOverrideNotes,
  loading,
}: Props) {
  if (!isOpen) return null;

  const periodTypes: PeriodType[] = ["High Hybrid", "Low Hybrid", "Performance", "General User", "Closed"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            {editingOverride ? "Edit Override" : "Add Override"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
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

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
            <input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Period Type</label>
            <select
              value={overridePeriodType}
              onChange={(e) => setOverridePeriodType(e.target.value as PeriodType)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {periodTypes.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Capacity</label>
            <input
              type="number"
              min={0}
              value={overrideCapacity}
              onChange={(e) => setOverrideCapacity(parseInt(e.target.value) || 0)}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
            <textarea
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g., Reduced capacity due to event"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

