-- 1) Extend post_type enum with 'rating'
ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'rating';

-- 2) Ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_post_id ON public.ratings(post_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON public.ratings(user_id);

-- 3) RLS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings readable by authenticated"
  ON public.ratings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users insert own rating"
  ON public.ratings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.current_user_banned());

CREATE POLICY "users update own rating"
  ON public.ratings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own rating or admin"
  ON public.ratings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) updated_at trigger
CREATE TRIGGER trg_ratings_updated
  BEFORE UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();