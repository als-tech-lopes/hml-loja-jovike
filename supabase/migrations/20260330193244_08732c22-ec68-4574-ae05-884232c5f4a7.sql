-- Add is_active column to profiles for user activation/deactivation
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Drop the existing insert policy that's too restrictive
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Allow system and admins to insert profiles
CREATE POLICY "System or admin can insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (is_admin());

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (is_admin());

-- Allow admins to delete module_permissions
CREATE POLICY "Admins can delete permissions" ON public.module_permissions FOR DELETE USING (is_admin());