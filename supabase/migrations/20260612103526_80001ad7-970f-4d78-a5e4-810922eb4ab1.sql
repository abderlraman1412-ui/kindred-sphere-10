
-- 1) Restrict message UPDATE to only modify deleted_at (soft-delete), admin can bypass via separate policy
DROP POLICY IF EXISTS "sender or admin can soft-delete" ON public.messages;

CREATE POLICY "sender can soft-delete own message"
ON public.messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (
  sender_id = auth.uid()
  AND content IS NOT DISTINCT FROM (SELECT m.content FROM public.messages m WHERE m.id = messages.id)
  AND image_url IS NOT DISTINCT FROM (SELECT m.image_url FROM public.messages m WHERE m.id = messages.id)
  AND sender_id IS NOT DISTINCT FROM (SELECT m.sender_id FROM public.messages m WHERE m.id = messages.id)
  AND conversation_id IS NOT DISTINCT FROM (SELECT m.conversation_id FROM public.messages m WHERE m.id = messages.id)
  AND created_at IS NOT DISTINCT FROM (SELECT m.created_at FROM public.messages m WHERE m.id = messages.id)
);

CREATE POLICY "admin can update messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (public.is_admin_like(auth.uid()))
WITH CHECK (public.is_admin_like(auth.uid()));

-- 2) Hide email column from non-owners. Revoke column-level SELECT on email for authenticated/anon.
REVOKE SELECT (email) ON public.profiles FROM authenticated;
REVOKE SELECT (email) ON public.profiles FROM anon;
-- Grant all other columns explicitly to authenticated
GRANT SELECT (id, name, avatar_url, bio, tier, banned, gender, last_seen, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT SELECT (id, name, avatar_url, tier)
  ON public.profiles TO anon;

-- 3) Tighten chat-images SELECT: only uploader or conversation member or admin
DROP POLICY IF EXISTS "chat images authenticated read" ON storage.objects;

CREATE POLICY "chat images members read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_admin_like(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  )
);

-- 4) Hide AI rate-limit configuration from anon users (branding stays public)
REVOKE SELECT (ai_enabled, ai_daily_limit) ON public.site_settings FROM anon;
