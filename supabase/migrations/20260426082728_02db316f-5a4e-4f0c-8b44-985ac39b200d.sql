
-- Add 'poll' to post_type enum
ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'poll';

-- Poll options table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poll_options_post ON public.poll_options(post_id);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poll options readable by authenticated"
  ON public.poll_options FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins insert poll options"
  ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update poll options"
  ON public.poll_options FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete poll options"
  ON public.poll_options FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Poll votes table
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_post ON public.poll_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.poll_votes(option_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poll votes readable by authenticated"
  ON public.poll_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "users insert own poll vote"
  ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.current_user_banned());

CREATE POLICY "users update own poll vote"
  ON public.poll_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own poll vote or admin"
  ON public.poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger for votes
CREATE TRIGGER trg_poll_votes_updated
  BEFORE UPDATE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
