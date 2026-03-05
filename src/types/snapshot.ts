import type { BookingStatus } from './db';

export interface ActiveInstance {
  instanceId: number;
  bookingId: number;
  start: string;
  end: string;
  racks: number[];
  areas: string[];
  title: string;
  color: string | null;
  isLocked: boolean;
  createdBy: string | null;
  capacity?: number; // Number of athletes in this booking instance
  status?: BookingStatus; // Booking status (pending, processed, etc.)
  /** Per-area time slots (e.g. rack_3 09:00–10:00). When set, schedule uses these for rack blocks instead of instance start/end. */
  area_slots?: Array<{ area_key: string; start: string; end: string }>;
}

export interface NextUseInfo {
  start: string;
  title: string;
}

export interface SideSnapshot {
  at: string;
  sideId: number | null;
  currentInstances: ActiveInstance[];
  nextUseByRack: Record<string, NextUseInfo | null>;
  nextUseByArea: Record<string, NextUseInfo | null>;
}
