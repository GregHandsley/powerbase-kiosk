-- Add independently bookable Base areas: two dumbbell areas, two machine areas.
-- Safe to re-run (idempotent).

INSERT INTO public.areas (side_id, key, name, site_id)
SELECT s.id, v.key, v.name, s.site_id
FROM public.sides s
CROSS JOIN (VALUES
  ('dumbbell_1', 'Dumbbell Area 1'),
  ('dumbbell_2', 'Dumbbell Area 2'),
  ('machines_1', 'Machines 1'),
  ('machines_2', 'Machines 2')
) AS v(key, name)
WHERE s.key = 'Base'
  AND NOT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.side_id = s.id AND a.key = v.key
  );
