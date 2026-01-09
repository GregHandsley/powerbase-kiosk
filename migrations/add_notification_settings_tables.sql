-- Notification and Email Settings Tables
-- This migration creates tables for admin-configured notification settings and email preferences

-- Main notification settings table (single row, admin-configurable)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id BIGSERIAL PRIMARY KEY,
  
  -- Notification Window Configuration (not a hard cutoff, just triggers emails)
  notification_window_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_window_day_of_week INTEGER NOT NULL DEFAULT 4, -- 0=Sunday, 1=Monday, ..., 4=Thursday
  notification_window_time TIME NOT NULL DEFAULT '23:59:00',
  
  -- Hard Restriction (12-hour rule - prevents bookings within X hours of session)
  hard_restriction_enabled BOOLEAN NOT NULL DEFAULT true,
  hard_restriction_hours INTEGER NOT NULL DEFAULT 12,
  
  -- Last-Minute Alert Recipients (who gets emails when bookings/changes happen after notification window)
  last_minute_alert_roles TEXT[] DEFAULT ARRAY['admin', 'bookings_team'], -- Array of role names
  last_minute_alert_user_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Specific user IDs
  
  -- Regular Reminder Configuration
  reminder_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_schedule JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {time: "09:00", days: [1,2,3,4,5], frequency: "daily"|"weekly"}
  reminder_recipient_roles TEXT[] DEFAULT ARRAY['admin', 'bookings_team'],
  reminder_recipient_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Email Service Configuration
  email_service_provider TEXT NOT NULL DEFAULT 'resend', -- 'resend', 'sendgrid', 'ses'
  email_from_name TEXT NOT NULL DEFAULT 'Powerbase Kiosk',
  email_from_address TEXT NOT NULL DEFAULT 'noreply@powerbase.com',
  email_api_key_encrypted TEXT, -- Will be encrypted/stored securely (use Supabase Vault or similar)
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create single default settings row
INSERT INTO public.notification_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- User-level email preferences
CREATE TABLE IF NOT EXISTS public.email_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Last-minute alerts (when user makes booking/change after notification window)
  receive_last_minute_alerts BOOLEAN NOT NULL DEFAULT true,
  
  -- Regular reminders
  receive_reminder_emails BOOLEAN NOT NULL DEFAULT true,
  reminder_frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'never'
  
  -- User confirmation emails (when they make last-minute booking/change)
  receive_confirmation_emails BOOLEAN NOT NULL DEFAULT true,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email queue for async processing (optional, if needed)
CREATE TABLE IF NOT EXISTS public.email_queue (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_user_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL, -- 'last_minute_alert', 'reminder', 'confirmation'
  template_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email sent log for tracking
CREATE TABLE IF NOT EXISTS public.email_sent_log (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_user_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_sent_log_sent_at ON public.email_sent_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sent_log_user_id ON public.email_sent_log(to_user_id);

-- RLS Policies
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sent_log ENABLE ROW LEVEL SECURITY;

-- Notification settings: Only admins can read/write
CREATE POLICY "admins_can_manage_notification_settings"
ON public.notification_settings
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Email preferences: Users can manage their own
CREATE POLICY "users_can_manage_own_email_preferences"
ON public.email_notification_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Email queue: System can insert, admins can read
CREATE POLICY "authenticated_can_insert_email_queue"
ON public.email_queue
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "admins_can_read_email_queue"
ON public.email_queue
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Email log: Admins can read
CREATE POLICY "admins_can_read_email_log"
ON public.email_sent_log
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.notification_settings IS 'Admin-configured notification and email settings (single row)';
COMMENT ON TABLE public.email_notification_preferences IS 'User-level email notification preferences';
COMMENT ON TABLE public.email_queue IS 'Queue for async email processing';
COMMENT ON TABLE public.email_sent_log IS 'Log of sent emails for tracking and debugging';

