/**
 * Area keys for the Power floorplan. Must match:
 * - public.areas.key for side Power (seed migration)
 * - data-area-key on SVG elements in PowerFloorplan.tsx
 *
 * Used for wayfinding "in use" highlighting and area slots (Sprint 4).
 */
export const POWER_FLOORPLAN_AREA_KEYS = [
  'dumbbell',
  'cables',
  'fixed_machines',
  'weight_lifting',
  'functional',
  'track',
  'platforms',
] as const;

export type PowerFloorplanAreaKey = (typeof POWER_FLOORPLAN_AREA_KEYS)[number];
