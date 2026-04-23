
-- ============================================
-- 1. Add last_seen to profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- ============================================
-- 2. Conversations table
-- ============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_users_sorted CHECK (user1_id < user2_id),
  CONSTRAINT conversations_unique_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX idx_conversations_user1 ON public.conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON public.conversations(user2_id);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Messages table
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  seen BOOLEAN NOT NULL DEFAULT false,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT messages_has_content CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Message reads table (unread tracking)
-- ============================================
CREATE TABLE public.message_reads (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Helper functions
-- ============================================
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv_id UUID, _uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv_id AND (user1_id = _uid OR user2_id = _uid)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _u1 UUID;
  _u2 UUID;
  _conv_id UUID;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _me = _other_user THEN
    RAISE EXCEPTION 'Cannot start conversation with yourself';
  END IF;

  -- normalize ordering
  IF _me < _other_user THEN
    _u1 := _me; _u2 := _other_user;
  ELSE
    _u1 := _other_user; _u2 := _me;
  END IF;

  SELECT id INTO _conv_id FROM public.conversations
  WHERE user1_id = _u1 AND user2_id = _u2;

  IF _conv_id IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id)
    VALUES (_u1, _u2)
    RETURNING id INTO _conv_id;
  END IF;

  RETURN _conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_conversation_member(_conv_id, _me) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  INSERT INTO public.message_reads (conversation_id, user_id, last_read_at)
  VALUES (_conv_id, _me, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = now();

  -- Mark messages as seen for messages NOT sent by me
  UPDATE public.messages
  SET seen = true, seen_at = now()
  WHERE conversation_id = _conv_id
    AND sender_id <> _me
    AND seen = false;
END;
$$;

-- Auto-update conversation last_message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = COALESCE(NEW.content, '📷 Image'),
      last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Notify recipient on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recipient UUID;
  _sender_name TEXT;
BEGIN
  SELECT CASE WHEN c.user1_id = NEW.sender_id THEN c.user2_id ELSE c.user1_id END
  INTO _recipient
  FROM public.conversations c WHERE c.id = NEW.conversation_id;

  IF _recipient IS NULL THEN RETURN NEW; END IF;

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
$$;

CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- ============================================
-- 6. RLS Policies — conversations
-- ============================================
CREATE POLICY "members or admin can view conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  user1_id = auth.uid()
  OR user2_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "members can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "admins can delete conversations"
ON public.conversations FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- INSERT happens via get_or_create_conversation RPC (SECURITY DEFINER), no INSERT policy needed.

-- ============================================
-- 7. RLS Policies — messages
-- ============================================
CREATE POLICY "members or admin can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  public.is_conversation_member(conversation_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "members can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_member(conversation_id, auth.uid())
  AND NOT public.current_user_banned()
);

CREATE POLICY "receiver can mark seen"
ON public.messages FOR UPDATE
TO authenticated
USING (
  public.is_conversation_member(conversation_id, auth.uid())
  AND sender_id <> auth.uid()
);

CREATE POLICY "sender or admin can delete messages"
ON public.messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Soft-delete via UPDATE deleted_at — allow sender or admin
CREATE POLICY "sender or admin can soft-delete"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 8. RLS Policies — message_reads
-- ============================================
CREATE POLICY "users manage own reads"
ON public.message_reads FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 9. Realtime
-- ============================================
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- 10. Storage bucket: chat-images
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "users upload own chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "users update own chat images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "users delete own chat images or admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);
