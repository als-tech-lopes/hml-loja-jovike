-- Prevent regular administrators from changing or deleting Super Admin profiles.

DROP POLICY IF EXISTS "System or admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update non privileged profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  )
  WITH CHECK (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  );

CREATE POLICY "Admins can delete non privileged profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  );

CREATE POLICY "Reports permission can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_module_access('reports'));
