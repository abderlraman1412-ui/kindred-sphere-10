ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_reel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS posts_reels_idx
  ON public.posts (is_reel, featured DESC, created_at DESC)
  WHERE is_reel = true;