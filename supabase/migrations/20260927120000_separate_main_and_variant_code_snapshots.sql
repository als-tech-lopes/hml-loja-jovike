BEGIN;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS variant_code text;

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS variant_code text;

CREATE INDEX IF NOT EXISTS sale_items_variant_code_idx
  ON public.sale_items (variant_code);

CREATE INDEX IF NOT EXISTS movements_variant_code_idx
  ON public.movements (variant_code);

CREATE OR REPLACE FUNCTION public.set_product_code_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT product.product_code INTO NEW.product_code
  FROM public.products AS product
  WHERE product.id = NEW.product_id;

  IF NEW.product_code IS NULL THEN
    RAISE EXCEPTION 'Código principal não encontrado para o produto %', NEW.product_id;
  END IF;

  IF NEW.product_variant_id IS NOT NULL THEN
    SELECT variant.variant_code INTO NEW.variant_code
    FROM public.product_variants AS variant
    WHERE variant.id = NEW.product_variant_id
      AND variant.product_id = NEW.product_id;

    IF NEW.variant_code IS NULL THEN
      RAISE EXCEPTION 'Subcódigo não encontrado para a variação % do produto %', NEW.product_variant_id, NEW.product_id;
    END IF;
  ELSE
    NEW.variant_code := NULL;
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
SET product_code = product.product_code,
    variant_code = (
      SELECT variant.variant_code
      FROM public.product_variants AS variant
      WHERE variant.id = item.product_variant_id
    )
FROM public.products AS product
WHERE item.product_id = product.id
  AND (
    item.product_code IS DISTINCT FROM product.product_code
    OR item.variant_code IS DISTINCT FROM (
      SELECT variant.variant_code
      FROM public.product_variants AS variant
      WHERE variant.id = item.product_variant_id
    )
  );

UPDATE public.movements AS movement
SET product_code = product.product_code,
    variant_code = (
      SELECT variant.variant_code
      FROM public.product_variants AS variant
      WHERE variant.id = movement.product_variant_id
    )
FROM public.products AS product
WHERE movement.product_id = product.id
  AND (
    movement.product_code IS DISTINCT FROM product.product_code
    OR movement.variant_code IS DISTINCT FROM (
      SELECT variant.variant_code
      FROM public.product_variants AS variant
      WHERE variant.id = movement.product_variant_id
    )
  );

COMMIT;
