-- Card sales include a 5% fee over the amount remaining after discounts.
-- The calculation stays on the server so clients cannot bypass or alter it.
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
  calculated_card_fee numeric(12,2) := 0;
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

  IF btrim(_payment_method) IN ('cartao_credito', 'cartao_debito') THEN
    calculated_card_fee := round((calculated_subtotal - calculated_discount) * 0.05, 2);
  END IF;

  UPDATE public.sales
  SET subtotal = calculated_subtotal,
      discount_type = _discount_type,
      discount_value = COALESCE(_discount_value, 0),
      discount_amount = calculated_discount,
      total = calculated_subtotal - calculated_discount + calculated_card_fee
  WHERE id = sale_record.id
  RETURNING * INTO sale_record;

  RETURN sale_record;
END;
$$;
