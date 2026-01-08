-- Drop the old policy that still causes recursion
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.profiles;