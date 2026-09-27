BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.product_variant_code_seq
  AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 20;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS variant_code text;

CREATE OR REPLACE FUNCTION public.generate_product_variant_code()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'VAR-' || lpad(nextval('public.product_variant_code_seq')::text, 8, '0')
$$;

ALTER TABLE public.product_variants
  ALTER COLUMN variant_code SET DEFAULT public.generate_product_variant_code();

WITH missing AS (
  SELECT id, public.generate_product_variant_code() AS generated_code
  FROM public.product_variants
  WHERE variant_code IS NULL
  ORDER BY created_at, id
)
UPDATE public.product_variants AS variant
SET variant_code = missing.generated_code
FROM missing
WHERE variant.id = missing.id;

ALTER TABLE public.product_variants
  ALTER COLUMN variant_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_variant_code_uidx
  ON public.product_variants (variant_code);

CREATE OR REPLACE FUNCTION public.prevent_product_variant_code_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.variant_code IS DISTINCT FROM OLD.variant_code THEN
    RAISE EXCEPTION 'O código da variação é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_product_variant_code_change ON public.product_variants;
CREATE TRIGGER prevent_product_variant_code_change
  BEFORE UPDATE OF variant_code ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_product_variant_code_change();

CREATE OR REPLACE FUNCTION public.set_product_code_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_variant_id IS NOT NULL THEN
    SELECT variant.variant_code INTO NEW.product_code
    FROM public.product_variants AS variant
    WHERE variant.id = NEW.product_variant_id
      AND variant.product_id = NEW.product_id;

    IF NEW.product_code IS NULL THEN
      RAISE EXCEPTION 'Código não encontrado para a variação % do produto %', NEW.product_variant_id, NEW.product_id;
    END IF;
  ELSE
    SELECT product.product_code INTO NEW.product_code
    FROM public.products AS product
    WHERE product.id = NEW.product_id;

    IF NEW.product_code IS NULL THEN
      RAISE EXCEPTION 'Código não encontrado para o produto %', NEW.product_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sale_item_product_code ON public.sale_items;
CREATE TRIGGER set_sale_item_product_code
  BEFORE INSERT OR UPDATE OF product_id, product_variant_id ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code_snapshot();

DROP TRIGGER IF EXISTS set_movement_product_code ON public.movements;
CREATE TRIGGER set_movement_product_code
  BEFORE INSERT OR UPDATE OF product_id, product_variant_id ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code_snapshot();

UPDATE public.sale_items AS item
SET product_code = variant.variant_code
FROM public.product_variants AS variant
WHERE item.product_variant_id = variant.id
  AND item.product_code IS DISTINCT FROM variant.variant_code;

UPDATE public.movements AS movement
SET product_code = variant.variant_code
FROM public.product_variants AS variant
WHERE movement.product_variant_id = variant.id
  AND movement.product_code IS DISTINCT FROM variant.variant_code;

COMMIT;
