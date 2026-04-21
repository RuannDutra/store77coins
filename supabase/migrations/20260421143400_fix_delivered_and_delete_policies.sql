-- 1. Adiciona o valor "delivered" ao enum order_status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered';

-- 2. Adiciona política de DELETE para orders (admins podem excluir pedidos)
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders"
  ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Garante política de DELETE para products (admins podem excluir produtos)
DROP POLICY IF EXISTS "Admins delete products" ON public.products;
CREATE POLICY "Admins delete products"
  ON public.products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Torna product_id nullable em orders (para não quebrar ao deletar produto)
ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;

-- 5. Recria a FK de orders->products com ON DELETE SET NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- 6. Adiciona coluna variants nos produtos (se não existir)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT NULL;
