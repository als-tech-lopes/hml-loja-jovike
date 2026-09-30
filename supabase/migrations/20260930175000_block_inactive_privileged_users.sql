-- Inactive accounts must not retain administrative access through an
-- already-issued JWT. Keep has_role() unchanged because it is also used to
-- inspect the role of target users in hierarchy checks.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS role
    JOIN public.profiles AS profile ON profile.user_id = role.user_id
    WHERE role.user_id = auth.uid()
      AND role.role IN ('admin', 'super_admin')
      AND profile.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS role
    JOIN public.profiles AS profile ON profile.user_id = role.user_id
    WHERE role.user_id = _user_id
      AND role.role = 'super_admin'
      AND profile.is_active
  )
$$;
