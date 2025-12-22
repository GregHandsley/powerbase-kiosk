import type { RackRow } from "../RackListEditorCore";
import type { ActiveInstance } from "../../../types/snapshot";
import clsx from "clsx";

type Props = {
  row: RackRow;
  booking: ActiveInstance | null;
  isSelected?: boolean;
  isDisabled?: boolean;
  isClickable?: boolean;
  hasConflict?: boolean;
  onClick?: () => void;
  /** Size variant - 'full' for schedule view, 'mini' for compact view */
  variant?: "full" | "mini";
  /** Reason why the platform is unavailable - for display purposes */
  unavailableReason?: "booked" | "not-in-schedule" | null;
};

/**
 * Shared component for rendering a rack cell.
 * Can be styled differently for full schedule view or mini compact view.
 */
export function RackCell({
  row,
  booking,
  isSelected = false,
  isDisabled = false,
  isClickable = false,
  hasConflict = false,
  onClick,
  variant = "full",
  unavailableReason = null,
}: Props) {
  const handleClick = () => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  const borderColor = hasConflict
    ? "border-red-500"
    : isSelected
      ? "border-indigo-500"
      : isDisabled
        ? "border-slate-600"
        : "border-slate-700";

  const backgroundColor = hasConflict
    ? variant === "mini" ? "bg-red-900/40" : "bg-red-900/30"
    : isSelected
      ? variant === "mini" ? "bg-indigo-900/30" : "bg-indigo-600/20"
      : isDisabled
        ? variant === "mini" ? "bg-slate-800/50" : "bg-slate-900/40 opacity-50"
        : variant === "mini" ? "bg-slate-800/30" : "bg-slate-900/80";

  if (variant === "mini") {
    return (
      <div
        onClick={handleClick}
        style={{
          gridColumn: row.gridColumn,
          gridRow: row.gridRow,
        }}
        className={clsx(
          "flex flex-col items-center justify-center rounded border px-1 py-1 transition text-[10px] leading-tight",
          borderColor,
          backgroundColor,
          isClickable ? "cursor-pointer hover:bg-slate-700/50" : "",
          isDisabled ? "cursor-not-allowed opacity-50" : "",
          row.disabled ? "text-slate-600" : "text-slate-100"
        )}
      >
        <span className="font-semibold text-[10px]">{row.label}</span>
        {!row.disabled && isDisabled && (
          <span className="text-[8px] text-slate-400 mt-0.5 leading-none">
            {unavailableReason === "booked" 
              ? "Booked" 
              : unavailableReason === "not-in-schedule"
              ? "Unavailable"
              : "Unavailable"}
          </span>
        )}
      </div>
    );
  }

  // Full variant - this would be used by RackRowDroppable, but keeping the interface consistent
  // The full variant is actually handled by RackRowDroppable, so this is mainly for mini
  return null;
}

