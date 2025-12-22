-- Add platforms column to capacity_schedules table
-- This stores an array of rack/platform numbers that can be used during this period
ALTER TABLE public.capacity_schedules
ADD COLUMN IF NOT EXISTS platforms jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.capacity_schedules.platforms IS 'Array of rack/platform numbers that can be used during this capacity schedule period';

