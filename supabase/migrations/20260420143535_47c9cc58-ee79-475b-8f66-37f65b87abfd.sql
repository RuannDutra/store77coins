-- Fix search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Restringir listagem do bucket: só admin pode listar; leitura pública por URL continua via bucket público
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;

CREATE POLICY "Admins list product images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));