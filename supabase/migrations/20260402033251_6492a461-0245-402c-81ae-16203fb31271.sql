ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Concluida',
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_by uuid;

ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Concluida',
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_by uuid,
ADD COLUMN IF NOT EXISTS source_sale_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'movements'
      AND constraint_name = 'movements_source_sale_id_fkey'
  ) THEN
    ALTER TABLE public.movements
    ADD CONSTRAINT movements_source_sale_id_fkey
    FOREIGN KEY (source_sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movements_source_sale_id ON public.movements(source_sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_movements_status ON public.movements(status);

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar vendas.';
  END IF;

  SELECT *
  INTO sale_record
  FROM public.sales
  WHERE id = _sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  IF sale_record.status = 'Cancelada' THEN
    RAISE EXCEPTION 'Esta venda já foi cancelada.';
  END IF;

  FOR item_record IN
    SELECT product_id, quantity
    FROM public.sale_items
    WHERE sale_id = _sale_id
  LOOP
    UPDATE public.products
    SET quantity = quantity + item_record.quantity
    WHERE id = item_record.product_id;
  END LOOP;

  UPDATE public.sales
  SET status = 'Cancelada',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  WHERE id = _sale_id;

  UPDATE public.movements
  SET status = 'Cancelada',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  WHERE source_sale_id = _sale_id
    AND status <> 'Cancelada';
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar movimentações.';
  END IF;

  SELECT *
  INTO movement_record
  FROM public.movements
  WHERE id = _movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada.';
  END IF;

  IF movement_record.status = 'Cancelada' THEN
    RAISE EXCEPTION 'Esta movimentação já foi cancelada.';
  END IF;

  SELECT quantity
  INTO current_quantity
  FROM public.products
  WHERE id = movement_record.product_id;

  IF current_quantity IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado para esta movimentação.';
  END IF;

  IF movement_record.type = 'entrada' THEN
    next_quantity := current_quantity - movement_record.quantity;
    IF next_quantity < 0 THEN
      RAISE EXCEPTION 'Estoque atual insuficiente para cancelar esta movimentação de entrada.';
    END IF;
  ELSE
    next_quantity := current_quantity + movement_record.quantity;
  END IF;

  UPDATE public.products
  SET quantity = next_quantity
  WHERE id = movement_record.product_id;

  UPDATE public.movements
  SET status = 'Cancelada',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  WHERE id = _movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_movement(uuid) TO authenticated;