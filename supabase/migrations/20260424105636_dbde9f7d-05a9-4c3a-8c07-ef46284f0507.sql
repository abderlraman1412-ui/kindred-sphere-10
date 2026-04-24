CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _recipient UUID;
  _sender_name TEXT;
  AI_USER_ID CONSTANT UUID := '00000000-0000-0000-0000-00000000a1a1';
BEGIN
  SELECT CASE WHEN c.user1_id = NEW.sender_id THEN c.user2_id ELSE c.user1_id END
  INTO _recipient
  FROM public.conversations c WHERE c.id = NEW.conversation_id;

  IF _recipient IS NULL THEN RETURN NEW; END IF;
  -- Don't notify the AI user (it has no auth.users row)
  IF _recipient = AI_USER_ID THEN RETURN NEW; END IF;
  -- Only notify if recipient exists in auth.users (defensive against synthetic users)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _recipient) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    _recipient,
    'message',
    COALESCE(_sender_name, 'Someone') || ': ' || COALESCE(LEFT(NEW.content, 80), '📷 Image'),
    '/messages?c=' || NEW.conversation_id::text
  );
  RETURN NEW;
END;
$function$;