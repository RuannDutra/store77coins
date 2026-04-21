-- Conceder role admin ao usuário RuanXisL
DO $$
DECLARE
  ruan_id uuid;
BEGIN
  -- Buscar o ID pelo username no profiles
  SELECT id INTO ruan_id
  FROM public.profiles
  WHERE username = 'RuanXisL'
  LIMIT 1;

  IF ruan_id IS NULL THEN
    -- Tentar pelo email caso o profile não exista ainda
    SELECT id INTO ruan_id
    FROM auth.users
    WHERE email = 'ruanxisl@77coins.local'
    LIMIT 1;
  END IF;

  IF ruan_id IS NULL THEN
    RAISE EXCEPTION 'Usuário RuanXisL não encontrado na tabela profiles nem em auth.users';
  END IF;

  -- Garantir que o perfil existe
  INSERT INTO public.profiles (id, username)
  VALUES (ruan_id, 'RuanXisL')
  ON CONFLICT (id) DO NOTHING;

  -- Conceder role admin (ignora se já existir)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (ruan_id, 'admin')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Admin concedido ao RuanXisL! ID: %', ruan_id;
END $$;

-- Verificar se foi aplicado corretamente:
SELECT p.username, ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.username = 'RuanXisL';
