import clsx from "clsx";
import { PERIOD_TYPE_COLORS } from "../../../admin/capacity/constants";
import type { UnavailableBlock as UnavailableBlockType } from "../types";

type Props = {
  block: UnavailableBlockType;
};

export function UnavailableBlock({ block }: Props) {
  // Use subtle red styling for General User (similar to capacity exceeded)
  // Keep original styling for Closed periods
  const isGeneralUser = block.periodType === "General User";
  
  return (
    <div
      className={clsx(
        "absolute left-0 right-0 border-t border-b border-r rounded-sm transition-opacity",
        "flex flex-col items-center justify-center p-2 z-5",
        isGeneralUser 
          ? "bg-red-950/20 border-l-2 border-red-800/30" // Subtle red like capacity exceeded
          : "border-l-4 shadow-md" // Original styling for Closed
      )}
      style={{
        top: 0,
        height: `${block.rowSpan * 50}px`,
        zIndex: 5, // Below bookings
        margin: "2px 4px",
        left: "4px",
        right: "4px",
        ...(isGeneralUser 
          ? {} 
          : {
        backgroundColor: PERIOD_TYPE_COLORS[block.periodType].bg,
        borderColor: PERIOD_TYPE_COLORS[block.periodType].border,
            }
        ),
      }}
    >
      <div
        className={clsx(
          "text-sm font-semibold text-center px-1 break-words",
          isGeneralUser 
            ? "text-red-300/70" // Subtle red text
            : PERIOD_TYPE_COLORS[block.periodType].text
        )}
      >
        {block.periodType}
      </div>
      {!isGeneralUser && (
      <div
        className={clsx(
          "text-xs mt-1 text-center px-1",
          PERIOD_TYPE_COLORS[block.periodType].text
        )}
      >
        {block.startTime} - {block.endTime.split(':').slice(0, 2).join(':')}
      </div>
      )}
    </div>
  );
}

