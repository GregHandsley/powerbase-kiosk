export interface ActiveInstance {
    id: number;
    start: string;
    end: string;
    racks: number[];
    areas: string[];
  }
  
  export interface SideSnapshot {
    at: string;
    sideId: number | null;
    currentInstances: ActiveInstance[];
    nextUseByRack: Record<string, string | null>;
    nextUseByArea: Record<string, string | null>;
  }
  