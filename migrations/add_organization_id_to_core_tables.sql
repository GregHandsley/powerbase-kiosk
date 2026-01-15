-- Add organization_id to core tables
-- This migration makes bookings and sides organization-aware
-- Layer 1: Foundations - No permission logic or isolation yet, just making data org-aware

-- Step 1: Add organization_id column to sides table (nullable initially)
ALTER TABLE public.sides
ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Step 2: Add organization_id column to bookings table (nullable initially)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Step 3: Backfill existing rows with default organization (id = 1)
UPDATE public.sides
SET organization_id = 1
WHERE organization_id IS NULL;

UPDATE public.bookings
SET organization_id = 1
WHERE organization_id IS NULL;

-- Step 4: Make organization_id NOT NULL now that all rows have values
ALTER TABLE public.sides
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.bookings
ALTER COLUMN organization_id SET NOT NULL;

-- Step 5: Update unique constraint on sides.key to be per-organization
-- Drop the old unique constraint on key (find it dynamically)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the unique constraint on the key column
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.sides'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND (
        SELECT attname
        FROM pg_attribute
        WHERE attrelid = conrelid
          AND attnum = conkey[1]
      ) = 'key';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.sides DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Add new unique constraint on (organization_id, key)
ALTER TABLE public.sides
ADD CONSTRAINT sides_organization_id_key_unique UNIQUE (organization_id, key);

-- Step 6: Add indexes on organization_id for performance
CREATE INDEX IF NOT EXISTS idx_sides_organization_id ON public.sides(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_organization_id ON public.bookings(organization_id);

-- Add comments for documentation
COMMENT ON COLUMN public.sides.organization_id IS 'Organization that owns this side. Scoped per org for multi-tenancy.';
COMMENT ON COLUMN public.bookings.organization_id IS 'Organization that owns this booking. Foundation layer - no isolation logic yet.';
