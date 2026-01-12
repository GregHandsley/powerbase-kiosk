import type { TimeSlot } from '../../admin/capacity/scheduleUtils';
import type { ActiveInstance } from '../../../types/snapshot';

export type SlotCapacityData = {
  availablePlatforms: Set<number> | null;
  isClosed: boolean;
  periodType: string | null;
  periodEndTime?: string; // The actual end time of the closed period (HH:mm format)
};

export type ScheduleGridProps = {
  racks: number[];
  timeSlots: TimeSlot[];
  selectedSide: 'Power' | 'Base';
  bookings: ActiveInstance[];
  currentDate: Date;
  slotCapacityData: Map<number, SlotCapacityData>;
  capacityExceededBySlot?: Map<number, Set<number>>; // slotIndex -> Set of racks at capacity
  onCellClick: (rack: number, timeSlot: TimeSlot) => void;
  onBookingClick?: (booking: ActiveInstance) => void;
  onDragSelection?: (selection: {
    startTimeSlot: TimeSlot;
    endTimeSlot: TimeSlot;
    racks: number[];
  }) => void;
};

export type BookingBlock = {
  booking: ActiveInstance;
  startSlot: number;
  endSlot: number;
  rowSpan: number;
};

export type UnavailableBlock = {
  startSlot: number;
  endSlot: number;
  rowSpan: number;
  periodType: 'General User' | 'Closed';
  startTime: string;
  endTime: string;
};
