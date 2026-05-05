
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  module_label text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read plan features
CREATE POLICY "Authenticated can view plan features"
ON public.plan_features FOR SELECT TO authenticated
USING (true);

-- Only super_admin can manage
CREATE POLICY "Super admin can manage plan features"
ON public.plan_features FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed default modules
INSERT INTO public.plan_features (module_key, module_label, enabled) VALUES
  ('dashboard', 'Dashboard', true),
  ('products', 'Produtos / Estoque', true),
  ('movements', 'Movimentações', true),
  ('sales', 'Vendas', true),
  ('reports', 'Relatórios', true),
  ('user_management', 'Cadastro de Usuários', true),
  ('data_export', 'Exportação de Dados', true);
