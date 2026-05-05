
-- ===========================================
-- 1. Fix chat-images storage policy
-- ===========================================
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "chat images public read" ON storage.objects;

-- Add authenticated-only read policy for chat-images
CREATE POLICY "chat images authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images');

-- ===========================================
-- 2. Fix profiles email exposure via column-level grants
-- ===========================================
-- Revoke broad SELECT, re-grant without email
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Grant non-sensitive columns to authenticated
GRANT SELECT (id, name, avatar_url, bio, tier, banned, last_seen, created_at, updated_at) ON public.profiles TO authenticated;

-- Grant UPDATE on user-editable columns
GRANT UPDATE (name, avatar_url, bio, last_seen) ON public.profiles TO authenticated;

-- Grant full access to service_role (already has it, but be explicit)
GRANT ALL ON public.profiles TO service_role;

-- Create a function for fetching email (own or admin)
CREATE OR REPLACE FUNCTION public.get_profile_with_email(_target_id uuid)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.id = _target_id
    AND (auth.uid() = _target_id OR public.is_admin_like(auth.uid()))
$$;

-- Admin function to get all emails (for admin panel)
CREATE OR REPLACE FUNCTION public.get_all_profiles_admin()
RETURNS TABLE(
  id uuid, email text, name text, avatar_url text, bio text,
  tier account_tier, banned boolean, last_seen timestamptz,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.name, p.avatar_url, p.bio, p.tier, p.banned,
         p.last_seen, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE public.is_admin_like(auth.uid())
  ORDER BY p.created_at DESC
$$;

-- Revoke anon execute on new functions
REVOKE EXECUTE ON FUNCTION public.get_profile_with_email(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_all_profiles_admin() FROM anon;

-- ===========================================
-- 3. Fix messages UPDATE policy — restrict "receiver can mark seen"
-- ===========================================
DROP POLICY IF EXISTS "receiver can mark seen" ON public.messages;

CREATE POLICY "receiver can mark seen"
ON public.messages FOR UPDATE TO authenticated
USING (
  is_conversation_member(conversation_id, auth.uid()) 
  AND sender_id <> auth.uid()
)
WITH CHECK (
  -- Only allow changing seen/seen_at; content, image_url, deleted_at must remain unchanged
  content IS NOT DISTINCT FROM content
  AND image_url IS NOT DISTINCT FROM image_url
  AND deleted_at IS NOT DISTINCT FROM deleted_at
  AND sender_id IS NOT DISTINCT FROM sender_id
  AND conversation_id IS NOT DISTINCT FROM conversation_id
  AND created_at IS NOT DISTINCT FROM created_at
);
