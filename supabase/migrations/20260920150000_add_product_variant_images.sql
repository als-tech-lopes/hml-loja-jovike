CREATE TABLE IF NOT EXISTS public.product_variant_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color text NOT NULL,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variant_images_color_not_blank CHECK (btrim(color) <> ''),
  CONSTRAINT product_variant_images_url_not_blank CHECK (btrim(image_url) <> '')
);

CREATE INDEX IF NOT EXISTS product_variant_images_product_color_idx
  ON public.product_variant_images (product_id, lower(btrim(color)), display_order);

ALTER TABLE public.product_variant_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product variant images" ON public.product_variant_images;
CREATE POLICY "Anyone can view product variant images"
  ON public.product_variant_images FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert product variant images" ON public.product_variant_images;
CREATE POLICY "Authenticated can insert product variant images"
  ON public.product_variant_images FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update product variant images" ON public.product_variant_images;
CREATE POLICY "Authenticated can update product variant images"
  ON public.product_variant_images FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete product variant images" ON public.product_variant_images;
CREATE POLICY "Authenticated can delete product variant images"
  ON public.product_variant_images FOR DELETE TO authenticated
  USING (true);

