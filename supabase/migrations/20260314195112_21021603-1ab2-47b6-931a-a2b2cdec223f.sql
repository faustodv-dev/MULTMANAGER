
-- FIX LEADS RLS POLICIES
DROP POLICY IF EXISTS "Users can view assigned or department leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update assigned leads or admins/managers" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "Users can view leads" ON public.leads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (
    unit_id IS NULL OR unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())
  ))
  OR assigned_to = auth.uid()
  OR department_id IN (SELECT profiles.department_id FROM profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Users can create leads" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (
    unit_id IS NULL OR unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())
  ))
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.department_id IS NOT NULL)
);

CREATE POLICY "Users can update leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (
    unit_id IS NULL OR unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())
  ))
  OR assigned_to = auth.uid()
);

CREATE POLICY "Admins can delete leads" ON public.leads
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role) AND (
    unit_id = (SELECT profiles.unit_id FROM profiles WHERE profiles.id = auth.uid())
  ))
);

-- FIX LEAD_ACTIVITIES RLS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can create activities on accessible leads" ON public.lead_activities;

CREATE POLICY "Authenticated users can view activities" ON public.lead_activities
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can create activities" ON public.lead_activities
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activities.lead_id
    AND (
      leads.assigned_to = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'unit_admin'::app_role)
      OR leads.department_id IN (SELECT profiles.department_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
);
