import { useMemo, useRef } from 'react';
import { isSameDay } from 'date-fns';
import type { ScheduleGridProps } from './grid/types';
import {
  calculateBookingBlocksByRack,
  calculateMasterBlocks,
  assignMasterBlocksToLanes,
} from './grid/utils/bookingBlocks';
import { calculateUnavailableBlocksByRack } from './grid/utils/unavailableBlocks';
import type { UnavailableBlock } from './grid/types';
import { useCurrentTimeIndicator } from './grid/hooks/useCurrentTimeIndicator';
import { useDragSelection } from './grid/hooks/useDragSelection';
import { ScheduleGridHeader } from './grid/components/ScheduleGridHeader';
import { ScheduleGridRow } from './grid/components/ScheduleGridRow';
import { CurrentTimeIndicator } from './grid/components/CurrentTimeIndicator';
import { FixedHorizontalScrollbar } from '../shared/FixedHorizontalScrollbar';

export function ScheduleGrid({
  racks,
  timeSlots,
  bookings,
  currentDate,
  slotCapacityData,
  capacityExceededBySlot,
  onCellClick,
  onBookingClick,
  onBookingDoubleClick,
  onDragSelection,
  selectedSide,
  viewMode = 'platforms',
}: ScheduleGridProps) {
  const isMaster = viewMode === 'master';
  const { masterLanesData } = useMemo(() => {
    if (!isMaster)
      return {
        masterLanesData: null as ReturnType<
          typeof assignMasterBlocksToLanes
        > | null,
      };
    const blocks = calculateMasterBlocks(bookings, timeSlots, currentDate);
    const lanesData = assignMasterBlocksToLanes(blocks, 15);
    return { masterLanesData: lanesData };
  }, [isMaster, bookings, timeSlots, currentDate]);

  const displayRacks = useMemo(
    () =>
      isMaster && masterLanesData
        ? Array.from({ length: masterLanesData.numLanes }, (_, i) => i)
        : racks,
    [isMaster, masterLanesData, racks]
  );
  const numRacks = displayRacks.length;
  const gridTemplateColumns = isMaster
    ? `120px repeat(${numRacks}, minmax(0, 1fr))`
    : `120px repeat(${numRacks}, 120px)`;

  const isToday = isSameDay(currentDate, new Date());

  const bookingBlocksByRack = useMemo(() => {
    if (isMaster && masterLanesData) {
      return masterLanesData.blocksByLane;
    }
    return calculateBookingBlocksByRack(
      racks,
      bookings,
      timeSlots,
      currentDate,
      false
    );
  }, [isMaster, masterLanesData, racks, bookings, timeSlots, currentDate]);

  // Calculate unavailable blocks (General User/Closed) for each rack
  const unavailableBlocksByRack = useMemo(
    () =>
      isMaster
        ? new Map<number, UnavailableBlock[]>(displayRacks.map((r) => [r, []]))
        : calculateUnavailableBlocksByRack(
            racks,
            timeSlots,
            slotCapacityData,
            bookingBlocksByRack
          ),
    [
      isMaster,
      displayRacks,
      racks,
      timeSlots,
      slotCapacityData,
      bookingBlocksByRack,
    ]
  );

  // Current time indicator
  const currentTimePosition = useCurrentTimeIndicator(currentDate, timeSlots);

  // Drag selection (for master view only one column is selectable)
  const {
    gridRef,
    isDragging,
    // selectedRange,
    isSelectionValid,
    isCellSelected,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useDragSelection(
    displayRacks,
    timeSlots,
    bookingBlocksByRack,
    slotCapacityData,
    unavailableBlocksByRack,
    onDragSelection,
    currentDate
  );

  // Ref for the horizontal scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // In master view: view-only, empty cells not selectable. Platforms: use normal onCellClick.
  const effectiveOnCellClick = useMemo(
    () => (isMaster ? () => {} : onCellClick),
    [isMaster, onCellClick]
  );

  return (
    <div
      ref={gridRef}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg glass-panel shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={scrollContainerRef}
        className="relative min-h-0 flex-1 overflow-auto overflow-x-auto"
      >
        {/* Current Time Indicator Line - Only show if viewing today */}
        {currentTimePosition && isToday && (
          <CurrentTimeIndicator
            position={currentTimePosition}
            isToday={isToday}
            numRacks={numRacks}
          />
        )}

        <div style={{ minWidth: 'max-content' }}>
          {/* Racks Header - Sticky (or "Bookings" when master) */}
          <ScheduleGridHeader
            racks={displayRacks}
            selectedSide={selectedSide}
            gridTemplateColumns={gridTemplateColumns}
            viewMode={viewMode}
          />

          {/* Time Slots */}
          {timeSlots.map((slot, slotIndex) => (
            <ScheduleGridRow
              key={slotIndex}
              slot={slot}
              slotIndex={slotIndex}
              racks={displayRacks}
              gridTemplateColumns={gridTemplateColumns}
              bookingBlocksByRack={bookingBlocksByRack}
              unavailableBlocksByRack={unavailableBlocksByRack}
              capacityExceededBySlot={capacityExceededBySlot}
              slotCapacityData={slotCapacityData}
              bookings={bookings}
              currentDate={currentDate}
              timeSlots={timeSlots}
              isSelectionValid={isSelectionValid}
              isCellSelected={isCellSelected}
              onCellClick={effectiveOnCellClick}
              onBookingClick={onBookingClick}
              onBookingDoubleClick={onBookingDoubleClick}
              viewMode={viewMode}
              onMouseDown={handleMouseDown}
              isDragging={isDragging}
            />
          ))}
        </div>
      </div>
      <FixedHorizontalScrollbar scrollContainerRef={scrollContainerRef} />
    </div>
  );
}
