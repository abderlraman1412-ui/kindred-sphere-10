

# Real-Time Messaging System (WhatsApp-style)

I'll build a complete 1-to-1 chat system for TAIPING MEDIA with real-time messaging, presence, typing indicators, image sharing, and admin oversight.

## What You'll Get

**A new `/messages` page** accessible from the navbar, with:
- Left sidebar: list of recent conversations with last message, unread badge, and online dots
- Right pane: active chat window with bubbles, timestamps, seen/delivered ticks, image previews
- "New chat" button to start a conversation by searching users
- Mobile: full-screen chat view with back button to return to list
- Light & dark mode support throughout

## Database Changes

**New tables:**

1. **`conversations`**
   - `id`, `user1_id`, `user2_id` (always stored sorted to prevent duplicates), `last_message`, `last_message_at`, `created_at`
   - Unique constraint on `(user1_id, user2_id)`

2. **`messages`**
   - `id`, `conversation_id`, `sender_id`, `content`, `image_url`, `seen`, `seen_at`, `created_at`, `deleted_at`

3. **`message_reads`** (tracks unread counts per user per conversation)
   - `conversation_id`, `user_id`, `last_read_at`

4. **`typing_indicators`** (ephemeral, used via Realtime presence — no row writes needed; using Supabase Realtime broadcast/presence channels instead)

**Profile additions:**
- Add `last_seen TIMESTAMPTZ` column to `profiles` (for online/offline status)

**Storage:**
- New public bucket `chat-images` for inline message images (admin + sender can upload to their own folder)

**Helper functions (SECURITY DEFINER):**
- `get_or_create_conversation(other_user_id UUID)` — returns conversation id, creates if missing, normalizes user1/user2 ordering
- `mark_conversation_read(conv_id UUID)` — updates `message_reads.last_read_at`
- `is_conversation_member(conv_id UUID, uid UUID)` — used in RLS to avoid recursion

**RLS policies:**
- `conversations`: SELECT/UPDATE only if user is member OR admin; INSERT via RPC
- `messages`: SELECT only if member of conversation OR admin; INSERT only if sender = auth.uid() AND member of conversation; UPDATE (for `seen`) only by receiver; DELETE by sender or admin (soft delete via `deleted_at`)
- `message_reads`: user manages own rows
- `profiles.last_seen`: writable only by self

**Realtime:**
- Enable `REPLICA IDENTITY FULL` and add `messages`, `conversations` to `supabase_realtime` publication

## Frontend Architecture

**New files:**
- `src/pages/Messages.tsx` — main chat page with split layout
- `src/components/chat/ConversationList.tsx` — left sidebar with recent chats + unread badges
- `src/components/chat/ChatWindow.tsx` — right pane with messages, input, typing indicator
- `src/components/chat/MessageBubble.tsx` — single message with timestamp + seen ticks
- `src/components/chat/MessageInput.tsx` — text input + emoji picker + image upload button
- `src/components/chat/NewChatDialog.tsx` — search users to start conversation
- `src/components/chat/OnlineDot.tsx` — green/grey presence indicator
- `src/hooks/useMessages.ts` — fetch + subscribe to messages for active conversation, infinite scroll
- `src/hooks/useConversations.ts` — fetch + subscribe to conversation list
- `src/hooks/usePresence.ts` — Supabase Realtime presence channel for online users
- `src/hooks/useTypingIndicator.ts` — broadcast typing via Realtime channel
- `src/hooks/useUnreadCount.ts` — total unread count for navbar badge

**Modified files:**
- `src/App.tsx` — add `/messages` route
- `src/components/AppLayout.tsx` — add "Messages" nav link with unread badge
- `src/components/NotificationBell.tsx` — also surface new-message toasts with optional sound
- `src/pages/Admin.tsx` — add "Messages" tab listing all conversations + ability to delete messages

## Real-Time Flow

- **Messages**: subscribe to `postgres_changes` on `messages` filtered by `conversation_id` for active chat; subscribe to all conversations the user belongs to for the sidebar updates and notifications.
- **Presence (online/offline)**: use `supabase.channel('presence:global').on('presence', ...)` with `track({ user_id, online_at })`; also write `last_seen` to `profiles` on disconnect via `beforeunload`.
- **Typing**: broadcast on per-conversation channel `chat:{conversationId}` — no DB writes.
- **Seen/delivered**: when receiver opens chat, batch-update unread messages `seen = true, seen_at = now()`; sender's UI updates via realtime subscription.

## Notifications & Sound

- New message in inactive conversation → toast (using existing `sonner`) + small unread badge in nav + optional `Audio` ping (short mp3 in `/public/notification.mp3`).
- Browser tab title flashes `(N) TAIPING MEDIA` when unread.

## Admin Capabilities

In `/super-secret-admin-portal` → new "Messages" tab:
- List all conversations with both users' names + last message preview
- Click to view full thread (read-only)
- Delete any message (soft delete — sets `deleted_at`, UI shows "Message deleted")

## Security Summary

- Users only see conversations where they're `user1_id` or `user2_id`
- Messages readable only by conversation members + admins
- Image uploads scoped to `chat-images/{user_id}/...`
- All mutations validated server-side via RLS, not just client checks
- Soft deletes preserve audit trail for admin

## Mobile Responsive

- `<768px`: show conversation list OR chat window (not both); back button returns to list
- `≥768px`: split view (1/3 list, 2/3 chat)
- Input bar sticks to bottom; messages auto-scroll on new message

## Out of Scope (can add later)

- Group chats (only 1-to-1 for now)
- Voice/video calls
- Message reactions or replies
- End-to-end encryption (messages are encrypted in transit + at rest by Supabase, but readable by admin per your requirement)

