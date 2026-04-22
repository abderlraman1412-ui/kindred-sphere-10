-- Allow authenticated users to see all user roles (read-only).
-- This is needed so that admin badges can be displayed publicly next to admin
-- users on posts, comments, and profiles. Roles are display metadata, not secrets.
CREATE POLICY "roles publicly readable by authenticated"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);