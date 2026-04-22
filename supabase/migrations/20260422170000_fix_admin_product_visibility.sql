-- =============================================================
-- MIGRATION: Corrigir Visibilidade de Produtos para Admin
-- =============================================================

-- 1. Garantir que as colunas e tabelas necessárias existem
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT NULL;
COMMENT ON COLUMN public.products.variants IS 'Opções dinâmicas do produto (nome e preço)';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_secrets TO authenticated;
GRANT SELECT ON public.product_secrets TO anon;

-- Forçar a recriação da FK com um nome padrão que o PostgREST reconhece facilmente
ALTER TABLE public.product_secrets DROP CONSTRAINT IF EXISTS product_secrets_product_id_fkey;
ALTER TABLE public.product_secrets 
  ADD CONSTRAINT product_secrets_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 2. Corrigir RLS da tabela products para garantir acesso total ao Admin
-- Removemos as políticas antigas para garantir que as novas sejam limpas
DROP POLICY IF EXISTS "Active products public read" ON public.products;
DROP POLICY IF EXISTS "Admins manage products" ON public.products;

-- Política para leitura (Pública + Admin)
CREATE POLICY "Products select policy"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (
    active = true 
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  );

-- Política para gerenciamento (Admin)
CREATE POLICY "Products admin manage"
  ON public.products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Garantir delete para orders explicitamente
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- 3. Corrigir RLS da tabela product_secrets
DROP POLICY IF EXISTS "Admins manage product secrets" ON public.product_secrets;

CREATE POLICY "Admins manage product secrets"
  ON public.product_secrets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Permitir que o sistema (service_role) e triggers acessem sem restrição
ALTER TABLE public.product_secrets FORCE ROW LEVEL SECURITY; -- Garante que RLS se aplica a todos exceto superuser


-- 4. Verificar se o usuário RuanXisL realmente tem a role admin
-- (Apenas por precaução, caso tenha sido sobrescrito)
DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM public.profiles WHERE username = 'RuanXisL' LIMIT 1;
  
  IF _user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
