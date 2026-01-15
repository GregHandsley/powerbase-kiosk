-- Organizations Table
-- This migration creates the organizations table as a foundation for multi-tenancy
-- No RLS yet - this is Layer 1: Foundations (No UI, Low Risk)

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- Seed a default organization for existing users
-- This ensures existing data has an organization to belong to
INSERT INTO public.organizations (id, name, slug, settings)
VALUES (1, 'Default Organization', 'default', '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.organizations IS 'Organizations table for multi-tenancy support. Foundation layer - no RLS or UI yet.';
