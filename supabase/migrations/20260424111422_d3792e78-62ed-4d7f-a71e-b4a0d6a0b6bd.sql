CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT := NULLIF(auth.jwt() ->> 'email', '');
  _name TEXT := COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    NULLIF(split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1), ''),
    'New user'
  );
  _avatar_url TEXT := NULLIF(auth.jwt() -> 'user_metadata' ->> 'avatar_url', '');
  _is_admin BOOLEAN := lower(COALESCE(_email, '')) = lower('abderlraman1412@gmail.com');
  _profile public.profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email, name, avatar_url, tier)
  VALUES (
    _uid,
    _email,
    _name,
    _avatar_url,
    CASE WHEN _is_admin THEN 'vip'::public.account_tier ELSE 'normal'::public.account_tier END
  )
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(EXCLUDED.email, public.profiles.email)
  RETURNING * INTO _profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, CASE WHEN _is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;