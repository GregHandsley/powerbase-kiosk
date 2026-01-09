-- Create notifications table for in-app notifications
-- This table stores notifications for users about various events

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'last_minute_change', 'booking:created', 'booking:processed', etc.
  title TEXT NOT NULL,
  message TEXT,
  link TEXT, -- Optional link to relevant page (e.g., '/bookings-team?id=123')
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB -- Additional data (e.g., booking_id, booking_title, etc.)
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Create index on read_at for filtering unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at) WHERE read_at IS NULL;

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Create index on type for filtering by notification type
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "users_can_read_own_notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_can_update_own_notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can insert notifications for any user (via service role or function)
-- For now, we'll allow authenticated users to insert (will be restricted by application logic)
-- In production, you might want to use a service role or database function
CREATE POLICY "authenticated_can_insert_notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Users can delete their own notifications
CREATE POLICY "users_can_delete_own_notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE public.notifications IS 'In-app notifications for users';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification: last_minute_change, booking:created, booking:processed, etc.';
COMMENT ON COLUMN public.notifications.metadata IS 'Additional JSON data (e.g., booking_id, booking_title, changed_by, etc.)';

-- Enable realtime for notifications table
-- This allows real-time updates when notifications are created/updated/deleted
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

