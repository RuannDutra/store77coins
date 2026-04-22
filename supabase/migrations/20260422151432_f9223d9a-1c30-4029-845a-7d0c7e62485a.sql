
-- Política explícita: ninguém via cliente pode acessar diretamente
CREATE POLICY "deny_all_client_access"
ON public.password_reset_codes
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
