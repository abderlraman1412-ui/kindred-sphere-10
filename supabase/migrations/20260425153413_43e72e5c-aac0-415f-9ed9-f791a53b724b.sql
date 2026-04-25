CREATE OR REPLACE FUNCTION public.notify_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT p.id, 'new_post', 'A new ' || NEW.type::text || ' post is available', '/post/' || NEW.id
  FROM public.profiles p
  WHERE p.banned = false
    AND public.tier_rank(p.tier) >= public.tier_rank(NEW.visibility)
    AND p.id <> NEW.author_id
    AND EXISTS (
      SELECT 1
      FROM auth.users au
      WHERE au.id = p.id
    );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parent_user UUID;
  replier_name TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id INTO parent_user FROM public.comments WHERE id = NEW.parent_id;

  IF parent_user IS NULL OR parent_user = NEW.user_id THEN RETURN NEW; END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = parent_user) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO replier_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (parent_user, 'reply', COALESCE(replier_name,'Someone') || ' replied to your comment', '/post/' || NEW.post_id);
  RETURN NEW;
END;
$function$;