import type { BookingInstanceAreaSlotRow } from '../../../types/db';

export type SeriesInstance = {
  id: number;
  start: string;
  end: string;
  racks: number[];
  areas: string[];
  sideId: number;
  capacity?: number;
  area_slots?: BookingInstanceAreaSlotRow[];
};

export type AreaSlotFormEntry = {
  area_key: string;
  start: string;
  end: string;
};

export type CancelMode = 'single' | 'future' | 'all';

export type OriginalValues = {
  startTime: string;
  endTime: string;
  capacity: number;
} | null;
