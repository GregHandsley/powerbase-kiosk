-- Migration: Booking catalogue MVP
-- Adds booking families/squads and structured booking reference fields.

CREATE TABLE IF NOT EXISTS public.booking_families (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_squads (
  id bigserial PRIMARY KEY,
  family_id bigint NOT NULL REFERENCES public.booking_families(id) ON DELETE CASCADE,
  organization_id bigint NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_families_org_active_idx
  ON public.booking_families (organization_id, active, sort_order, name);

CREATE INDEX IF NOT EXISTS booking_squads_org_active_idx
  ON public.booking_squads (organization_id, active, sort_order, name);

CREATE INDEX IF NOT EXISTS booking_squads_family_idx
  ON public.booking_squads (family_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_families_org_name_unique'
      AND conrelid = 'public.booking_families'::regclass
  ) THEN
    ALTER TABLE public.booking_families
      ADD CONSTRAINT booking_families_org_name_unique
      UNIQUE (organization_id, name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_squads_family_name_unique'
      AND conrelid = 'public.booking_squads'::regclass
  ) THEN
    ALTER TABLE public.booking_squads
      ADD CONSTRAINT booking_squads_family_name_unique
      UNIQUE (family_id, name);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_type text NOT NULL DEFAULT 'one_off',
  ADD COLUMN IF NOT EXISTS squad_id bigint REFERENCES public.booking_squads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_booking_type_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_booking_type_check
      CHECK (booking_type IN ('catalogue', 'one_off'));
  END IF;
END $$;

UPDATE public.bookings
SET
  display_name = COALESCE(display_name, title),
  booking_type = CASE
    WHEN booking_type IN ('catalogue', 'one_off') THEN booking_type
    ELSE 'one_off'
  END
WHERE display_name IS NULL OR booking_type NOT IN ('catalogue', 'one_off');

-- Enable RLS for new catalogue tables.
ALTER TABLE public.booking_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_squads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_families'
      AND policyname = 'booking_families_select_org'
  ) THEN
    CREATE POLICY booking_families_select_org
      ON public.booking_families
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.organization_id = booking_families.organization_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_families'
      AND policyname = 'booking_families_manage_admin'
  ) THEN
    CREATE POLICY booking_families_manage_admin
      ON public.booking_families
      FOR ALL
      TO authenticated
      USING (public.is_org_admin(organization_id))
      WITH CHECK (public.is_org_admin(organization_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_squads'
      AND policyname = 'booking_squads_select_org'
  ) THEN
    CREATE POLICY booking_squads_select_org
      ON public.booking_squads
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.organization_id = booking_squads.organization_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_squads'
      AND policyname = 'booking_squads_manage_admin'
  ) THEN
    CREATE POLICY booking_squads_manage_admin
      ON public.booking_squads
      FOR ALL
      TO authenticated
      USING (public.is_org_admin(organization_id))
      WITH CHECK (public.is_org_admin(organization_id));
  END IF;
END $$;

COMMENT ON TABLE public.booking_families IS
  'Controlled booking name families for standardized squad selection.';

COMMENT ON TABLE public.booking_squads IS
  'Controlled squads for booking creation; supports logos/branding.';

COMMENT ON COLUMN public.bookings.booking_type IS
  'Booking naming source: catalogue or one_off.';

COMMENT ON COLUMN public.bookings.squad_id IS
  'Optional structured squad reference used for standardized naming.';

COMMENT ON COLUMN public.bookings.display_name IS
  'Display snapshot of booking name at creation/edit time for historical consistency.';
