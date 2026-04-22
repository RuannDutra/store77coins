
-- RPC para buscar nome de usuário com segurança (sem expor profiles inteira)
CREATE OR REPLACE FUNCTION public.get_username_by_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT username FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_username_by_id(uuid) TO authenticated;

-- RPC para criar código de reset (chamada via edge function com service role,
-- mas também deixamos accessible para edge fn convenience)
CREATE OR REPLACE FUNCTION public.create_password_reset_code(_email text)
RETURNS TABLE(code text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _code text;
BEGIN
  SELECT id INTO _uid FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _code := lpad((floor(random() * 10000))::int::text, 4, '0');

  -- Invalida códigos anteriores
  UPDATE public.password_reset_codes SET used = true WHERE user_id = _uid AND used = false;

  INSERT INTO public.password_reset_codes (user_id, email, code)
  VALUES (_uid, _email, _code);

  RETURN QUERY SELECT _code, _uid;
END;
$$;

-- RPC para verificar código
CREATE OR REPLACE FUNCTION public.verify_reset_code(_email text, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  SELECT user_id INTO _uid
  FROM public.password_reset_codes
  WHERE lower(email) = lower(_email)
    AND code = _code
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN _uid;
END;
$$;

-- RPC para consumir código (marca como usado)
CREATE OR REPLACE FUNCTION public.consume_reset_code(_email text, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  UPDATE public.password_reset_codes
  SET used = true
  WHERE lower(email) = lower(_email)
    AND code = _code
    AND used = false
    AND expires_at > now()
  RETURNING user_id INTO _uid;

  RETURN _uid;
END;
$$;

-- Não dar grants para anon/authenticated nessas RPCs sensíveis — só edge function (service role) chama
REVOKE ALL ON FUNCTION public.create_password_reset_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_reset_code(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_reset_code(text, text) FROM PUBLIC, anon, authenticated;
