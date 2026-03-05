/**
 * Area keys for the Base floorplan. Must match:
 * - public.areas.key in the database (seed migration)
 * - data-area-key on SVG elements in FloorShell / Base floorplan
 *
 * Used for wayfinding "in use" highlighting and area slots (Sprint 4).
 * Base has two independently bookable dumbbell areas and two machine areas.
 */
export const BASE_FLOORPLAN_AREA_KEYS = [
  'bike_met_con',
  'dumbbell_1',
  'dumbbell_2',
  'machines_1',
  'machines_2',
  'weight_lifting',
  'cables',
  'fixed_machines',
  'functional',
  'track',
] as const;

export type BaseFloorplanAreaKey = (typeof BASE_FLOORPLAN_AREA_KEYS)[number];

/** Area keys that are actually drawn in FloorShell (wayfinding map). */
export const BASE_FLOORPLAN_DRAWN_AREA_KEYS: BaseFloorplanAreaKey[] = [
  'bike_met_con',
  'dumbbell_1',
  'dumbbell_2',
  'machines_1',
  'machines_2',
];
