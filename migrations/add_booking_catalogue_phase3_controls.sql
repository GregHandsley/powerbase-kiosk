-- Migration: Booking catalogue phase 3 controls + metadata
-- Adds policy-driven one-off controls and one-off reason capture.

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS one_off_allowed_roles text[] NOT NULL DEFAULT ARRAY[
    'admin',
    'bookings_team',
    'coach',
    'snc_coach',
    'fitness_coach',
    'customer_service_assistant',
    'duty_manager',
    'facility_manager'
  ];

COMMENT ON COLUMN public.notification_settings.one_off_allowed_roles IS
  'Organization policy: roles allowed to create one-off bookings.';
