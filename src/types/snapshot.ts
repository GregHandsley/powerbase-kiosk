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
}

export interface SideSnapshot {
  at: string;
  sideId: number | null;
  currentInstances: ActiveInstance[];
  nextUseByRack: Record<string, string | null>;
  nextUseByArea: Record<string, string | null>;
}
