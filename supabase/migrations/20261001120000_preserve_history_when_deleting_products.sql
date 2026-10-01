-- Allow catalog products to be deleted without erasing sales and stock history.
-- Historical tables already keep immutable product/variant code, name, price,
-- quantity, color and size snapshots. Only the live foreign key is cleared.

ALTER TABLE public.sale_items
  ALTER COLUMN product_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;

ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

ALTER TABLE public.movements
  ALTER COLUMN product_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS movements_product_id_fkey;

ALTER TABLE public.movements
  ADD CONSTRAINT movements_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.sale_items.product_id IS
  'Live product reference. Becomes NULL when the catalog product is deleted; snapshot fields preserve sale history.';

COMMENT ON COLUMN public.movements.product_id IS
  'Live product reference. Becomes NULL when the catalog product is deleted; snapshot fields preserve movement history.';
