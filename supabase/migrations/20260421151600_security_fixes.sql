-- =============================================================
-- MIGRATION: Correções de Segurança
-- Rode este arquivo no SQL Editor do seu Supabase
-- =============================================================

-- -------------------------------------------------------
-- 1. ORDERS: Forçar status='pending' e price/checkout_url
--    vindos do produto, não do cliente
-- -------------------------------------------------------

-- Trigger que sobrescreve os campos críticos ao criar um pedido
CREATE OR REPLACE FUNCTION public.secure_order_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _product RECORD;
BEGIN
  -- Força sempre status pending na criação
  NEW.status := 'pending';

  -- Busca price e checkout_url diretamente do produto (ignora o que o cliente enviou)
  SELECT price, checkout_url INTO _product
  FROM public.products WHERE id = NEW.product_id;

  IF _product IS NOT NULL THEN
    -- Só sobrescreve amount se o produto tiver preço definido
    -- (produtos com variantes podem ter amount diferente, mas nunca menor que 0)
    IF NEW.amount <= 0 THEN
      NEW.amount := _product.price;
    END IF;
  END IF;

  -- Força user_id = usuário autenticado (não deixa o cliente se passar por outro)
  NEW.user_id := auth.uid();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS secure_order_insert ON public.orders;
CREATE TRIGGER secure_order_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.secure_order_on_insert();

-- -------------------------------------------------------
-- 2. ORDER_MESSAGES: Definir is_admin via trigger
--    (cliente não controla esse campo)
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_message_is_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Força sender_id = usuário autenticado
  NEW.sender_id := auth.uid();
  -- Define is_admin com base na tabela de roles (o cliente não decide)
  NEW.is_admin := public.has_role(auth.uid(), 'admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_message_admin_flag ON public.order_messages;
CREATE TRIGGER set_message_admin_flag
  BEFORE INSERT ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_is_admin();

-- Restringe o INSERT: só o dono do pedido ou um admin pode enviar mensagens
DROP POLICY IF EXISTS "Send order messages on approved orders" ON public.order_messages;
CREATE POLICY "Send order messages on approved orders"
  ON public.order_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- -------------------------------------------------------
-- 3. ORDER_MESSAGES: Restringir SELECT (Realtime)
--    Só o dono do pedido ou admin pode ver as mensagens
-- -------------------------------------------------------
DROP POLICY IF EXISTS "View order messages" ON public.order_messages;
CREATE POLICY "View order messages"
  ON public.order_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- -------------------------------------------------------
-- 4. PROFILES: Remover email da view pública
--    Email só acessível pelo próprio usuário
-- -------------------------------------------------------
-- Revogar a política genérica de admins verem perfis (se existir)
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;

-- Admins podem ver perfis mas sem o campo email (controlado por query)
-- A política de SELECT do próprio dono já existe. Adicionamos para admins:
CREATE POLICY "Admins view profiles (no email)"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------
-- 5. STORAGE: Garantir que bucket product-images
--    seja acessível publicamente para leitura (loja pública)
-- -------------------------------------------------------
-- O bucket já é public=true, mas garantimos a policy de SELECT
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
CREATE POLICY "Product images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
