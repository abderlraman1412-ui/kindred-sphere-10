
-- Drop existing insert policy
DROP POLICY IF EXISTS "admins insert posts" ON public.posts;

-- New insert policy: admins OR VIP users can create posts
CREATE POLICY "admins or vip insert posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    is_admin_like(auth.uid())
    OR current_user_tier() = 'vip'::account_tier
  )
);
