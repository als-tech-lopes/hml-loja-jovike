CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color text NOT NULL,
  size text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_color_not_blank CHECK (btrim(color) <> ''),
  CONSTRAINT product_variants_size_not_blank CHECK (btrim(size) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_color_size_uidx
  ON public.product_variants (product_id, lower(btrim(color)), lower(btrim(size)));

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON public.product_variants (product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product variants" ON public.product_variants;
CREATE POLICY "Anyone can view product variants"
  ON public.product_variants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert product variants" ON public.product_variants;
CREATE POLICY "Authenticated can insert product variants"
  ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update product variants" ON public.product_variants;
CREATE POLICY "Authenticated can update product variants"
  ON public.product_variants FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete product variants" ON public.product_variants;
CREATE POLICY "Authenticated can delete product variants"
  ON public.product_variants FOR DELETE TO authenticated
  USING (true);

