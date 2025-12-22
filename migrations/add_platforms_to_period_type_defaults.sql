-- Add side_id and platforms to period_type_capacity_defaults
-- This allows different platform defaults per period type per side (Power/Base)

-- First, add side_id column (nullable initially for existing data)
ALTER TABLE public.period_type_capacity_defaults
ADD COLUMN IF NOT EXISTS side_id bigint REFERENCES public.sides(id) ON DELETE CASCADE;

-- Add platforms column
ALTER TABLE public.period_type_capacity_defaults
ADD COLUMN IF NOT EXISTS platforms jsonb DEFAULT '[]'::jsonb;

-- Drop the old unique constraint on period_type if it exists
ALTER TABLE public.period_type_capacity_defaults
DROP CONSTRAINT IF EXISTS period_type_capacity_defaults_period_type_key;

-- Drop the new constraint if it already exists (in case migration is run multiple times)
ALTER TABLE public.period_type_capacity_defaults
DROP CONSTRAINT IF EXISTS period_type_capacity_defaults_period_type_side_id_key;

-- Handle existing records with NULL side_id - set them to Power side as default
-- You can change this logic if you want different behavior
UPDATE public.period_type_capacity_defaults 
SET side_id = (SELECT id FROM public.sides WHERE key = 'Power' LIMIT 1) 
WHERE side_id IS NULL;

-- Make side_id NOT NULL now that we've set defaults
ALTER TABLE public.period_type_capacity_defaults
ALTER COLUMN side_id SET NOT NULL;

-- Add new unique constraint on (period_type, side_id)
-- This allows different defaults for Power vs Base
ALTER TABLE public.period_type_capacity_defaults
ADD CONSTRAINT period_type_capacity_defaults_period_type_side_id_key 
UNIQUE (period_type, side_id);

COMMENT ON COLUMN public.period_type_capacity_defaults.side_id IS 'The side (Power/Base) this default applies to. Required for all records.';
COMMENT ON COLUMN public.period_type_capacity_defaults.platforms IS 'Array of default rack/platform numbers for this period type and side';

