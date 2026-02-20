-- Migration: Booking squad logo storage bucket
-- Creates a dedicated Supabase Storage bucket and RLS policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-logos',
  'booking-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read access for authenticated users in org paths they belong to.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'booking_logos_select_org_member'
  ) THEN
    CREATE POLICY booking_logos_select_org_member
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'booking-logos'
        AND EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.user_id = auth.uid()
            AND split_part(name, '/', 1) = ('org-' || om.organization_id::text)
        )
      );
  END IF;
END $$;

-- Write/update/delete access for org admins in their org paths.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'booking_logos_insert_org_admin'
  ) THEN
    CREATE POLICY booking_logos_insert_org_admin
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'booking-logos'
        AND EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.user_id = auth.uid()
            AND om.role = 'admin'::public.org_role
            AND split_part(name, '/', 1) = ('org-' || om.organization_id::text)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'booking_logos_update_org_admin'
  ) THEN
    CREATE POLICY booking_logos_update_org_admin
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'booking-logos'
        AND EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.user_id = auth.uid()
            AND om.role = 'admin'::public.org_role
            AND split_part(name, '/', 1) = ('org-' || om.organization_id::text)
        )
      )
      WITH CHECK (
        bucket_id = 'booking-logos'
        AND EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.user_id = auth.uid()
            AND om.role = 'admin'::public.org_role
            AND split_part(name, '/', 1) = ('org-' || om.organization_id::text)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'booking_logos_delete_org_admin'
  ) THEN
    CREATE POLICY booking_logos_delete_org_admin
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'booking-logos'
        AND EXISTS (
          SELECT 1
          FROM public.organization_memberships om
          WHERE om.user_id = auth.uid()
            AND om.role = 'admin'::public.org_role
            AND split_part(name, '/', 1) = ('org-' || om.organization_id::text)
        )
      );
  END IF;
END $$;
