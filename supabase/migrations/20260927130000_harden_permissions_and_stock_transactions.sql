-- Enforce module permissions at the database boundary and keep stock changes atomic.

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.has_module_access(_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.user_id = auth.uid()
      AND profile.is_active
  )
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.module_permissions AS permission
      WHERE permission.user_id = auth.uid()
        AND CASE _module
          WHEN 'dashboard' THEN permission.dashboard
          WHEN 'products' THEN permission.products
          WHEN 'movements' THEN permission.movements
          WHEN 'sales' THEN permission.sales
          WHEN 'reports' THEN permission.reports
          ELSE false
        END
    )
  )
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_module_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_access(text) TO authenticated;

-- Prevent role escalation through direct table access.
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Super admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Admins can insert permissions" ON public.module_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON public.module_permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.module_permissions;

CREATE POLICY "Admins can insert non privileged permissions"
  ON public.module_permissions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  );
CREATE POLICY "Admins can update non privileged permissions"
  ON public.module_permissions FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  )
  WITH CHECK (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  );
CREATE POLICY "Admins can delete non privileged permissions"
  ON public.module_permissions FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND (public.is_super_admin() OR NOT public.has_role(user_id, 'super_admin'))
  );

CREATE OR REPLACE FUNCTION public.protect_profile_administrative_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.is_admin() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Campos administrativos do perfil não podem ser alterados.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_administrative_fields ON public.profiles;
CREATE TRIGGER protect_profile_administrative_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_administrative_fields();

-- Product catalog remains public for reading; writes require Products permission.
DROP POLICY IF EXISTS "Authenticated can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Products permission can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access('products'));
CREATE POLICY "Products permission can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.has_module_access('products'))
  WITH CHECK (public.has_module_access('products'));
CREATE POLICY "Products permission can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (public.has_module_access('products'));

DROP POLICY IF EXISTS "Authenticated can insert product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated can update product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated can delete product variants" ON public.product_variants;
CREATE POLICY "Products permission can insert product variants"
  ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access('products'));
CREATE POLICY "Products permission can update product variants"
  ON public.product_variants FOR UPDATE TO authenticated
  USING (public.has_module_access('products'))
  WITH CHECK (public.has_module_access('products'));
CREATE POLICY "Products permission can delete product variants"
  ON public.product_variants FOR DELETE TO authenticated
  USING (public.has_module_access('products'));

DROP POLICY IF EXISTS "Authenticated can insert product variant images" ON public.product_variant_images;
DROP POLICY IF EXISTS "Authenticated can update product variant images" ON public.product_variant_images;
DROP POLICY IF EXISTS "Authenticated can delete product variant images" ON public.product_variant_images;
CREATE POLICY "Products permission can insert product variant images"
  ON public.product_variant_images FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access('products'));
CREATE POLICY "Products permission can update product variant images"
  ON public.product_variant_images FOR UPDATE TO authenticated
  USING (public.has_module_access('products'))
  WITH CHECK (public.has_module_access('products'));
CREATE POLICY "Products permission can delete product variant images"
  ON public.product_variant_images FOR DELETE TO authenticated
  USING (public.has_module_access('products'));

DROP POLICY IF EXISTS "Authenticated can upload product images" ON storage.objects;
CREATE POLICY "Products permission can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.has_module_access('products'));
CREATE POLICY "Products permission can update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND public.has_module_access('products'))
  WITH CHECK (bucket_id = 'products' AND public.has_module_access('products'));
CREATE POLICY "Products permission can delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND public.has_module_access('products'));

-- Stock of a product with variants is always derived from the variants.
CREATE OR REPLACE FUNCTION public.sync_product_quantity_from_variants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_product_id uuid;
BEGIN
  affected_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET quantity = COALESCE((
    SELECT sum(variant.quantity)::integer
    FROM public.product_variants AS variant
    WHERE variant.product_id = affected_product_id
  ), 0)
  WHERE id = affected_product_id;

  IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    UPDATE public.products
    SET quantity = COALESCE((
      SELECT sum(variant.quantity)::integer
      FROM public.product_variants AS variant
      WHERE variant.product_id = OLD.product_id
    ), 0)
    WHERE id = OLD.product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_product_quantity_from_variants ON public.product_variants;
