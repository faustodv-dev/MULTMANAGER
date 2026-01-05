-- Update RLS policy for tasks to allow all authenticated users to insert tasks
DROP POLICY IF EXISTS "Managers and admins can insert tasks" ON public.tasks;

CREATE POLICY "All authenticated users can insert tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (true);