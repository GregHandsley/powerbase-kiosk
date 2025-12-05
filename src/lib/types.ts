export type ActiveInstance = {
  id: number;
  bookingId: number;
  title: string;
  color: string | null;
  start: string; // ISO timestamp
  end: string;   // ISO timestamp
  racks: number[];
  areas: string[];
};

export type SideSnapshot = {
  at: string; // ISO time used for the query
  sideKey: "Power" | "Base";
  sideId: number;
  currentInstances: ActiveInstance[];
  nextUseByRack: Record<string, string | null>; // "1" -> "2025-12-05T16:00:00Z"
  nextUseByArea: Record<string, string | null>; // "TRACK" -> "..."
};

export type Snapshot = {
  at: string;
  power: SideSnapshot;
  base: SideSnapshot;
};
