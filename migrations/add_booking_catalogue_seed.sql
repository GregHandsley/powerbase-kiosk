-- Seed: Booking catalogue starter data
-- Safe to re-run (idempotent).
--
-- HOW TO USE
-- 1) Optionally set v_org_slug below to target a specific organization.
-- 2) Run this file after migrations/add_booking_catalogue_tables.sql.
--
-- If v_org_slug is NULL, the script seeds the first organization by id.

DO $$
DECLARE
  v_org_slug text := NULL; -- e.g. 'loughborough-sport'
  v_org_id bigint;
  v_family_lboro_id bigint;
  v_family_performance_id bigint;
BEGIN
  -- Resolve organization
  IF v_org_slug IS NOT NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE slug = v_org_slug
    LIMIT 1;
  ELSE
    SELECT id INTO v_org_id
    FROM public.organizations
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create an organization before seeding booking catalogue.';
  END IF;

  -- Families
  INSERT INTO public.booking_families (
    organization_id,
    name,
    active,
    sort_order
  )
  VALUES
    (v_org_id, 'Loughborough Sport', true, 10),
    (v_org_id, 'Performance', true, 20),
    (v_org_id, 'One-off / External', true, 30)
  ON CONFLICT (organization_id, name)
  DO UPDATE SET
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  SELECT id INTO v_family_lboro_id
  FROM public.booking_families
  WHERE organization_id = v_org_id
    AND name = 'Loughborough Sport'
  LIMIT 1;

  SELECT id INTO v_family_performance_id
  FROM public.booking_families
  WHERE organization_id = v_org_id
    AND name = 'Performance'
  LIMIT 1;

  -- Squads under Loughborough Sport
  INSERT INTO public.booking_squads (
    family_id,
    organization_id,
    name,
    logo_url,
    active,
    sort_order
  )
  VALUES
    (v_family_lboro_id, v_org_id, 'Loughborough Sport - General Session', NULL, true, 10),
    (v_family_lboro_id, v_org_id, 'Loughborough Sport - Student Club', NULL, true, 20)
  ON CONFLICT (family_id, name)
  DO UPDATE SET
    logo_url = EXCLUDED.logo_url,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  -- Squads under Performance
  INSERT INTO public.booking_squads (
    family_id,
    organization_id,
    name,
    logo_url,
    active,
    sort_order
  )
  VALUES
    (v_family_performance_id, v_org_id, 'Performance - Rugby Union', NULL, true, 10),
    (v_family_performance_id, v_org_id, 'Performance - Football', NULL, true, 20),
    (v_family_performance_id, v_org_id, 'Performance - Cricket', NULL, true, 30)
  ON CONFLICT (family_id, name)
  DO UPDATE SET
    logo_url = EXCLUDED.logo_url,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  RAISE NOTICE 'Booking catalogue seed complete for organization_id=%', v_org_id;
END $$;
