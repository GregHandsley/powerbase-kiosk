import { format, eachDayOfInterval, addDays, startOfWeek, getDay } from "date-fns";
import clsx from "clsx";
import { PERIOD_TYPE_COLORS } from "./constants";
import { generateTimeSlots, formatTimeSlot, getCapacityKey, type TimeSlot, type PeriodType, type CapacityData } from "./scheduleUtils";

type Block = {
  startSlot: number;
  endSlot: number;
  rowSpan: number;
  capacity: number;
  periodType: PeriodType;
  startTime: string;
  endTime: string;
};

type Props = {
  currentWeek: Date;
  capacityData: Map<string, CapacityData>;
  timeSlots: TimeSlot[];
  onCellClick: (day: Date, timeSlot: TimeSlot) => void;
};

function getMergedBlocks(
  day: Date,
  capacityData: Map<string, CapacityData>,
  timeSlots: TimeSlot[]
): Block[] {
  const blocks: Block[] = [];
  type CurrentBlock = {
    startSlot: number;
    capacity: number;
    periodType: PeriodType;
    startTime: string;
  };

  let currentBlock: CurrentBlock | null = null;

  timeSlots.forEach((slot, slotIndex) => {
    const key = getCapacityKey(day, slot);
    const cellData = capacityData.get(key);

    if (cellData && cellData.periodType) {
      const periodType = cellData.periodType as PeriodType;
      
      if (currentBlock && currentBlock.periodType === periodType && currentBlock.capacity === cellData.capacity) {
        // Continue the current block
      } else {
        // Close previous block if it exists
        if (currentBlock) {
          const endTime = formatTimeSlot(timeSlots[slotIndex - 1]);
          blocks.push({
            startSlot: currentBlock.startSlot,
            endSlot: slotIndex - 1,
            rowSpan: slotIndex - currentBlock.startSlot,
            capacity: currentBlock.capacity,
            periodType: currentBlock.periodType,
            startTime: currentBlock.startTime,
            endTime: endTime,
          });
        }
        
        // Start new block
        currentBlock = {
          startSlot: slotIndex,
          capacity: cellData.capacity,
          periodType: periodType,
          startTime: formatTimeSlot(slot),
        };
      }
    } else {
      // No data for this slot, close previous block if it exists
      if (currentBlock) {
        const endTime = formatTimeSlot(timeSlots[slotIndex - 1]);
        blocks.push({
          startSlot: currentBlock.startSlot,
          endSlot: slotIndex - 1,
          rowSpan: slotIndex - currentBlock.startSlot,
          capacity: currentBlock.capacity,
          periodType: currentBlock.periodType,
          startTime: currentBlock.startTime,
          endTime: endTime,
        });
        currentBlock = null;
      }
    }
  });

  // Close any remaining block at the end
  if (currentBlock !== null) {
    const lastSlot = timeSlots[timeSlots.length - 1];
    const endTime = formatTimeSlot(lastSlot);
    blocks.push({
      startSlot: currentBlock.startSlot,
      endSlot: timeSlots.length - 1,
      rowSpan: timeSlots.length - currentBlock.startSlot,
      capacity: currentBlock.capacity,
      periodType: currentBlock.periodType,
      startTime: currentBlock.startTime,
      endTime: endTime,
    });
  }

  return blocks;
}

export function CapacityCalendarGrid({
  currentWeek,
  capacityData,
  timeSlots,
  onCellClick,
}: Props) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  return (
    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          {/* Days Header - Sticky */}
          <div className="sticky top-0 z-20 grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-700 bg-slate-900">
            <div className="p-3 border-r border-slate-700 bg-slate-950/50"></div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className="p-3 border-r border-slate-700 last:border-r-0 bg-slate-950/50 text-center"
              >
                <div className="text-sm font-medium text-slate-200">
                  {format(day, "EEE")}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {format(day, "M/d")}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {timeSlots.map((slot, slotIndex) => (
            <div
              key={slotIndex}
              className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-800"
            >
              {/* Time Label - Sticky */}
              <div className="sticky left-0 z-10 p-3 border-r border-slate-700 bg-slate-950/95 text-xs text-slate-400 text-right font-mono whitespace-nowrap">
                {formatTimeSlot(slot)}
              </div>

              {/* Day Cells */}
              {weekDays.map((day, dayIndex) => {
                const mergedBlocks = getMergedBlocks(day, capacityData, timeSlots);
                const blockForThisSlot = mergedBlocks.find(
                  (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
                );
                const isBlockStart = blockForThisSlot?.startSlot === slotIndex;
                const isInBlock = !!blockForThisSlot;

                return (
                  <div
                    key={dayIndex}
                    className="relative border-r border-slate-800 last:border-r-0 min-h-[50px]"
                  >
                    {isBlockStart && blockForThisSlot && (
                      <div
                        className={clsx(
                          "absolute left-0 right-0 border-l-4 border-t border-b border-r rounded-sm cursor-pointer transition-opacity hover:opacity-90 shadow-md",
                          PERIOD_TYPE_COLORS[blockForThisSlot.periodType].bg,
                          PERIOD_TYPE_COLORS[blockForThisSlot.periodType].border,
                          "flex flex-col items-center justify-center p-2"
                        )}
                        style={{
                          top: 0,
                          height: `${blockForThisSlot.rowSpan * 50}px`,
                          zIndex: 5,
                          margin: "2px 4px",
                          left: "4px",
                          right: "4px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCellClick(day, timeSlots[blockForThisSlot.startSlot]);
                        }}
                      >
                        <div className={clsx("text-xs font-semibold", PERIOD_TYPE_COLORS[blockForThisSlot.periodType].text)}>
                          {blockForThisSlot.periodType}
                        </div>
                        <div className={clsx("text-[10px] mt-1", PERIOD_TYPE_COLORS[blockForThisSlot.periodType].text)}>
                          {blockForThisSlot.capacity} {blockForThisSlot.capacity === 1 ? "Athlete" : "Athletes"}
                        </div>
                      </div>
                    )}
                    <div
                      className={clsx(
                        "h-full w-full transition-colors",
                        isInBlock && !isBlockStart ? "pointer-events-none" : "cursor-pointer hover:bg-slate-800/30"
                      )}
                      onClick={() => {
                        if (!isInBlock || isBlockStart) {
                          onCellClick(day, slot);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

