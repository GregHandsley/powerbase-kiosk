import type { BookingStatus } from "./db";

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
