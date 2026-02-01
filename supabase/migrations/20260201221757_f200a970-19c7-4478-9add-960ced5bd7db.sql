-- Drop existing INSERT policy for tasks
DROP POLICY IF EXISTS "Users can create limited tasks" ON public.tasks;

-- Create new INSERT policy that includes unit_admin
-- Unit admins can create tasks for users in their own unit
CREATE POLICY "Users can create tasks" 
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  -- Global admins and managers can create any task
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  -- Unit admins can create tasks for their unit
  (
    has_role(auth.uid(), 'unit_admin'::app_role) AND 
    (
      unit_id IS NULL OR 
      unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    )
  ) OR
  -- Regular users can only create tasks for themselves or unassigned
  ((assignee_id = auth.uid()) OR (assignee_id IS NULL))
);

-- Also update the UPDATE policy to include unit_admin
DROP POLICY IF EXISTS "Users can update assigned tasks" ON public.tasks;

CREATE POLICY "Users can update assigned tasks" 
ON public.tasks FOR UPDATE
TO authenticated
USING (
  (assignee_id = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  (
    has_role(auth.uid(), 'unit_admin'::app_role) AND 
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
  )
);

-- Update DELETE policy to include unit_admin for their unit's tasks
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;

CREATE POLICY "Admins and unit admins can delete tasks" 
ON public.tasks FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (
    has_role(auth.uid(), 'unit_admin'::app_role) AND 
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
  )
);

-- Update SELECT policy to include unit_admin
DROP POLICY IF EXISTS "Users can view relevant tasks" ON public.tasks;

CREATE POLICY "Users can view relevant tasks" 
ON public.tasks FOR SELECT
TO authenticated
USING (
  (assignee_id = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  (
    has_role(auth.uid(), 'unit_admin'::app_role) AND 
    (unit_id IS NULL OR unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid()))
  ) OR
  (department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid()))
);