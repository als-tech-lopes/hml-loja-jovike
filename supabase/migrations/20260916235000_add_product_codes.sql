BEGIN;

LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.sale_items IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.movements IN SHARE ROW EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS public.product_code_seq
  AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 20;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_code text;

CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'PRD-' || lpad(nextval('public.product_code_seq')::text, 8, '0')
$$;

ALTER TABLE public.products
  ALTER COLUMN product_code SET DEFAULT public.generate_product_code();

WITH missing AS (
  SELECT id, public.generate_product_code() AS generated_code
  FROM public.products
  WHERE product_code IS NULL
  ORDER BY created_at, id
)
UPDATE public.products AS p
SET product_code = missing.generated_code
FROM missing
WHERE p.id = missing.id;

ALTER TABLE public.products ALTER COLUMN product_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_uidx
  ON public.products (product_code);

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS product_code text;
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS product_code text;

UPDATE public.sale_items AS si
SET product_code = p.product_code
FROM public.products AS p
WHERE si.product_id = p.id AND si.product_code IS NULL;

UPDATE public.movements AS m
SET product_code = p.product_code
FROM public.products AS p
WHERE m.product_id = p.id AND m.product_code IS NULL;

ALTER TABLE public.sale_items ALTER COLUMN product_code SET NOT NULL;
ALTER TABLE public.movements ALTER COLUMN product_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS sale_items_product_code_idx
  ON public.sale_items (product_code);
CREATE INDEX IF NOT EXISTS movements_product_code_idx
  ON public.movements (product_code);

CREATE OR REPLACE FUNCTION public.set_product_code_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT p.product_code INTO NEW.product_code
  FROM public.products AS p
  WHERE p.id = NEW.product_id;

  IF NEW.product_code IS NULL THEN
    RAISE EXCEPTION 'Código não encontrado para o produto %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sale_item_product_code ON public.sale_items;
CREATE TRIGGER set_sale_item_product_code
  BEFORE INSERT OR UPDATE OF product_id ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code_snapshot();

DROP TRIGGER IF EXISTS set_movement_product_code ON public.movements;
CREATE TRIGGER set_movement_product_code
  BEFORE INSERT OR UPDATE OF product_id ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code_snapshot();

CREATE OR REPLACE FUNCTION public.prevent_product_code_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS DISTINCT FROM OLD.product_code THEN
    RAISE EXCEPTION 'O código do produto é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_product_code_change ON public.products;
CREATE TRIGGER prevent_product_code_change
  BEFORE UPDATE OF product_code ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_product_code_change();

COMMIT;
