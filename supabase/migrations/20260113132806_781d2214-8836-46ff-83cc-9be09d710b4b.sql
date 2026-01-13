-- Fix task RLS policies to address MISSING_RLS and PUBLIC_DATA_EXPOSURE issues

-- Drop overly permissive INSERT policy
DROP POLICY IF EXISTS "All authenticated users can insert tasks" ON public.tasks;

-- Create restricted INSERT policy: employees can only create tasks for themselves or unassigned
-- Managers and admins can assign to anyone
CREATE POLICY "Users can create limited tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  -- Managers/admins can assign to anyone
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  -- Regular users can only create tasks for themselves or unassigned
  (assignee_id = auth.uid() OR assignee_id IS NULL)
);

-- Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;

-- Create restricted SELECT policy: users can only see their tasks, department tasks, or if admin/manager
CREATE POLICY "Users can view relevant tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  -- Users can see their assigned tasks
  assignee_id = auth.uid() OR
  -- Admins and managers can see all tasks
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  -- Users can see tasks in their department
  department_id IN (
    SELECT department_id FROM profiles WHERE id = auth.uid()
  )
);

-- Update handle_new_user function to add input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  safe_full_name TEXT;
BEGIN
  -- Validate and sanitize full_name (max 200 chars, default to 'User' if empty)
  safe_full_name := COALESCE(
    NULLIF(TRIM(SUBSTRING(new.raw_user_meta_data ->> 'full_name', 1, 200)), ''),
    'User'
  );
  
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, safe_full_name, new.raw_user_meta_data ->> 'avatar_url');
  
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  -- First user gets admin role, others get employee
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'employee');
  END IF;
  
  RETURN new;
END;
$$;