-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Profiles are viewable by same department members, managers and admins" ON public.profiles;

-- Create simplified policy that doesn't cause recursion
-- All authenticated users can view all profiles (needed for assignee selection, etc.)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);