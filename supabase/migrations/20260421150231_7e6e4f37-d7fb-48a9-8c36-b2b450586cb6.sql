
CREATE OR REPLACE FUNCTION public.tier_rank(t public.account_tier)
RETURNS INT LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE t
    WHEN 'normal'  THEN 1
    WHEN 'premium' THEN 2
    WHEN 'pro'     THEN 3
    WHEN 'vip'     THEN 4
  END
$$;
