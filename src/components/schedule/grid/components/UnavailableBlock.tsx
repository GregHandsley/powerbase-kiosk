import clsx from "clsx";
import { PERIOD_TYPE_COLORS } from "../../../admin/capacity/constants";
import type { UnavailableBlock as UnavailableBlockType } from "../types";

type Props = {
  block: UnavailableBlockType;
};

export function UnavailableBlock({ block }: Props) {
  return (
    <div
      className={clsx(
        "absolute left-0 right-0 border-l-4 border-t border-b border-r rounded-sm transition-opacity shadow-md",
        "flex flex-col items-center justify-center p-2 z-5"
      )}
      style={{
        top: 0,
        height: `${block.rowSpan * 50}px`,
        zIndex: 5, // Below bookings
        margin: "2px 4px",
        left: "4px",
        right: "4px",
        backgroundColor: PERIOD_TYPE_COLORS[block.periodType].bg,
        borderColor: PERIOD_TYPE_COLORS[block.periodType].border,
      }}
    >
      <div
        className={clsx(
          "text-sm font-semibold text-center px-1 break-words",
          PERIOD_TYPE_COLORS[block.periodType].text
        )}
      >
        {block.periodType}
      </div>
      <div
        className={clsx(
          "text-xs mt-1 text-center px-1",
          PERIOD_TYPE_COLORS[block.periodType].text
        )}
      >
        {block.startTime} - {block.endTime.split(':').slice(0, 2).join(':')}
      </div>
    </div>
  );
}

