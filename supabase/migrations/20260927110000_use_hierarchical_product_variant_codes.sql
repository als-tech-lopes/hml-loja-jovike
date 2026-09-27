BEGIN;

LOCK TABLE public.product_variants IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.product_variants
  ALTER COLUMN variant_code DROP DEFAULT;

DROP TRIGGER IF EXISTS prevent_product_variant_code_change ON public.product_variants;
DROP FUNCTION IF EXISTS public.generate_product_variant_code();
DROP SEQUENCE IF EXISTS public.product_variant_code_seq;

CREATE OR REPLACE FUNCTION public.product_variant_code_part(_value text, _max_length integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT left(
    regexp_replace(
      translate(
        upper(btrim(_value)),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      '',
      'g'
    ),
    _max_length
  )
$$;

CREATE OR REPLACE FUNCTION public.generate_product_variant_code(
  _product_id uuid,
  _color text,
  _size text,
  _exclude_variant_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_code text;
  color_code text;
  size_code text;
  base_code text;
  candidate_code text;
  suffix integer := 2;
BEGIN
  SELECT product.product_code INTO parent_code
  FROM public.products AS product
  WHERE product.id = _product_id;

  IF parent_code IS NULL THEN
    RAISE EXCEPTION 'Código principal não encontrado para o produto %', _product_id;
  END IF;

  color_code := nullif(public.product_variant_code_part(_color, 3), '');
  size_code := nullif(public.product_variant_code_part(_size, 8), '');
  base_code := parent_code || '-' || coalesce(color_code, 'COR') || '-' || coalesce(size_code, 'TAM');
  candidate_code := base_code;

  WHILE EXISTS (
    SELECT 1
    FROM public.product_variants AS variant
    WHERE variant.variant_code = candidate_code
      AND variant.id IS DISTINCT FROM _exclude_variant_id
  ) LOOP
    candidate_code := base_code || '-' || suffix;
    suffix := suffix + 1;
  END LOOP;

  RETURN candidate_code;
END;
$$;

DO $$
DECLARE
  variant_record record;
BEGIN
  FOR variant_record IN
    SELECT id, product_id, color, size
    FROM public.product_variants
    ORDER BY product_id, created_at, id
  LOOP
    UPDATE public.product_variants
    SET variant_code = public.generate_product_variant_code(
      variant_record.product_id,
      variant_record.color,
      variant_record.size,
      variant_record.id
    )
    WHERE id = variant_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_variant_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.product_id::text, 0));
  NEW.variant_code := public.generate_product_variant_code(NEW.product_id, NEW.color, NEW.size, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_variant_code ON public.product_variants;
CREATE TRIGGER set_product_variant_code
  BEFORE INSERT ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_product_variant_code();

CREATE TRIGGER prevent_product_variant_code_change
  BEFORE UPDATE OF variant_code ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_product_variant_code_change();

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