CREATE TRIGGER sync_product_quantity_from_variants
  AFTER INSERT OR UPDATE OF quantity, product_id OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_quantity_from_variants();

UPDATE public.products AS product
SET quantity = totals.quantity
FROM (
  SELECT product_id, sum(quantity)::integer AS quantity
  FROM public.product_variants
  GROUP BY product_id
) AS totals
WHERE product.id = totals.product_id
  AND product.quantity IS DISTINCT FROM totals.quantity;

-- Direct writes are closed; stock changes happen through the atomic functions below.
DROP POLICY IF EXISTS "Authenticated can view movements" ON public.movements;
DROP POLICY IF EXISTS "Authenticated can insert movements" ON public.movements;
CREATE POLICY "Movements or reports permission can view movements"
  ON public.movements FOR SELECT TO authenticated
  USING (public.has_module_access('movements') OR public.has_module_access('reports'));

DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users view own sales, admins view all" ON public.sales;
CREATE POLICY "Sales or reports permission can view sales"
  ON public.sales FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid() AND public.has_module_access('sales'))
    OR public.has_module_access('reports')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Authenticated can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users view own sale items, admins view all" ON public.sale_items;
CREATE POLICY "Users can view permitted sale items"
  ON public.sale_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales AS sale
      WHERE sale.id = sale_items.sale_id
        AND (
          (sale.created_by = auth.uid() AND public.has_module_access('sales'))
          OR public.has_module_access('reports')
          OR public.is_admin()
        )
    )
  );

CREATE OR REPLACE FUNCTION public.create_stock_movement(
  _product_id uuid,
  _product_variant_id uuid,
  _type text,
  _quantity integer,
  _note text DEFAULT ''
)
RETURNS public.movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE;
  movement_record public.movements%ROWTYPE;
  next_quantity integer;
