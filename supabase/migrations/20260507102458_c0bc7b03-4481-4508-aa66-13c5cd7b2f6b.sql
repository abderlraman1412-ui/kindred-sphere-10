
-- Add gender column to profiles
ALTER TABLE public.profiles ADD COLUMN gender text CHECK (gender IN ('male', 'female'));

-- Update ensure_my_profile to accept gender
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT := NULLIF(auth.jwt() ->> 'email', '');
  _name TEXT := COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    NULLIF(split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1), ''),
    'New user'
  );
  _avatar_url TEXT := NULLIF(auth.jwt() -> 'user_metadata' ->> 'avatar_url', '');
  _gender TEXT := NULLIF(auth.jwt() -> 'user_metadata' ->> 'gender', '');
  _is_admin BOOLEAN := lower(COALESCE(_email, '')) = lower('abderlraman1412@gmail.com');
  _profile public.profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email, name, avatar_url, tier, gender)
  VALUES (
    _uid,
    _email,
    _name,
    _avatar_url,
    CASE WHEN _is_admin THEN 'vip'::public.account_tier ELSE 'normal'::public.account_tier END,
    _gender
  )
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(EXCLUDED.email, public.profiles.email),
      gender = COALESCE(EXCLUDED.gender, public.profiles.gender)
  RETURNING * INTO _profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, CASE WHEN _is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _profile;
END;
$function$;

-- Update handle_new_user to include gender
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_email CONSTANT TEXT := 'abderlraman1412@gmail.com';
  is_admin BOOLEAN := lower(NEW.email) = lower(admin_email);
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, tier, gender)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE WHEN is_admin THEN 'vip'::public.account_tier ELSE 'normal'::public.account_tier END,
    NEW.raw_user_meta_data ->> 'gender'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
