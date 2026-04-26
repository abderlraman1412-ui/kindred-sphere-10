-- Helper: returns true for admin OR assistant_admin
CREATE OR REPLACE FUNCTION public.is_admin_like(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'assistant_admin'::public.app_role)
  )
$$;

-- Helper: is this user the main admin (by email)?
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND lower(email) = lower('abderlraman1412@gmail.com')
  )
$$;

-- ===== POSTS =====
DROP POLICY IF EXISTS "admins insert posts" ON public.posts;
CREATE POLICY "admins insert posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()) AND author_id = auth.uid());

DROP POLICY IF EXISTS "admins update posts" ON public.posts;
CREATE POLICY "admins update posts" ON public.posts
  FOR UPDATE TO authenticated
  USING (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "admins delete posts" ON public.posts;
CREATE POLICY "admins delete posts" ON public.posts
  FOR DELETE TO authenticated
  USING (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "posts visible by tier" ON public.posts;
CREATE POLICY "posts visible by tier" ON public.posts
  FOR SELECT TO authenticated
  USING (
    (NOT current_user_banned())
    AND (public.is_admin_like(auth.uid()) OR (tier_rank(current_user_tier()) >= tier_rank(visibility)))
  );

-- ===== COMMENTS =====
DROP POLICY IF EXISTS "users delete own comment or admin" ON public.comments;
CREATE POLICY "users delete own comment or admin" ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_like(auth.uid()));

-- ===== POLL OPTIONS =====
DROP POLICY IF EXISTS "admins insert poll options" ON public.poll_options;
CREATE POLICY "admins insert poll options" ON public.poll_options
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "admins update poll options" ON public.poll_options;
CREATE POLICY "admins update poll options" ON public.poll_options
  FOR UPDATE TO authenticated
  USING (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "admins delete poll options" ON public.poll_options;
CREATE POLICY "admins delete poll options" ON public.poll_options
  FOR DELETE TO authenticated
  USING (public.is_admin_like(auth.uid()));

-- ===== POLL VOTES =====
DROP POLICY IF EXISTS "users delete own poll vote or admin" ON public.poll_votes;
CREATE POLICY "users delete own poll vote or admin" ON public.poll_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_like(auth.uid()));

-- ===== RATINGS =====
DROP POLICY IF EXISTS "users delete own rating or admin" ON public.ratings;
CREATE POLICY "users delete own rating or admin" ON public.ratings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_like(auth.uid()));

-- ===== AI USAGE =====
DROP POLICY IF EXISTS "users see own ai usage" ON public.ai_usage;
CREATE POLICY "users see own ai usage" ON public.ai_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_like(auth.uid()));

-- ===== CONVERSATIONS =====
DROP POLICY IF EXISTS "members or admin can view conversations" ON public.conversations;
CREATE POLICY "members or admin can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid() OR public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "admins can delete conversations" ON public.conversations;
CREATE POLICY "admins can delete conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (public.is_admin_like(auth.uid()));

-- ===== MESSAGES =====
DROP POLICY IF EXISTS "members or admin can view messages" ON public.messages;
CREATE POLICY "members or admin can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (is_conversation_member(conversation_id, auth.uid()) OR public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "sender or admin can delete messages" ON public.messages;
CREATE POLICY "sender or admin can delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "sender or admin can soft-delete" ON public.messages;
CREATE POLICY "sender or admin can soft-delete" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.is_admin_like(auth.uid()));

-- ===== PROFILES =====
-- Replace "admins can update any profile": allow admin-like, but block assistant_admin from touching the main admin
DROP POLICY IF EXISTS "admins can update any profile" ON public.profiles;
CREATE POLICY "admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_like(auth.uid())
    AND NOT (
      public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
      AND public.is_main_admin(id)
    )
  );

DROP POLICY IF EXISTS "admins can delete profiles" ON public.profiles;
CREATE POLICY "admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_admin_like(auth.uid())
    AND NOT (
      public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
      AND public.is_main_admin(id)
    )
  );

-- Update protect_profile_fields to allow admin-like to change tier/banned,
-- but still block assistant_admin from modifying the main admin's tier/banned.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.is_admin_like(auth.uid()) THEN
    -- Block assistant_admin (non-admin) from touching the main admin's tier/banned
    IF public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
       AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
       AND public.is_main_admin(NEW.id)
       AND (NEW.tier IS DISTINCT FROM OLD.tier OR NEW.banned IS DISTINCT FROM OLD.banned) THEN
      RAISE EXCEPTION 'Assistant admin cannot modify the main admin';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.tier IS DISTINCT FROM OLD.tier OR NEW.banned IS DISTINCT FROM OLD.banned THEN
    RAISE EXCEPTION 'Not allowed to change tier or banned status';
  END IF;
  RETURN NEW;
END;
$function$;

-- ===== USER ROLES =====
-- Replace blanket "admins manage roles" with admin-like, but block assistant_admin
-- from granting/revoking the 'admin' role and from touching the main admin's roles.
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

CREATE POLICY "admin like view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin_like(auth.uid()));

CREATE POLICY "admin like insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_like(auth.uid())
    AND NOT (
      public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
      AND (role = 'admin'::public.app_role OR public.is_main_admin(user_id))
    )
  );

CREATE POLICY "admin like update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_like(auth.uid())
    AND NOT (
      public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
      AND (role = 'admin'::public.app_role OR public.is_main_admin(user_id))
    )
  )
  WITH CHECK (
    public.is_admin_like(auth.uid())
    AND NOT (
      public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
      AND (role = 'admin'::public.app_role OR public.is_main_admin(user_id))
    )
  );

CREATE POLICY "admin like delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.is_admin_like(auth.uid())
    AND NOT (
      public.has_role(auth.uid(), 'assistant_admin'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
      AND (role = 'admin'::public.app_role OR public.is_main_admin(user_id))
    )
  );

-- ===== SITE SETTINGS (branding) =====
DROP POLICY IF EXISTS "admins insert branding" ON public.site_settings;
CREATE POLICY "admins insert branding" ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()));

DROP POLICY IF EXISTS "admins update branding" ON public.site_settings;
CREATE POLICY "admins update branding" ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));