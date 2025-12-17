import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { ActiveInstance } from "../../types/snapshot";
import type { RackRow } from "./RackListEditorCore";

type Props = {
  row: RackRow;
  booking: ActiveInstance | null;
  bookingContent: ReactNode;
  style?: React.CSSProperties;
};

export function RackRowDroppable({ row, booking, bookingContent, style }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: row.id,
    data: { rackNumber: row.rackNumber },
    disabled: row.disabled || row.rackNumber === null,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border-2 px-4 sm:px-5 py-4 sm:py-5 transition ${
        row.disabled
          ? "bg-slate-850 border-slate-800 text-slate-600"
          : isOver
            ? "bg-slate-850 border-indigo-500/70 text-slate-100"
            : "bg-slate-900/80 border-slate-800 text-slate-100"
      }`}
    >
      <div className="flex flex-col min-w-[100px] lg:min-w-[120px] flex-shrink-0">
        <span className="font-semibold tracking-wide text-base sm:text-lg">{row.label}</span>
        <span className="text-sm sm:text-base text-slate-400">
          {row.disabled ? "Not bookable" : booking ? "Assigned" : "Available"}
        </span>
      </div>
      <div className="flex-1 min-w-0 text-sm sm:text-base text-slate-200 flex justify-start items-start sm:items-center w-full">
        {bookingContent}
      </div>
    </div>
  );
}

