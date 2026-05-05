-- Ensure the products bucket exists and is public
insert into storage.buckets (id, name, public)
select 'products', 'products', true
where not exists (
  select 1 from storage.buckets where id = 'products'
);

update storage.buckets
set public = true
where id = 'products' and public is distinct from true;

-- Ensure policies required for public rendering and authenticated uploads
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Authenticated can upload product images" ON storage.objects;
CREATE POLICY "Authenticated can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');