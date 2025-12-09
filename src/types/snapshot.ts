export interface ActiveInstance {
    id: number;
    start: string;
    end: string;
    racks: number[];
    areas: string[];
    title: string;
    color: string | null;
  }
  
  export interface SideSnapshot {
    at: string;
    sideId: number | null;
    currentInstances: ActiveInstance[];
    nextUseByRack: Record<string, string | null>;
    nextUseByArea: Record<string, string | null>;
  }
  