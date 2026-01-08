-- Fix overly permissive RLS policies for leads

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;

-- Create a more restrictive INSERT policy (only admins, managers, or commercial dept can create leads)
CREATE POLICY "Users can create leads"
ON public.leads FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND department_id IS NOT NULL
  )
);

-- Drop the overly permissive INSERT policy for lead_activities
DROP POLICY IF EXISTS "Authenticated users can create activities" ON public.lead_activities;

-- Create more restrictive INSERT policy for lead_activities
CREATE POLICY "Users can create activities on accessible leads"
ON public.lead_activities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = lead_id 
    AND (
      assigned_to = auth.uid() OR 
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'manager')
    )
  )
);