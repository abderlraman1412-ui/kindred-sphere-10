
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email CONSTANT TEXT := 'abderlraman1412@gmail.com';
  is_admin BOOLEAN := lower(NEW.email) = lower(admin_email);
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE WHEN is_admin THEN 'vip'::public.account_tier ELSE 'normal'::public.account_tier END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
