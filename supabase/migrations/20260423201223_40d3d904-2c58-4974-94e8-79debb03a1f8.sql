
-- Drop FK so we can have synthetic profiles (AI bot)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

INSERT INTO public.profiles (id, name, email, bio, tier, banned, avatar_url)
VALUES (
  '00000000-0000-0000-0000-00000000a1a1',
  'TAIPING AI',
  null,
  'Your AI assistant. Ask me anything!',
  'vip',
  false,
  null
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  bio = EXCLUDED.bio,
  tier = EXCLUDED.tier;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER NOT NULL DEFAULT 20;

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own ai usage" ON public.ai_usage;
CREATE POLICY "users see own ai usage"
  ON public.ai_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.ai_remaining_today()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit INTEGER;
  _used INTEGER;
BEGIN
  SELECT ai_daily_limit INTO _limit FROM public.site_settings WHERE id = true;
  IF _limit IS NULL THEN _limit := 20; END IF;
  SELECT COALESCE(count, 0) INTO _used FROM public.ai_usage
    WHERE user_id = auth.uid() AND day = CURRENT_DATE;
  RETURN GREATEST(_limit - COALESCE(_used, 0), 0);
END;
$$;
