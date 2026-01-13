-- Fix leads table RLS: Restrict SELECT access to assigned users, admins, and managers
-- This addresses the PUBLIC_DATA_EXPOSURE security issue

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;

-- Create role-based access policy for viewing leads
-- Users can only see leads assigned to them, their department's leads, or if they are admin/manager
CREATE POLICY "Users can view assigned or department leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  department_id IN (
    SELECT department_id FROM profiles WHERE id = auth.uid()
  )
);