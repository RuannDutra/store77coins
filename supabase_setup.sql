-- ============================================================
-- PASSO 1: Adicionar coluna avatar_url na tabela profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;


-- ============================================================
-- PASSO 2: Criar bucket "avatars" (público)
-- Execute este bloco separadamente no painel Storage se preferir
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- PASSO 3: Políticas RLS do bucket avatars
-- ============================================================

-- Leitura pública
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Upload: cada usuário só pode fazer upload na pasta com seu próprio UID
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Atualização: mesmo critério
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================
-- PASSO 4: Criar usuário Henrique como admin
-- ============================================================

-- 4a. Criar o usuário de auth (usando a função interna do Supabase)
SELECT auth.create_user(
  '{
    "email": "henrique@77coins.local",
    "password": "PauloHenrique14",
    "email_confirm": true,
    "user_metadata": {"username": "Henrique"}
  }'::jsonb
);

-- 4b. Criar profile + papel admin para o Henrique
DO $$
DECLARE
  henrique_id uuid;
BEGIN
  SELECT id INTO henrique_id
  FROM auth.users
  WHERE email = 'henrique@77coins.local'
  LIMIT 1;

  IF henrique_id IS NULL THEN
    RAISE EXCEPTION 'Usuário henrique@77coins.local não encontrado. Execute o passo 4a primeiro.';
  END IF;

  -- Perfil
  INSERT INTO public.profiles (id, username, email)
  VALUES (henrique_id, 'Henrique', 'henrique@77coins.local')
  ON CONFLICT (id) DO UPDATE SET username = 'Henrique';

  -- Role admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (henrique_id, 'admin')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Henrique criado com sucesso! ID: %', henrique_id;
END $$;