BEGIN
  IF NOT public.has_module_access('movements') THEN
    RAISE EXCEPTION 'Sem permissão para registrar movimentações.';
  END IF;
  IF _type NOT IN ('entrada', 'saida') THEN RAISE EXCEPTION 'Tipo de movimentação inválido.'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'A quantidade deve ser maior que zero.'; END IF;

  SELECT * INTO product_record FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;

  IF _product_variant_id IS NOT NULL THEN
    SELECT * INTO variant_record
    FROM public.product_variants
    WHERE id = _product_variant_id AND product_id = _product_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variação não encontrada para este produto.'; END IF;
    next_quantity := CASE WHEN _type = 'entrada' THEN variant_record.quantity + _quantity ELSE variant_record.quantity - _quantity END;
    IF next_quantity < 0 THEN RAISE EXCEPTION 'Estoque insuficiente para esta variação.'; END IF;
    UPDATE public.product_variants SET quantity = next_quantity WHERE id = variant_record.id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = _product_id) THEN
      RAISE EXCEPTION 'Selecione uma variação do produto.';
    END IF;
    next_quantity := CASE WHEN _type = 'entrada' THEN product_record.quantity + _quantity ELSE product_record.quantity - _quantity END;
    IF next_quantity < 0 THEN RAISE EXCEPTION 'Estoque insuficiente para este produto.'; END IF;
    UPDATE public.products SET quantity = next_quantity WHERE id = _product_id;
  END IF;

  INSERT INTO public.movements (
    product_id, product_name, product_variant_id, variant_color, variant_size,
    type, quantity, note
  ) VALUES (
    product_record.id, product_record.name, variant_record.id, variant_record.color, variant_record.size,
    _type, _quantity, COALESCE(_note, '')
  ) RETURNING * INTO movement_record;

  RETURN movement_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sale(
  _client_name text,
  _client_phone text,
  _payment_method text,
  _discount_type text,
  _discount_value numeric,
  _note text,
  _print_receipt boolean,
  _items jsonb
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_record public.sales%ROWTYPE;
  product_record public.products%ROWTYPE;
  variant_record public.product_variants%ROWTYPE;
  item jsonb;
  item_product_id uuid;
  item_variant_id uuid;
  item_quantity integer;
  item_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  calculated_discount numeric(12,2) := 0;
BEGIN
  IF NOT public.has_module_access('sales') THEN RAISE EXCEPTION 'Sem permissão para registrar vendas.'; END IF;
  IF btrim(COALESCE(_client_name, '')) = '' THEN RAISE EXCEPTION 'Informe o cliente.'; END IF;
  IF btrim(COALESCE(_payment_method, '')) = '' THEN RAISE EXCEPTION 'Informe a forma de pagamento.'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'A venda precisa ter ao menos um item.'; END IF;

  INSERT INTO public.sales (
    client_name, client_phone, payment_method, subtotal, discount_type,
    discount_value, discount_amount, total, note, created_by, print_receipt
  ) VALUES (
    btrim(_client_name), COALESCE(_client_phone, ''), btrim(_payment_method), 0, NULL,
    0, 0, 0, COALESCE(_note, ''), auth.uid(), COALESCE(_print_receipt, false)
  ) RETURNING * INTO sale_record;

  FOR item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    item_product_id := (item->>'product_id')::uuid;
    item_variant_id := NULLIF(item->>'product_variant_id', '')::uuid;
    item_quantity := (item->>'quantity')::integer;
    IF item_quantity IS NULL OR item_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade de item inválida.'; END IF;

    SELECT * INTO product_record FROM public.products WHERE id = item_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;

    variant_record := NULL;
    IF item_variant_id IS NOT NULL THEN
      SELECT * INTO variant_record
      FROM public.product_variants
      WHERE id = item_variant_id AND product_id = item_product_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variação não encontrada para o produto %.', product_record.name; END IF;
      IF variant_record.quantity < item_quantity THEN RAISE EXCEPTION 'Estoque insuficiente para % - %/%', product_record.name, variant_record.color, variant_record.size; END IF;
      item_price := variant_record.price;
      UPDATE public.product_variants SET quantity = quantity - item_quantity WHERE id = variant_record.id;
    ELSE
      IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = item_product_id) THEN
        RAISE EXCEPTION 'Selecione uma variação para o produto %.', product_record.name;
      END IF;
      IF product_record.quantity < item_quantity THEN RAISE EXCEPTION 'Estoque insuficiente para %.', product_record.name; END IF;
      item_price := product_record.price;
      UPDATE public.products SET quantity = quantity - item_quantity WHERE id = product_record.id;
    END IF;

    calculated_subtotal := calculated_subtotal + round(item_price * item_quantity, 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, product_name, quantity, unit_price,
      product_variant_id, variant_color, variant_size
    ) VALUES (
      sale_record.id, product_record.id, product_record.name, item_quantity, item_price,
      variant_record.id, variant_record.color, variant_record.size
    );

    INSERT INTO public.movements (
      product_id, product_name, product_variant_id, variant_color, variant_size,
      type, quantity, note, source_sale_id
    ) VALUES (
      product_record.id, product_record.name, variant_record.id, variant_record.color, variant_record.size,
      'saida', item_quantity, 'Venda para ' || btrim(_client_name), sale_record.id
    );
  END LOOP;

  IF _discount_type IS NULL THEN
    IF COALESCE(_discount_value, 0) <> 0 THEN RAISE EXCEPTION 'Tipo de desconto não informado.'; END IF;
  ELSIF _discount_type = 'percentage' THEN
    IF _discount_value < 0 OR _discount_value > 100 THEN RAISE EXCEPTION 'Percentual de desconto inválido.'; END IF;
    calculated_discount := round(calculated_subtotal * _discount_value / 100, 2);
  ELSIF _discount_type = 'fixed' THEN
    IF _discount_value < 0 OR _discount_value > calculated_subtotal THEN RAISE EXCEPTION 'Desconto fixo inválido.'; END IF;
    calculated_discount := round(_discount_value, 2);
  ELSE
    RAISE EXCEPTION 'Tipo de desconto inválido.';
  END IF;

  UPDATE public.sales
  SET subtotal = calculated_subtotal,
      discount_type = _discount_type,
      discount_value = COALESCE(_discount_value, 0),
      discount_amount = calculated_discount,
      total = calculated_subtotal - calculated_discount
  WHERE id = sale_record.id
  RETURNING * INTO sale_record;

  RETURN sale_record;
