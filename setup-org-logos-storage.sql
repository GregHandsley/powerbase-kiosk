-- Setup Supabase Storage for Organization Logos
-- Run these commands in Supabase SQL Editor to create the storage bucket

-- Step 1: Create bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: ENABLE RLS ON BUCKET VIA DASHBOARD (don't run this SQL)
-- Go to: Supabase Dashboard → Storage → org-logos bucket → Policies
-- Enable RLS there, or run this SQL as service role if you have access:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Harden the permission check function
CREATE OR REPLACE FUNCTION public.can_manage_org_branding(
  p_organization_id bigint,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND is_super_admin = true
  );
END;
$$;

COMMENT ON FUNCTION public.can_manage_org_branding(bigint, uuid) IS
  'Checks if a user can manage branding for a specific organization. SECURITY DEFINER.';

-- Optional: limit who can call it directly
REVOKE ALL ON FUNCTION public.can_manage_org_branding(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_org_branding(bigint, uuid) TO authenticated;

-- Common guard: folder must be org-<bigint> and filename must be logo.<ext>
-- INSERT (upload)
DROP POLICY IF EXISTS "Org admins can upload org logos" ON storage.objects;
CREATE POLICY "Org admins can upload org logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] ~ '^org-[0-9]+$'
  AND name ~ '^org-[0-9]+/logo\.(png|jpg|jpeg|webp|svg)$'
  AND public.can_manage_org_branding(
    replace((storage.foldername(name))[1], 'org-', '')::bigint,
    auth.uid()
  )
);

-- UPDATE (overwrite / metadata changes)
DROP POLICY IF EXISTS "Org admins can update org logos" ON storage.objects;
CREATE POLICY "Org admins can update org logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] ~ '^org-[0-9]+$'
  AND name ~ '^org-[0-9]+/logo\.(png|jpg|jpeg|webp|svg)$'
  AND public.can_manage_org_branding(
    replace((storage.foldername(name))[1], 'org-', '')::bigint,
    auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] ~ '^org-[0-9]+$'
  AND name ~ '^org-[0-9]+/logo\.(png|jpg|jpeg|webp|svg)$'
  AND public.can_manage_org_branding(
    replace((storage.foldername(name))[1], 'org-', '')::bigint,
    auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "Org admins can delete org logos" ON storage.objects;
CREATE POLICY "Org admins can delete org logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] ~ '^org-[0-9]+$'
  AND name ~ '^org-[0-9]+/logo\.(png|jpg|jpeg|webp|svg)$'
  AND public.can_manage_org_branding(
    replace((storage.foldername(name))[1], 'org-', '')::bigint,
    auth.uid()
  )
);

-- Public read (logos are public assets)
DROP POLICY IF EXISTS "Public can view organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view org logos" ON storage.objects;
CREATE POLICY "Public can view organization logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'org-logos');