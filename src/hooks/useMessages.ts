import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  seen: boolean;
  seen_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

const PAGE_SIZE = 30;

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const oldestRef = useRef<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const list = ((data ?? []) as ChatMessage[]).slice().reverse();
    setMessages(list);
    oldestRef.current = list[0]?.created_at ?? null;
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setLoading(false);
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !oldestRef.current || !hasMore) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("created_at", oldestRef.current)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const older = ((data ?? []) as ChatMessage[]).slice().reverse();
    if (older.length === 0) {
      setHasMore(false);
      return;
    }
    oldestRef.current = older[0].created_at;
    setMessages((prev) => [...older, ...prev]);
    if (older.length < PAGE_SIZE) setHasMore(false);
  }, [conversationId, hasMore]);

  useEffect(() => {
    if (conversationId) {
      void loadInitial();
    } else {
      setMessages([]);
    }
  }, [conversationId, loadInitial]);

  // Subscribe to new + updated messages for this conversation
  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel("chat-msgs-" + conversationId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === (payload.new as ChatMessage).id)) return prev;
            return [...prev, payload.new as ChatMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === (payload.new as ChatMessage).id ? (payload.new as ChatMessage) : m)));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  // Mark conversation as read when opened or new messages arrive
  useEffect(() => {
    if (!conversationId || !user) return;
    void supabase.rpc("mark_conversation_read", { _conv_id: conversationId });
  }, [conversationId, user?.id, messages.length]);

  return { messages, loading, hasMore, loadMore };
};
