ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_color text,
  ADD COLUMN IF NOT EXISTS variant_size text;

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_color text,
  ADD COLUMN IF NOT EXISTS variant_size text;

CREATE INDEX IF NOT EXISTS sale_items_product_variant_id_idx ON public.sale_items(product_variant_id);
CREATE INDEX IF NOT EXISTS movements_product_variant_id_idx ON public.movements(product_variant_id);

CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_record public.sales%ROWTYPE;
  item_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem cancelar vendas.'; END IF;

  SELECT * INTO sale_record FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;
  IF sale_record.status = 'Cancelada' THEN RAISE EXCEPTION 'Esta venda já foi cancelada.'; END IF;

  FOR item_record IN
    SELECT product_id, product_variant_id, quantity FROM public.sale_items WHERE sale_id = _sale_id
  LOOP
    UPDATE public.products SET quantity = quantity + item_record.quantity WHERE id = item_record.product_id;
    IF item_record.product_variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET quantity = quantity + item_record.quantity WHERE id = item_record.product_variant_id;
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
  current_variant_quantity integer;
  next_quantity integer;
  next_variant_quantity integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem cancelar movimentações.'; END IF;

  SELECT * INTO movement_record FROM public.movements WHERE id = _movement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada.'; END IF;
  IF movement_record.status = 'Cancelada' THEN RAISE EXCEPTION 'Esta movimentação já foi cancelada.'; END IF;

  SELECT quantity INTO current_quantity FROM public.products WHERE id = movement_record.product_id FOR UPDATE;
  IF current_quantity IS NULL THEN RAISE EXCEPTION 'Produto não encontrado para esta movimentação.'; END IF;

  IF movement_record.type = 'entrada' THEN
    next_quantity := current_quantity - movement_record.quantity;
    IF next_quantity < 0 THEN RAISE EXCEPTION 'Estoque atual insuficiente para cancelar esta movimentação de entrada.'; END IF;
  ELSE
    next_quantity := current_quantity + movement_record.quantity;
  END IF;

  IF movement_record.product_variant_id IS NOT NULL THEN
    SELECT quantity INTO current_variant_quantity FROM public.product_variants WHERE id = movement_record.product_variant_id FOR UPDATE;
    IF current_variant_quantity IS NULL THEN RAISE EXCEPTION 'Variação não encontrada para esta movimentação.'; END IF;
    IF movement_record.type = 'entrada' THEN
      next_variant_quantity := current_variant_quantity - movement_record.quantity;
      IF next_variant_quantity < 0 THEN RAISE EXCEPTION 'Estoque da variação insuficiente para cancelar esta entrada.'; END IF;
    ELSE
      next_variant_quantity := current_variant_quantity + movement_record.quantity;
    END IF;
    UPDATE public.product_variants SET quantity = next_variant_quantity WHERE id = movement_record.product_variant_id;
  END IF;

  UPDATE public.products SET quantity = next_quantity WHERE id = movement_record.product_id;
  UPDATE public.movements SET status = 'Cancelada', cancelled_at = now(), cancelled_by = auth.uid() WHERE id = _movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_movement(uuid) TO authenticated;

