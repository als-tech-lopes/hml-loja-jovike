CREATE TABLE IF NOT EXISTS public.offline_catalog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_products integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offline_catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  selected_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

ALTER TABLE public.offline_catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view offline catalog settings"
ON public.offline_catalog_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Super admin can manage offline catalog settings"
ON public.offline_catalog_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Admins can view offline catalog products"
ON public.offline_catalog_products
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage offline catalog products"
ON public.offline_catalog_products
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.validate_offline_catalog_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_limit integer;
  current_count integer;
BEGIN
  SELECT max_products
    INTO current_limit
  FROM public.offline_catalog_settings
  ORDER BY created_at ASC
  LIMIT 1;

  IF current_limit IS NULL THEN
    current_limit := 10;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO current_count FROM public.offline_catalog_products;
  ELSE
    SELECT COUNT(*) INTO current_count
    FROM public.offline_catalog_products
    WHERE id <> NEW.id;
  END IF;

  IF current_count >= current_limit THEN
    RAISE EXCEPTION 'Limite máximo de produtos do Catálogo Offline atingido.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_offline_catalog_limit_trigger ON public.offline_catalog_products;
CREATE TRIGGER validate_offline_catalog_limit_trigger
BEFORE INSERT OR UPDATE OF product_id ON public.offline_catalog_products
FOR EACH ROW
EXECUTE FUNCTION public.validate_offline_catalog_limit();

DROP TRIGGER IF EXISTS update_offline_catalog_settings_updated_at ON public.offline_catalog_settings;
CREATE TRIGGER update_offline_catalog_settings_updated_at
BEFORE UPDATE ON public.offline_catalog_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.offline_catalog_settings (max_products)
SELECT 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.offline_catalog_settings
);

CREATE INDEX IF NOT EXISTS idx_offline_catalog_products_product_id
ON public.offline_catalog_products (product_id);