END;
$$;

-- Cancellation functions must follow the same derived-stock rule.
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_record public.sales%ROWTYPE;
  item_record record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem cancelar vendas.'; END IF;
  SELECT * INTO sale_record FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;
  IF sale_record.status = 'Cancelada' THEN RAISE EXCEPTION 'Esta venda já foi cancelada.'; END IF;

  FOR item_record IN SELECT product_id, product_variant_id, quantity FROM public.sale_items WHERE sale_id = _sale_id
  LOOP
    IF item_record.product_variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET quantity = quantity + item_record.quantity WHERE id = item_record.product_variant_id;
    ELSE
      UPDATE public.products SET quantity = quantity + item_record.quantity WHERE id = item_record.product_id;
    END IF;
  END LOOP;

  UPDATE public.sales SET status = 'Cancelada', cancelled_at = now(), cancelled_by = auth.uid() WHERE id = _sale_id;
  UPDATE public.movements SET status = 'Cancelada', cancelled_at = now(), cancelled_by = auth.uid()
  WHERE source_sale_id = _sale_id AND status <> 'Cancelada';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_movement(_movement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  movement_record public.movements%ROWTYPE;
  current_quantity integer;
  next_quantity integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem cancelar movimentações.'; END IF;
  SELECT * INTO movement_record FROM public.movements WHERE id = _movement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada.'; END IF;
  IF movement_record.status = 'Cancelada' THEN RAISE EXCEPTION 'Esta movimentação já foi cancelada.'; END IF;
  IF movement_record.source_sale_id IS NOT NULL THEN RAISE EXCEPTION 'Cancele a venda de origem para reverter esta movimentação.'; END IF;

  IF movement_record.product_variant_id IS NOT NULL THEN
    SELECT quantity INTO current_quantity FROM public.product_variants WHERE id = movement_record.product_variant_id FOR UPDATE;
    IF current_quantity IS NULL THEN RAISE EXCEPTION 'Variação não encontrada.'; END IF;
    next_quantity := CASE WHEN movement_record.type = 'entrada' THEN current_quantity - movement_record.quantity ELSE current_quantity + movement_record.quantity END;
    IF next_quantity < 0 THEN RAISE EXCEPTION 'Estoque insuficiente para cancelar esta entrada.'; END IF;
    UPDATE public.product_variants SET quantity = next_quantity WHERE id = movement_record.product_variant_id;
  ELSE
    SELECT quantity INTO current_quantity FROM public.products WHERE id = movement_record.product_id FOR UPDATE;
    IF current_quantity IS NULL THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;
    next_quantity := CASE WHEN movement_record.type = 'entrada' THEN current_quantity - movement_record.quantity ELSE current_quantity + movement_record.quantity END;
    IF next_quantity < 0 THEN RAISE EXCEPTION 'Estoque insuficiente para cancelar esta entrada.'; END IF;
    UPDATE public.products SET quantity = next_quantity WHERE id = movement_record.product_id;
  END IF;

  UPDATE public.movements SET status = 'Cancelada', cancelled_at = now(), cancelled_by = auth.uid() WHERE id = _movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_movement(uuid, uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale(text, text, text, text, numeric, text, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_sale(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_movement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_movement(uuid, uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(text, text, text, text, numeric, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_movement(uuid) TO authenticated;
