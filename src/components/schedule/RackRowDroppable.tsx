import type { ReactNode } from "react";
import { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { ActiveInstance } from "../../types/snapshot";
import type { RackRow } from "./RackListEditorCore";

type Props = {
  row: RackRow;
  booking: ActiveInstance | null;
  bookingContent: ReactNode;
  style?: React.CSSProperties;
  isSelectingRacks?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  isClickable?: boolean;
  onRackClick?: () => void;
};

export function RackRowDroppable({ 
  row, 
  booking, 
  bookingContent, 
  style,
  isSelectingRacks = false,
  isSelected = false,
  isDisabled = false,
  isClickable = false,
  onRackClick,
}: Props) {
  // Use a regular ref when selecting racks to avoid droppable interference
  const clickRef = useRef<HTMLDivElement>(null);
  
  // Only use droppable when not in selection mode
  const droppableResult = useDroppable({
    id: row.id,
    data: { rackNumber: row.rackNumber },
    disabled: row.disabled || row.rackNumber === null || isSelectingRacks,
  });
  
  const setNodeRef = isSelectingRacks 
    ? (node: HTMLDivElement | null) => {
        clickRef.current = node;
      }
    : droppableResult.setNodeRef;
  const isOver = isSelectingRacks ? false : droppableResult.isOver;

  const handleClick = (e: React.MouseEvent) => {
    console.log("RackRowDroppable clicked", {
      isSelectingRacks,
      isClickable,
      hasOnRackClick: !!onRackClick,
      rackNumber: row.rackNumber,
      target: e.target,
      currentTarget: e.currentTarget,
    });
    
    if (isSelectingRacks && isClickable && onRackClick) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Calling onRackClick for rack", row.rackNumber);
      onRackClick();
    } else {
      console.log("Click not handled", {
        isSelectingRacks,
        isClickable,
        hasOnRackClick: !!onRackClick,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSelectingRacks && isClickable) {
      // Prevent any drag operations when in selection mode
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const getBorderColor = () => {
    if (isSelectingRacks) {
      if (isSelected) {
        console.log(`Rack ${row.rackNumber} border: indigo (selected)`);
        return "border-indigo-500";
      }
      if (isDisabled) return "border-slate-600";
      return "border-slate-700";
    }
    if (row.disabled) return "border-slate-800";
    if (isOver) return "border-indigo-500/70";
    return "border-slate-800";
  };

  const getBackgroundColor = () => {
    if (isSelectingRacks) {
      if (isSelected) {
        console.log(`Rack ${row.rackNumber} background: indigo (selected)`);
        return "bg-indigo-600/20";
      }
      if (isDisabled) return "bg-slate-900/40 opacity-50";
      return "bg-slate-900/80";
    }
    if (row.disabled) return "bg-slate-850";
    if (isOver) return "bg-slate-850";
    return "bg-slate-900/80";
  };

  const borderColor = getBorderColor();
  const backgroundColor = getBackgroundColor();
  
  if (isSelectingRacks && row.rackNumber !== null) {
    console.log(`RackRowDroppable render for rack ${row.rackNumber}:`, {
      isSelected,
      isDisabled,
      isClickable,
      borderColor,
      backgroundColor,
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border-2 px-4 sm:px-5 py-4 sm:py-5 transition ${backgroundColor} ${borderColor} ${
        isSelectingRacks && isClickable ? "cursor-pointer hover:bg-slate-800/60" : ""
      } ${
        isSelectingRacks && isDisabled ? "cursor-not-allowed" : ""
      } ${
        row.disabled ? "text-slate-600" : "text-slate-100"
      }`}
    >
      <div className="flex flex-col min-w-[100px] lg:min-w-[120px] flex-shrink-0">
        <span className="font-semibold tracking-wide text-base sm:text-lg">{row.label}</span>
        <span className="text-sm sm:text-base text-slate-400">
          {row.disabled ? "Not bookable" : booking ? "Assigned" : "Available"}
        </span>
      </div>
      <div 
        className="flex-1 min-w-0 text-sm sm:text-base text-slate-200 flex justify-start items-start sm:items-center w-full"
        style={isSelectingRacks ? { pointerEvents: "none" } : undefined}
      >
        {bookingContent}
      </div>
    </div>
  );
}

