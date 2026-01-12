import {
  formatTimeSlot,
  type TimeSlot,
} from '../../../admin/capacity/scheduleUtils';
import type {
  SlotCapacityData,
  UnavailableBlock,
  BookingBlock,
} from '../types';

/**
 * Calculate unavailable blocks (General User/Closed) for each rack
 */
export function calculateUnavailableBlocksByRack(
  racks: number[],
  timeSlots: TimeSlot[],
  slotCapacityData: Map<number, SlotCapacityData>,
  bookingBlocksByRack: Map<number, BookingBlock[]>
): Map<number, UnavailableBlock[]> {
  const blocksByRack = new Map<number, UnavailableBlock[]>();

  racks.forEach((rack) => {
    const blocks: UnavailableBlock[] = [];
    type CurrentBlockType = {
      startSlot: number;
      periodType: 'General User' | 'Closed';
      startTime: string;
      periodEndTime?: string; // Store the actual end time for closed periods
    };
    let currentBlock: CurrentBlockType | null = null;

    timeSlots.forEach((slot, slotIndex) => {
      const capacityData = slotCapacityData.get(slotIndex);
      const isAvailable =
        !capacityData ||
        capacityData.availablePlatforms === null ||
        capacityData.availablePlatforms.has(rack);
      const isClosed = capacityData?.isClosed ?? false;
      const isUnavailable = !isAvailable || isClosed;

      // Check if there's a booking block at this slot (bookings take priority)
      const bookingBlocks = bookingBlocksByRack.get(rack) ?? [];
      const hasBooking = bookingBlocks.some(
        (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
      );

      // Only create unavailable block if there's no booking
      if (isUnavailable && !hasBooking) {
        const periodType = isClosed ? 'Closed' : 'General User';

        if (currentBlock && currentBlock.periodType === periodType) {
          // Continue the current block - update periodEndTime if this is a closed period
          if (isClosed && capacityData?.periodEndTime) {
            currentBlock.periodEndTime = capacityData.periodEndTime;
          }
        } else {
          // Close previous block if it exists
          if (currentBlock) {
            // For closed periods, use the stored periodEndTime if available
            // Otherwise, use the previous slot's time
            const endTime =
              currentBlock.periodType === 'Closed' && currentBlock.periodEndTime
                ? currentBlock.periodEndTime
                : formatTimeSlot(timeSlots[slotIndex - 1]);
            blocks.push({
              startSlot: currentBlock.startSlot,
              endSlot: slotIndex - 1,
              rowSpan: slotIndex - currentBlock.startSlot,
              periodType: currentBlock.periodType,
              startTime: currentBlock.startTime,
              endTime: endTime,
            });
          }

          // Start new block
          currentBlock = {
            startSlot: slotIndex,
            periodType: periodType,
            startTime: formatTimeSlot(slot),
            periodEndTime:
              isClosed && capacityData?.periodEndTime
                ? capacityData.periodEndTime
                : undefined,
          };
        }
      } else {
        // Available or has booking - close previous block if it exists
        if (currentBlock) {
          // For closed periods, use the stored periodEndTime if available
          // This ensures we show the actual end time (e.g., 08:30) instead of the previous slot (08:00)
          // Otherwise, use the previous slot's time
          let endTime: string;
          if (
            currentBlock.periodType === 'Closed' &&
            currentBlock.periodEndTime
          ) {
            endTime = currentBlock.periodEndTime;
          } else {
            // For General User or if no periodEndTime, use previous slot
            endTime = formatTimeSlot(timeSlots[slotIndex - 1]);
          }
          blocks.push({
            startSlot: currentBlock.startSlot,
            endSlot: slotIndex - 1,
            rowSpan: slotIndex - currentBlock.startSlot,
            periodType: currentBlock.periodType,
            startTime: currentBlock.startTime,
            endTime: endTime,
          });
          currentBlock = null;
        }
      }
    });

    // Close any remaining block at the end
    if (currentBlock) {
      const block: CurrentBlockType = currentBlock; // Explicit type annotation
      // For closed periods, use the stored periodEndTime if available
      // Otherwise, use the last slot's time
      const endTime =
        block.periodType === 'Closed' && block.periodEndTime
          ? block.periodEndTime
          : formatTimeSlot(timeSlots[timeSlots.length - 1]);
      blocks.push({
        startSlot: block.startSlot,
        endSlot: timeSlots.length - 1,
        rowSpan: timeSlots.length - block.startSlot,
        periodType: block.periodType,
        startTime: block.startTime,
        endTime: endTime,
      });
    }

    blocksByRack.set(rack, blocks);
  });

  return blocksByRack;
}
