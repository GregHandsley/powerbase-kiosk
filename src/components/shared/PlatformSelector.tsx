import { useMemo } from "react";
import clsx from "clsx";

export type PlatformOption = {
  number: number;
  label: string;
  disabled?: boolean;
};

type Props = {
  /** Available platforms/racks to choose from */
  availablePlatforms: PlatformOption[];
  /** Currently selected platform numbers */
  selectedPlatforms: number[];
  /** Callback when selection changes */
  onSelectionChange: (selected: number[]) => void;
  /** Optional label for the selector */
  label?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional class name */
  className?: string;
};

/**
 * Reusable component for selecting platforms/racks.
 * Displays available platforms as checkboxes and allows selecting/deselecting them.
 */
export function PlatformSelector({
  availablePlatforms,
  selectedPlatforms,
  onSelectionChange,
  label = "Platforms",
  disabled = false,
  className,
}: Props) {
  const selectedSet = useMemo(() => new Set(selectedPlatforms), [selectedPlatforms]);

  const handleToggle = (platformNumber: number) => {
    if (disabled) return;
    
    const newSelection = selectedSet.has(platformNumber)
      ? selectedPlatforms.filter((n) => n !== platformNumber)
      : [...selectedPlatforms, platformNumber].sort((a, b) => a - b);
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const allNumbers = availablePlatforms
      .filter((p) => !p.disabled)
      .map((p) => p.number)
      .sort((a, b) => a - b);
    onSelectionChange(allNumbers);
  };

  const handleDeselectAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  const bookablePlatforms = availablePlatforms.filter((p) => !p.disabled);
  const allSelected = bookablePlatforms.length > 0 && 
    bookablePlatforms.every((p) => selectedSet.has(p.number));

  return (
    <div className={clsx("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">{label}</label>
          {bookablePlatforms.length > 0 && (
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={disabled || allSelected}
                className={clsx(
                  "text-slate-400 hover:text-slate-200",
                  (disabled || allSelected) && "opacity-50 cursor-not-allowed"
                )}
              >
                Select all
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={disabled || selectedPlatforms.length === 0}
                className={clsx(
                  "text-slate-400 hover:text-slate-200",
                  (disabled || selectedPlatforms.length === 0) && "opacity-50 cursor-not-allowed"
                )}
              >
                Deselect all
              </button>
            </div>
          )}
        </div>
      )}

      <div className="border border-slate-700 rounded-md p-3 bg-slate-950/60 max-h-64 overflow-auto">
        {availablePlatforms.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-2">No platforms available</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {availablePlatforms.map((platform) => {
              const isSelected = selectedSet.has(platform.number);
              const isDisabled = disabled || platform.disabled;

              return (
                <label
                  key={platform.number}
                  className={clsx(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                      : "bg-slate-900/40 border-slate-600 text-slate-200 hover:border-slate-500",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(platform.number)}
                    disabled={isDisabled}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className="text-xs font-medium">{platform.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selectedPlatforms.length > 0 && (
        <p className="text-xs text-slate-400">
          {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""} selected:{" "}
          {selectedPlatforms.join(", ")}
        </p>
      )}
    </div>
  );
}

