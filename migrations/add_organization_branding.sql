-- Migration: Add organization branding configuration
-- Adds branding settings to organizations.settings JSONB field

-- 1) Set branding defaults for orgs that have no branding yet
UPDATE public.organizations
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'branding', jsonb_build_object(
    'primary_color', '#361163',     -- African Violet
    'secondary_color', '#B70062',   -- Mulberry
    'accent_color', '#E4002B',      -- Mercia Red
    'background_color', '#CBCECE',  -- Fountain Grey
    'text_color', '#525E66',        -- Asphalt
    'logo_url', NULL                -- No default logo
  )
)
WHERE NOT (COALESCE(settings, '{}'::jsonb) ? 'branding');

-- 2) Validate branding colors
CREATE OR REPLACE FUNCTION public.validate_branding_colors(p_branding jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Required fields must exist and be strings
  IF NOT (
    p_branding ? 'primary_color'
    AND jsonb_typeof(p_branding->'primary_color') = 'string'
    AND p_branding ? 'secondary_color'
    AND jsonb_typeof(p_branding->'secondary_color') = 'string'
  ) THEN
    RETURN false;
  END IF;

  -- Helper regex (3, 6, or 8 digit hex)
  IF NOT (
    (p_branding->>'primary_color') ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$'
    AND
    (p_branding->>'secondary_color') ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$'
  ) THEN
    RETURN false;
  END IF;

  -- Optional fields: if present, must be strings and valid hex
  IF p_branding ? 'accent_color' THEN
    IF jsonb_typeof(p_branding->'accent_color') <> 'string'
       OR NOT ((p_branding->>'accent_color') ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$')
    THEN
      RETURN false;
    END IF;
  END IF;

  IF p_branding ? 'background_color' THEN
    IF jsonb_typeof(p_branding->'background_color') <> 'string'
       OR NOT ((p_branding->>'background_color') ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$')
    THEN
      RETURN false;
    END IF;
  END IF;

  IF p_branding ? 'text_color' THEN
    IF jsonb_typeof(p_branding->'text_color') <> 'string'
       OR NOT ((p_branding->>'text_color') ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$')
    THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.validate_branding_colors(jsonb) IS
  'Validates that branding colors are in proper hex format. Returns true if valid.';

-- 3) Return branding with defaults merged (always complete)
CREATE OR REPLACE FUNCTION public.get_organization_branding(p_organization_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_defaults jsonb := jsonb_build_object(
    'primary_color', '#361163',
    'secondary_color', '#B70062',
    'accent_color', '#E4002B',
    'background_color', '#CBCECE',
    'text_color', '#525E66',
    'logo_url', NULL
  );
  v_branding jsonb;
BEGIN
  SELECT COALESCE(settings->'branding', '{}'::jsonb)
  INTO v_branding
  FROM public.organizations
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RETURN v_defaults;
  END IF;

  -- Merge: defaults first, org overrides win
  RETURN v_defaults || v_branding;
END;
$$;

COMMENT ON FUNCTION public.get_organization_branding(bigint) IS
  'Returns branding configuration for an organization, merged with defaults as fallback.';

-- 4) Add DB-level validation (optional but recommended for data integrity)
-- This ensures branding data is always valid at the database level
-- Note: Only add this if you want strict validation; otherwise rely on API validation
-- ALTER TABLE public.organizations
-- ADD CONSTRAINT organizations_branding_valid
-- CHECK (
--   NOT (COALESCE(settings, '{}'::jsonb) ? 'branding') OR
--   public.validate_branding_colors(COALESCE(settings, '{}'::jsonb)->'branding')
-- );