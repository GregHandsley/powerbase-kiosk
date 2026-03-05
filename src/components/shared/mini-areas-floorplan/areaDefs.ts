import { VIEWBOX_WIDTH, VIEWBOX_HEIGHT, FLOOR_MARGIN } from './constants';
import type { AreaDef } from './types';

export const BASE_AREA_DEFS: AreaDef[] = [
  {
    key: 'bike_met_con',
    x: VIEWBOX_WIDTH - FLOOR_MARGIN - 42,
    y: FLOOR_MARGIN,
    w: 42,
    h: 37,
  },
  {
    key: 'machines_1',
    x: VIEWBOX_WIDTH - FLOOR_MARGIN - 85,
    y: FLOOR_MARGIN,
    w: 40,
    h: 37,
  },
  {
    key: 'dumbbell_1',
    x: VIEWBOX_WIDTH - FLOOR_MARGIN - 85,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 45,
    w: 30,
    h: 45,
  },
  {
    key: 'dumbbell_2',
    x: VIEWBOX_WIDTH - FLOOR_MARGIN - 154,
    y: FLOOR_MARGIN,
    w: 35,
    h: 37,
  },
  {
    key: 'machines_2',
    x: FLOOR_MARGIN,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 44,
    w: 35,
    h: 44,
  },
];

export const POWER_AREA_DEFS: AreaDef[] = [
  { key: 'dumbbell', x: FLOOR_MARGIN, y: FLOOR_MARGIN + 29, w: 25, h: 34 },
  {
    key: 'cables',
    x: FLOOR_MARGIN,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 20,
    w: 25,
    h: 20,
  },
  {
    key: 'fixed_machines',
    x: FLOOR_MARGIN + 35,
    y: FLOOR_MARGIN + 30,
    w: 35,
    h: 55,
  },
  {
    key: 'weight_lifting',
    x: 75,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 85,
    w: 45,
    h: 29,
  },
  {
    key: 'functional',
    x: 75,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 29,
    w: 45,
    h: 30,
  },
  {
    key: 'track',
    x: VIEWBOX_WIDTH - FLOOR_MARGIN - 35,
    y: FLOOR_MARGIN - 1,
    w: 35,
    h: VIEWBOX_HEIGHT - FLOOR_MARGIN - 1,
  },
];

export function getAreaDefs(sideKey: 'Power' | 'Base'): AreaDef[] {
  return sideKey === 'Base' ? BASE_AREA_DEFS : POWER_AREA_DEFS;
}
