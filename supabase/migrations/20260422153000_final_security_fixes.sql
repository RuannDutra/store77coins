-- =============================================================
-- MIGRATION: Segurança Final e Hardening
-- =============================================================

-- 1. PROFILES: Privacidade de E-mail
-- Stop saving emails to profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _username TEXT;
BEGIN
  _username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, _username)
  ON CONFLICT (id) DO NOTHING;

  IF _username = '77coins' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Clear existing emails for privacy
UPDATE public.profiles SET email = NULL;

-- 2. PRODUCTS: Checkout URLs Seguras
-- Criar tabela de segredos para produtos
CREATE TABLE IF NOT EXISTS public.product_secrets (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  checkout_url TEXT,
  variants_urls JSONB -- [{ name: string, checkout_url: string }]
);

ALTER TABLE public.product_secrets ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/escrever segredos
CREATE POLICY "Admins manage product secrets"
  ON public.product_secrets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migrar dados existentes de products para product_secrets
INSERT INTO public.product_secrets (product_id, checkout_url, variants_urls)
SELECT 
  id, 
  checkout_url, 
  (SELECT jsonb_agg(jsonb_build_object('name', v->>'name', 'checkout_url', v->>'checkout_url')) FROM jsonb_array_elements(variants) v)
FROM public.products
ON CONFLICT (product_id) DO UPDATE SET
  checkout_url = EXCLUDED.checkout_url,
  variants_urls = EXCLUDED.variants_urls;

-- Limpar dados sensíveis da tabela pública (opcional, mas recomendado)
-- Vamos manter o campo checkout_url e variants em products mas setar como NULL via política ou remover
-- Para ser menos disruptivo no frontend, vamos apenas remover o acesso via RLS.
-- Mas RLS não remove colunas. Então vamos DELETAR os dados da tabela original.
UPDATE public.products SET checkout_url = NULL;
-- E os variants precisam ser limpos dos links
UPDATE public.products SET variants = (
  SELECT jsonb_agg(jsonb_build_object('name', v->>'name', 'price', (v->>'price')::numeric))
  FROM jsonb_array_elements(variants) v
) WHERE variants IS NOT NULL;

-- 3. ORDERS: Atualizar trigger para buscar no product_secrets
CREATE OR REPLACE FUNCTION public.secure_order_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _product RECORD;
  _secrets RECORD;
  _variant_url TEXT;
BEGIN
  NEW.status := 'pending';
  NEW.user_id := auth.uid();

  -- Busca dados públicos do produto
  SELECT price, name INTO _product
  FROM public.products WHERE id = NEW.product_id;

  -- Busca segredos
  SELECT checkout_url, variants_urls INTO _secrets
  FROM public.product_secrets WHERE product_id = NEW.product_id;

  IF _secrets IS NOT NULL THEN
    -- Se for um pedido de variante (identificado pelo nome)
    IF NEW.product_name LIKE '% - %' THEN
      SELECT v->>'checkout_url' INTO _variant_url
      FROM jsonb_array_elements(_secrets.variants_urls) v
      WHERE (_product.name || ' - ' || (v->>'name')) = NEW.product_name
      LIMIT 1;
      
      IF _variant_url IS NOT NULL THEN
        NEW.checkout_url := _variant_url;
      ELSE
        NEW.checkout_url := _secrets.checkout_url;
      END IF;
    ELSE
      NEW.checkout_url := _secrets.checkout_url;
    END IF;
  END IF;

  -- Se o amount for 0 ou não informado, tenta pegar do produto principal
  IF NEW.amount <= 0 AND _product IS NOT NULL THEN
    NEW.amount := _product.price;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. ORDER_MESSAGES: Proteção Total contra Impersonificação e Realtime
CREATE OR REPLACE FUNCTION public.set_message_is_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- SEMPRE força o sender_id real
  NEW.sender_id := auth.uid();
  -- SEMPRE define is_admin baseado na role atual do banco
  NEW.is_admin := EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
  RETURN NEW;
END;
$$;

-- Trigger para INSERT e UPDATE (evita mudar is_admin depois)
DROP TRIGGER IF EXISTS set_message_admin_flag ON public.order_messages;
CREATE TRIGGER set_message_admin_flag
  BEFORE INSERT OR UPDATE ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_is_admin();

-- Política de SELECT ultra-restrita para Realtime
DROP POLICY IF EXISTS "View order messages" ON public.order_messages;
CREATE POLICY "View order messages"
  ON public.order_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() -- Eu enviei
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
