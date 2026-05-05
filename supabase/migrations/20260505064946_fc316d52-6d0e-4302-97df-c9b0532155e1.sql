
-- Fix the view to use security invoker (Postgres 15+)
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS
SELECT 
  id, name, avatar_url, bio, tier, banned, last_seen, created_at, updated_at,
  CASE WHEN id = auth.uid() OR public.is_admin_like(auth.uid()) THEN email ELSE NULL END AS email
FROM public.profiles;

-- Revoke remaining anon-callable security definer functions
REVOKE EXECUTE ON FUNCTION public.notify_new_post() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_comment_reply() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon;
