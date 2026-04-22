
-- Tabela para códigos de redefinição de senha (4 dígitos)
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prc_email ON public.password_reset_codes(email);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Sem políticas: tabela só acessada via edge function com service role
-- Qualquer acesso direto é negado por padrão.

-- RPC para checar se um email existe nos profiles (sem expor a tabela)
CREATE OR REPLACE FUNCTION public.user_exists_by_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = lower(_email));
$$;

GRANT EXECUTE ON FUNCTION public.user_exists_by_email(text) TO anon, authenticated;
