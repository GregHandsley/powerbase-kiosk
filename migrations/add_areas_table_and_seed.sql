-- Seed areas for wayfinding / area slots (Sprint 1).
-- Uses existing public.areas table (id, side_id, key, name, site_id).
-- Keys match floorplan area keys for Base and Power. Safe to re-run (idempotent).

-- Seed Base side areas (keys match Base floorplan in FloorShell / EditableFloorplan)
INSERT INTO public.areas (side_id, key, name, site_id)
SELECT s.id, v.key, v.name, s.site_id
FROM public.sides s
CROSS JOIN (VALUES
  ('bike_met_con', 'Bike / Met Con Area'),
  ('machines', 'Machines'),
  ('dumbbell', 'Dumbbell Area'),
  ('weight_lifting', 'Weight Lifting Area'),
  ('cables', 'Cables'),
  ('fixed_machines', 'Fixed Machines'),
  ('functional', 'Functional Area'),
  ('track', 'Track')
) AS v(key, name)
WHERE s.key = 'Base'
  AND NOT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.side_id = s.id AND a.key = v.key
  );

-- Seed Power side areas (keys match Power floorplan in PowerFloorplan.tsx / EditableFloorplan)
INSERT INTO public.areas (side_id, key, name, site_id)
SELECT s.id, v.key, v.name, s.site_id
FROM public.sides s
CROSS JOIN (VALUES
  ('dumbbell', 'Dumbbell Area'),
  ('cables', 'Cables'),
  ('fixed_machines', 'Fixed Machines'),
  ('weight_lifting', 'Weight Lifting Area'),
  ('functional', 'Functional Area'),
  ('track', 'Track'),
  ('platforms', 'Platforms')
) AS v(key, name)
WHERE s.key = 'Power'
  AND NOT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.side_id = s.id AND a.key = v.key
  );
