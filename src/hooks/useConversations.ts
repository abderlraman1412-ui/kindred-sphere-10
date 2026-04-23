import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ConversationListItem {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  last_message_at: string | null;
  other: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  unread: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (!convs) {
      setItems([]);
      setLoading(false);
      return;
    }

    const otherIds = convs.map((c) => (c.user1_id === user.id ? c.user2_id : c.user1_id));
    const [{ data: profiles }, { data: reads }, { data: unreadMessages }] = await Promise.all([
      supabase.from("profiles").select("id,name,avatar_url").in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("message_reads").select("conversation_id,last_read_at").eq("user_id", user.id),
      supabase
        .from("messages")
        .select("conversation_id,sender_id,created_at")
        .in("conversation_id", convs.map((c) => c.id).length ? convs.map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"])
        .is("deleted_at", null),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const readMap = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));

    const list: ConversationListItem[] = convs.map((c) => {
      const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const lastRead = readMap.get(c.id);
      const unread = (unreadMessages ?? []).filter(
        (m) =>
          m.conversation_id === c.id &&
          m.sender_id !== user.id &&
          (!lastRead || new Date(m.created_at) > new Date(lastRead))
      ).length;
      const otherProfile = profileMap.get(otherId);
      return {
        id: c.id,
        user1_id: c.user1_id,
        user2_id: c.user2_id,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        other: {
          id: otherId,
          name: otherProfile?.name ?? "Unknown",
          avatar_url: otherProfile?.avatar_url ?? null,
        },
        unread,
      };
    });

    setItems(list);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Subscribe to conversation + message changes for live updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("conversations-list-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  return { items, loading, reload: load };
};
