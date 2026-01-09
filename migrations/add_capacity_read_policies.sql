-- Add RLS policies for capacity-related tables
-- All authenticated users (coaches and admins) can READ capacity data
-- Only admins can WRITE/UPDATE/DELETE capacity data

-- Enable RLS on capacity_schedules if not already enabled
ALTER TABLE public.capacity_schedules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read capacity schedules
DROP POLICY IF EXISTS "all_users_can_read_capacity_schedules" ON public.capacity_schedules;
CREATE POLICY "all_users_can_read_capacity_schedules"
ON public.capacity_schedules
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only admins can insert capacity schedules
DROP POLICY IF EXISTS "admin_can_insert_capacity_schedules" ON public.capacity_schedules;
CREATE POLICY "admin_can_insert_capacity_schedules"
ON public.capacity_schedules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can update capacity schedules
DROP POLICY IF EXISTS "admin_can_update_capacity_schedules" ON public.capacity_schedules;
CREATE POLICY "admin_can_update_capacity_schedules"
ON public.capacity_schedules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can delete capacity schedules
DROP POLICY IF EXISTS "admin_can_delete_capacity_schedules" ON public.capacity_schedules;
CREATE POLICY "admin_can_delete_capacity_schedules"
ON public.capacity_schedules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Enable RLS on period_type_capacity_defaults if not already enabled
ALTER TABLE public.period_type_capacity_defaults ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read period type defaults
DROP POLICY IF EXISTS "all_users_can_read_period_type_defaults" ON public.period_type_capacity_defaults;
CREATE POLICY "all_users_can_read_period_type_defaults"
ON public.period_type_capacity_defaults
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only admins can insert period type defaults
DROP POLICY IF EXISTS "admin_can_insert_period_type_defaults" ON public.period_type_capacity_defaults;
CREATE POLICY "admin_can_insert_period_type_defaults"
ON public.period_type_capacity_defaults
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can update period type defaults
DROP POLICY IF EXISTS "admin_can_update_period_type_defaults" ON public.period_type_capacity_defaults;
CREATE POLICY "admin_can_update_period_type_defaults"
ON public.period_type_capacity_defaults
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can delete period type defaults
DROP POLICY IF EXISTS "admin_can_delete_period_type_defaults" ON public.period_type_capacity_defaults;
CREATE POLICY "admin_can_delete_period_type_defaults"
ON public.period_type_capacity_defaults
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Enable RLS on period_type_capacity_overrides if the table exists
-- (This table might not exist in all setups, so we'll check)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'period_type_capacity_overrides') THEN
    ALTER TABLE public.period_type_capacity_overrides ENABLE ROW LEVEL SECURITY;

    -- Allow all authenticated users to read period type overrides
    DROP POLICY IF EXISTS "all_users_can_read_period_type_overrides" ON public.period_type_capacity_overrides;
    CREATE POLICY "all_users_can_read_period_type_overrides"
    ON public.period_type_capacity_overrides
    FOR SELECT
    USING (auth.role() = 'authenticated');

    -- Only admins can insert period type overrides
    DROP POLICY IF EXISTS "admin_can_insert_period_type_overrides" ON public.period_type_capacity_overrides;
    CREATE POLICY "admin_can_insert_period_type_overrides"
    ON public.period_type_capacity_overrides
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

    -- Only admins can update period type overrides
    DROP POLICY IF EXISTS "admin_can_update_period_type_overrides" ON public.period_type_capacity_overrides;
    CREATE POLICY "admin_can_update_period_type_overrides"
    ON public.period_type_capacity_overrides
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

    -- Only admins can delete period type overrides
    DROP POLICY IF EXISTS "admin_can_delete_period_type_overrides" ON public.period_type_capacity_overrides;
    CREATE POLICY "admin_can_delete_period_type_overrides"
    ON public.period_type_capacity_overrides
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
  END IF;
END $$;

COMMENT ON POLICY "all_users_can_read_capacity_schedules" ON public.capacity_schedules IS 'All authenticated users (coaches and admins) can read capacity schedules to see limits and available platforms';
COMMENT ON POLICY "all_users_can_read_period_type_defaults" ON public.period_type_capacity_defaults IS 'All authenticated users (coaches and admins) can read period type defaults to see capacity limits';

