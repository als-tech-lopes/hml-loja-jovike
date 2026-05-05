
-- Drop existing SELECT policy on sales
DROP POLICY IF EXISTS "Authenticated can view sales" ON public.sales;

-- Users can see their own sales, admins/super_admins see all
CREATE POLICY "Users view own sales, admins view all"
ON public.sales
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR is_admin()
);

-- Drop existing SELECT policy on sale_items
DROP POLICY IF EXISTS "Authenticated can view sale items" ON public.sale_items;

-- Sale items visible if the parent sale is visible
CREATE POLICY "Users view own sale items, admins view all"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
      AND (sales.created_by = auth.uid() OR is_admin())
  )
);
