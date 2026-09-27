ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_purchase_price_nonnegative,
  ADD CONSTRAINT products_purchase_price_nonnegative CHECK (purchase_price >= 0);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.sales
SET subtotal = total
WHERE subtotal = 0 AND total > 0;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_subtotal_nonnegative,
  DROP CONSTRAINT IF EXISTS sales_discount_type_valid,
  DROP CONSTRAINT IF EXISTS sales_discount_value_valid,
  DROP CONSTRAINT IF EXISTS sales_discount_amount_valid,
  ADD CONSTRAINT sales_subtotal_nonnegative CHECK (subtotal >= 0),
  ADD CONSTRAINT sales_discount_type_valid CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed')),
  ADD CONSTRAINT sales_discount_value_valid CHECK (
    discount_value >= 0
    AND (discount_type <> 'percentage' OR discount_value <= 100)
  ),
  ADD CONSTRAINT sales_discount_amount_valid CHECK (
    discount_amount >= 0
    AND discount_amount <= subtotal
  );

COMMENT ON COLUMN public.products.purchase_price IS 'Valor unitario de compra do produto.';
COMMENT ON COLUMN public.sales.subtotal IS 'Valor da venda antes do desconto.';
COMMENT ON COLUMN public.sales.discount_type IS 'Tipo do desconto: percentage ou fixed.';
COMMENT ON COLUMN public.sales.discount_value IS 'Valor informado pelo vendedor para o desconto.';
COMMENT ON COLUMN public.sales.discount_amount IS 'Valor monetario efetivamente descontado da venda.';
