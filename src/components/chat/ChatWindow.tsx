import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { OnlineDot } from "./OnlineDot";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  conversationId: string;
  other: { id: string; name: string; avatar_url: string | null };
  onlineIds: Set<string>;
  onBack?: () => void;
  readOnly?: boolean;
}

export const ChatWindow = ({ conversationId, other, onlineIds, onBack, readOnly }: Props) => {
  const { user, isAdmin } = useAuth();
  const { messages, loading, hasMore, loadMore } = useMessages(conversationId);
  const { otherTyping, sendTyping } = useTypingIndicator(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);

  // Fetch other user's last_seen
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("last_seen").eq("id", other.id).maybeSingle();
      setOtherLastSeen(data?.last_seen ?? null);
    })();
  }, [other.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, otherTyping]);

  const handleScroll = () => {
    if (!scrollRef.current || !hasMore) return;
    if (scrollRef.current.scrollTop < 60) {
      void loadMore();
    }
  };

  const send = async ({ content, image_url }: { content?: string; image_url?: string }) => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content ?? null,
      image_url: image_url ?? null,
    });
    if (error) toast.error(error.message);
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const initials = other.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";
  const online = onlineIds.has(other.id);
  const presenceText = online
    ? "Online"
    : otherLastSeen
      ? `Last seen ${formatDistanceToNow(new Date(otherLastSeen), { addSuffix: true })}`
      : "Offline";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-surface px-3 py-2.5 sm:px-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="relative">
          <Avatar className="h-9 w-9">
            <AvatarImage src={other.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <OnlineDot online={online} className="absolute -bottom-0.5 -right-0.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{other.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {otherTyping ? "typing…" : presenceText}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto bg-background px-3 py-4 sm:px-4"
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No messages yet. Say hi 👋</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-2">
                <Button size="sm" variant="ghost" onClick={() => void loadMore()}>Load older</Button>
              </div>
            )}
            {messages.map((m) => {
              const isOwn = m.sender_id === user?.id;
              const canDelete = (isOwn || isAdmin) && !readOnly;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={isOwn}
                  canDelete={canDelete}
                  onDelete={canDelete ? deleteMessage : undefined}
                />
              );
            })}
            {otherTyping && (
              <div className="flex items-center gap-1 pl-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      {!readOnly && (
        <MessageInput conversationId={conversationId} onSend={send} onTyping={sendTyping} />
      )}
    </div>
  );
};
