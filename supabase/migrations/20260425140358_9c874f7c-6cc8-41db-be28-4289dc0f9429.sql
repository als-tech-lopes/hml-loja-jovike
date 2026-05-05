-- Nova tabela isolada para armazenar a porcentagem de comissão por vendedor
-- Não altera nenhuma tabela existente
CREATE TABLE IF NOT EXISTS public.seller_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  commission_percent numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view seller commissions"
  ON public.seller_commissions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert seller commissions"
  ON public.seller_commissions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update seller commissions"
  ON public.seller_commissions FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete seller commissions"
  ON public.seller_commissions FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_seller_commissions_updated_at
  BEFORE UPDATE ON public.seller_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona o módulo "Comissões" no registro central de plan_features
INSERT INTO public.plan_features (module_key, module_label, enabled)
VALUES ('commissions', 'Comissão de Vendedores', true)
ON CONFLICT DO NOTHING;