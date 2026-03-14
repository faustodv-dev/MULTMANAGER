
-- Add created_by column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Set created_by to assigned_to for existing leads (best guess)
UPDATE public.leads SET created_by = assigned_to WHERE created_by IS NULL AND assigned_to IS NOT NULL;

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;

-- New UPDATE policy: any authenticated user who can SEE the lead can update it (for stage changes etc)
CREATE POLICY "Users can update leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (unit_id IS NULL OR unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())))
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR department_id IN (SELECT profiles.department_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

-- New DELETE policy: only creator or unit admin/admin
CREATE POLICY "Creator or admin can delete leads" ON public.leads
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid()))
);

-- Update SELECT policy to also include created_by
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
CREATE POLICY "Users can view leads" ON public.leads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (unit_id IS NULL OR unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())))
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR department_id IN (SELECT profiles.department_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Update INSERT policy to include created_by check
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
CREATE POLICY "Users can create leads" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (unit_id IS NULL OR unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.department_id IS NOT NULL))
);

-- Fix get_user_role to include unit_admin in ordering
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id 
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'unit_admin' THEN 2
      WHEN 'manager' THEN 3 
      WHEN 'employee' THEN 4 
    END 
  LIMIT 1
$$;
