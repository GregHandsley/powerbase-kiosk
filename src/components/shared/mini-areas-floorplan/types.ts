import type { ActiveInstance } from '../../../types/snapshot';

export type AreaDef = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MiniAreasFloorplanProps = {
  sideKey: 'Power' | 'Base';
  selectedAreaKeys: string[];
  onAreaClick: (areaKey: string) => void;
  areaBookingByKey?: Map<string, ActiveInstance>;
  enableAreaDrag?: boolean;
  onEditBooking?: (booking: ActiveInstance) => void;
  areaKeysFilter?: string[];
  bookedAreaKeys?: Set<string>;
  freeIntervalsByArea?: Map<string, Array<{ start: string; end: string }>>;
  areasInteractive?: boolean;
  onPlatformsClick?: () => void;
  platformLabel?: string;
  platformOverlayFill?: string;
  platformOverlayStroke?: string;
  fit?: 'contain' | 'cover' | 'fill';
  showOuterFrame?: boolean;
};
