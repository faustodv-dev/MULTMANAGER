-- Fix 1: Restrict profile visibility to department members, managers, and admins
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view relevant profiles" ON public.profiles
  FOR SELECT TO authenticated 
  USING (
    auth.uid() = id OR 
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    department_id IN (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Fix 2: Remove overly permissive notification policy and restrict to task-related notifications
DROP POLICY IF EXISTS "Anyone can insert notifications for assigned tasks" ON public.notifications;

-- Create secure function for notification creation with validation
CREATE OR REPLACE FUNCTION public.create_task_notification(
  _task_id UUID,
  _assignee_id UUID,
  _title TEXT,
  _message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Validate: caller must be admin, manager, or the task assignee
  IF NOT (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR
    EXISTS (SELECT 1 FROM tasks WHERE id = _task_id AND assignee_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized to create notification for this task';
  END IF;
  
  -- Validate input lengths to prevent abuse
  IF length(_title) > 200 THEN
    RAISE EXCEPTION 'Notification title too long (max 200 chars)';
  END IF;
  
  IF _message IS NOT NULL AND length(_message) > 1000 THEN
    RAISE EXCEPTION 'Notification message too long (max 1000 chars)';
  END IF;
  
  INSERT INTO notifications (user_id, task_id, title, message)
  VALUES (_assignee_id, _task_id, _title, _message)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;