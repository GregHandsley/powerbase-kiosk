-- Remove email service configuration from notification_settings table
-- Email configuration should be in environment variables, not database

-- Remove email service configuration columns
ALTER TABLE public.notification_settings
DROP COLUMN IF EXISTS email_service_provider,
DROP COLUMN IF EXISTS email_from_name,
DROP COLUMN IF EXISTS email_from_address,
DROP COLUMN IF EXISTS email_api_key_encrypted;

COMMENT ON TABLE public.notification_settings IS 'Admin-configured notification and email settings (email service config is in environment variables)';

