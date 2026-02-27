-- Power open platforms: Platform 1 & 2 are bookable as platform numbers 19 and 20.
-- No schema change: booking_instances.racks and capacity_schedules.platforms already
-- store integer arrays. This documents valid Power side platform numbers for app use.
-- Power: 1-18 = racks, 19 = Platform 1 (open), 20 = Platform 2 (open). Base: 1-24.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'booking_instances' AND column_name = 'racks'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.booking_instances.racks IS ''Platform/rack numbers. Power: 1-18 racks, 19=Platform 1 (open), 20=Platform 2 (open). Base: 1-24.''';
  END IF;
END $$;
