-- Rename notifications table to tasks
-- This converts the notification system into a tasks widget

-- Rename the table
ALTER TABLE IF EXISTS public.notifications RENAME TO tasks;

-- Rename indexes
ALTER INDEX IF EXISTS idx_notifications_user_id RENAME TO idx_tasks_user_id;
ALTER INDEX IF EXISTS idx_notifications_read_at RENAME TO idx_tasks_read_at;
ALTER INDEX IF EXISTS idx_notifications_created_at RENAME TO idx_tasks_created_at;
ALTER INDEX IF EXISTS idx_notifications_type RENAME TO idx_tasks_type;

-- Update RLS policies
DROP POLICY IF EXISTS "users_can_read_own_notifications" ON public.tasks;
DROP POLICY IF EXISTS "users_can_update_own_notifications" ON public.tasks;
DROP POLICY IF EXISTS "authenticated_can_insert_notifications" ON public.tasks;
DROP POLICY IF EXISTS "users_can_delete_own_notifications" ON public.tasks;

-- Create new policies with task naming
CREATE POLICY "users_can_read_own_tasks"
ON public.tasks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_tasks"
ON public.tasks
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_can_insert_tasks"
ON public.tasks
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "users_can_delete_own_tasks"
ON public.tasks
FOR DELETE
USING (auth.uid() = user_id);

-- Update comments
COMMENT ON TABLE public.tasks IS 'Task list for users - bookings that need processing or attention';
COMMENT ON COLUMN public.tasks.type IS 'Type of task: last_minute_change, booking:created, booking:processed, etc.';
COMMENT ON COLUMN public.tasks.metadata IS 'Additional JSON data (e.g., booking_id, booking_title, changed_by, etc.)';

-- Update realtime publication
-- Note: DROP TABLE from publication doesn't support IF EXISTS, so we'll use a DO block
DO $$
BEGIN
  -- Try to remove notifications table from publication (ignore error if it doesn't exist)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN
    -- Table might not be in publication, which is fine
    NULL;
  END;
  
  -- Add tasks table to publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  EXCEPTION WHEN OTHERS THEN
    -- Table might already be in publication, which is fine
    NULL;
  END;
END $$;

