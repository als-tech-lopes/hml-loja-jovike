-- Deleting a product can clear product_id and product_variant_id in separate
-- foreign-key actions. On the second action, OLD.product_id is already NULL,
-- but the row is still an existing history record and its snapshots must be
-- preserved.

CREATE OR REPLACE FUNCTION public.set_product_code_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.product_code := OLD.product_code;
      NEW.variant_code := OLD.variant_code;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'O produto é obrigatório para registrar um novo histórico.';
  END IF;

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
  ELSIF TG_OP = 'UPDATE' AND OLD.product_variant_id IS NOT NULL THEN
    NEW.variant_code := OLD.variant_code;
  ELSE
    NEW.variant_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;
