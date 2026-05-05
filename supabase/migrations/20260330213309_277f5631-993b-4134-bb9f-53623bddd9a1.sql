
-- Create tenant_billing table (singleton pattern for single-tenant)
CREATE TABLE public.tenant_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type text NOT NULL DEFAULT 'basic',
  due_date date,
  payment_status text NOT NULL DEFAULT 'active',
  pix_key text NOT NULL DEFAULT '',
  monthly_value numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_billing ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage billing"
ON public.tenant_billing
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admins can view billing (read-only)
CREATE POLICY "Admins can view billing"
ON public.tenant_billing
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.tenant_billing (plan_type, payment_status, pix_key) VALUES ('basic', 'active', '');

-- Create trigger for updated_at
CREATE TRIGGER update_tenant_billing_updated_at
  BEFORE UPDATE ON public.tenant_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
