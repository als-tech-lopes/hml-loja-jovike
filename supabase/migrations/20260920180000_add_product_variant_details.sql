ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

UPDATE public.product_variants AS variant
SET quantity = product.quantity,
    price = product.price,
    min_stock = product.min_stock,
    description = product.description
FROM public.products AS product
WHERE product.id = variant.product_id
  AND variant.quantity = 0
  AND variant.price = 0
  AND variant.min_stock = 0
  AND variant.description = '';

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_quantity_nonnegative,
  DROP CONSTRAINT IF EXISTS product_variants_price_nonnegative,
  DROP CONSTRAINT IF EXISTS product_variants_min_stock_nonnegative;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_quantity_nonnegative CHECK (quantity >= 0),
  ADD CONSTRAINT product_variants_price_nonnegative CHECK (price >= 0),
  ADD CONSTRAINT product_variants_min_stock_nonnegative CHECK (min_stock >= 0);

