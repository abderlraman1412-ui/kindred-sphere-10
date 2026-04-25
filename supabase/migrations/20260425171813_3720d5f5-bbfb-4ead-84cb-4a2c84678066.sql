-- Create favorite_reels table
CREATE TABLE public.favorite_reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Index for fast lookups by user
CREATE INDEX idx_favorite_reels_user ON public.favorite_reels(user_id);
CREATE INDEX idx_favorite_reels_post ON public.favorite_reels(post_id);

-- Enable RLS
ALTER TABLE public.favorite_reels ENABLE ROW LEVEL SECURITY;

-- Users can see their own favorites
CREATE POLICY "users see own favorite reels"
ON public.favorite_reels
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can add their own favorites
CREATE POLICY "users add own favorite reels"
ON public.favorite_reels
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND NOT current_user_banned());

-- Users can remove their own favorites
CREATE POLICY "users remove own favorite reels"
ON public.favorite_reels
FOR DELETE
TO authenticated
USING (user_id = auth.uid());