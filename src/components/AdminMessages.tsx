import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { formatDistanceToNow } from "date-fns";

interface AdminConv {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  last_message_at: string | null;
  user1: { id: string; name: string; avatar_url: string | null } | null;
  user2: { id: string; name: string; avatar_url: string | null } | null;
}

export const AdminMessages = () => {
  const [convs, setConvs] = useState<AdminConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AdminConv | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: cs } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (!cs) {
      setConvs([]);
      setLoading(false);
      return;
    }

    const ids = Array.from(new Set(cs.flatMap((c) => [c.user1_id, c.user2_id])));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,name,avatar_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    setConvs(cs.map((c) => ({
      ...c,
      user1: map.get(c.user1_id) ?? null,
      user2: map.get(c.user2_id) ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (active) {
    const other = active.user2 ?? { id: active.user2_id, name: "User", avatar_url: null };
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to all conversations
        </Button>
        <Card className="h-[70vh] overflow-hidden">
          <ChatWindow
            conversationId={active.id}
            other={other}
            onlineIds={new Set()}
            readOnly
          />
        </Card>
      </div>
    );
  }

  return (
    <Card className="divide-y">
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : convs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 opacity-30" />
          <p className="text-sm">No conversations yet</p>
        </div>
      ) : (
        convs.map((c) => {
          const a = c.user1; const b = c.user2;
          return (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex -space-x-2">
                <Avatar className="h-9 w-9 ring-2 ring-surface">
                  <AvatarImage src={a?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{a?.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <Avatar className="h-9 w-9 ring-2 ring-surface">
                  <AvatarImage src={b?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{b?.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {a?.name ?? "Unknown"} <span className="text-muted-foreground">↔</span> {b?.name ?? "Unknown"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.last_message ?? "No messages"}</p>
              </div>
              {c.last_message_at && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                </span>
              )}
            </button>
          );
        })
      )}
    </Card>
  );
};
