-- Reviews
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(comment) <= 100),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public read: only approved
CREATE POLICY "Approved reviews public read"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (approved = true OR auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Insert: only if user has an approved order for this product
CREATE POLICY "Buyers can create review"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.product_id = reviews.product_id
        AND o.status = 'approved'
    )
  );

-- Admin manages reviews (approve/delete/update)
CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Order messages (chat)
CREATE TABLE public.order_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- View: order owner or admin
CREATE POLICY "View order messages"
  ON public.order_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Insert: only if order is approved AND sender is owner or admin
CREATE POLICY "Send order messages on approved orders"
  ON public.order_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND o.status = 'approved'
        AND (o.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;

CREATE INDEX idx_reviews_product ON public.reviews(product_id) WHERE approved = true;
CREATE INDEX idx_order_messages_order ON public.order_messages(order_id, created_at);