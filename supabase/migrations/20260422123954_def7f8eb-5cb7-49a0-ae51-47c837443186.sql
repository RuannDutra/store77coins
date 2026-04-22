UPDATE auth.users
SET encrypted_password = crypt('267089rdN$', gen_salt('bf')),
    updated_at = now()
WHERE id = (SELECT id FROM public.profiles WHERE username = 'RuanXisL' LIMIT 1);