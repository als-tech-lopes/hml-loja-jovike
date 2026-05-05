
CREATE TABLE public.plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  plan_label text NOT NULL DEFAULT '',
  monthly_value numeric NOT NULL DEFAULT 0,
  due_day integer DEFAULT 5,
  pix_key text NOT NULL DEFAULT '',
  max_users integer NOT NULL DEFAULT 2,
  default_status text NOT NULL DEFAULT 'active',
  modules jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view plan templates" ON public.plan_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage plan templates" ON public.plan_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_plan_templates_updated_at
  BEFORE UPDATE ON public.plan_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.plan_templates (plan_key, plan_label, monthly_value, due_day, max_users, modules) VALUES
  ('basic', 'Plano Básico', 99.90, 5, 2, '{"products":true,"movements":true,"sales":true,"reports":false,"catalog":true,"export_excel":false,"users":true}'),
  ('professional', 'Plano Profissional', 199.90, 5, 5, '{"products":true,"movements":true,"sales":true,"reports":true,"catalog":true,"export_excel":true,"users":true}'),
  ('premium', 'Plano Premium', 349.90, 5, 10, '{"products":true,"movements":true,"sales":true,"reports":true,"catalog":true,"export_excel":true,"users":true}');
