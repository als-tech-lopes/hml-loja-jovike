BEGIN;

LOCK TABLE public.sales IN SHARE ROW EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS public.sale_code_seq
  AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 20;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS sale_code text,
  ADD COLUMN IF NOT EXISTS print_receipt boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.generate_sale_code()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'VEN-' || lpad(nextval('public.sale_code_seq')::text, 8, '0')
$$;

ALTER TABLE public.sales
  ALTER COLUMN sale_code SET DEFAULT public.generate_sale_code();

WITH missing AS (
  SELECT id, public.generate_sale_code() AS generated_code
  FROM public.sales
  WHERE sale_code IS NULL
  ORDER BY created_at, id
)
UPDATE public.sales AS s
SET sale_code = missing.generated_code
FROM missing
WHERE s.id = missing.id;

ALTER TABLE public.sales ALTER COLUMN sale_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_sale_code_uidx
  ON public.sales (sale_code);

CREATE OR REPLACE FUNCTION public.prevent_sale_code_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sale_code IS DISTINCT FROM OLD.sale_code THEN
    RAISE EXCEPTION 'O código da venda é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_sale_code_change ON public.sales;
CREATE TRIGGER prevent_sale_code_change
  BEFORE UPDATE OF sale_code ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sale_code_change();

COMMIT;
