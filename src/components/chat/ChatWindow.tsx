import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Sparkles, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useTTS } from "@/hooks/useTTS";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { OnlineDot } from "./OnlineDot";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { isAIUser } from "@/lib/aiAssistant";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  conversationId: string;
  other: { id: string; name: string; avatar_url: string | null };
  onlineIds: Set<string>;
  onBack?: () => void;
  readOnly?: boolean;
}

export const ChatWindow = ({ conversationId, other, onlineIds, onBack, readOnly }: Props) => {
  const { user, isAdmin, profile } = useAuth();
  const { messages, loading, hasMore, loadMore } = useMessages(conversationId);
  const { otherTyping, sendTyping } = useTypingIndicator(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const prevMsgCountRef = useRef(0);

  const isAI = isAIUser(other.id);
  const { voiceEnabled, toggleVoice, speaking, speak, stop } = useTTS(profile?.gender ?? null);

  // Fetch other user's last_seen (skip for AI)
  useEffect(() => {
    if (isAI) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("last_seen").eq("id", other.id).maybeSingle();
      setOtherLastSeen(data?.last_seen ?? null);
    })();
  }, [other.id, isAI]);

  // Auto-scroll to bottom on new messages or thinking state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, otherTyping, aiThinking]);

  // Auto-speak new AI messages when voice is enabled
  useEffect(() => {
    if (!isAI || !voiceEnabled) {
      prevMsgCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMsgCountRef.current) {
      const newMsgs = messages.slice(prevMsgCountRef.current);
      const lastAI = [...newMsgs].reverse().find((m) => isAIUser(m.sender_id) && m.content);
      if (lastAI?.content) {
        speak(lastAI.content);
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isAI, voiceEnabled, speak]);

  const handleScroll = () => {
    if (!scrollRef.current || !hasMore) return;
    if (scrollRef.current.scrollTop < 60) {
      void loadMore();
    }
  };

  const send = async ({ content, image_url }: { content?: string; image_url?: string }) => {
    if (!user) return;

    if (isAI) {
      // Route through edge function — it inserts user msg + AI reply
      if (!content?.trim()) {
        toast.error("AI doesn't accept images yet");
        return;
      }
      setAiThinking(true);
      try {
        const { data, error } = await supabase.functions.invoke("chat-ai", {
          body: { conversation_id: conversationId, message: content },
        });
        if (error) {
          // Try to extract structured error from FunctionsHttpError
          const ctx = (error as any).context;
          let msg = error.message;
          try {
            if (ctx && typeof ctx.json === "function") {
              const j = await ctx.json();
              if (j?.error) msg = j.error;
            }
          } catch { /* ignore */ }
          toast.error(msg);
        } else if (data?.error) {
          toast.error(data.error);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to reach AI");
      } finally {
        setAiThinking(false);
      }
      return;
    }

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
  const online = isAI ? true : onlineIds.has(other.id);
  const presenceText = isAI
    ? "Always online · AI assistant"
    : online
      ? "Online"
      : otherLastSeen
        ? `Last seen ${formatDistanceToNow(new Date(otherLastSeen), { addSuffix: true })}`
        : "Offline";

  const showTyping = isAI ? aiThinking : otherTyping;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 border-b bg-surface px-3 py-2.5 sm:px-4",
        isAI && "bg-gradient-to-r from-primary/5 via-surface to-surface",
      )}>
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="relative">
          <Avatar className={cn("h-9 w-9", isAI && "ring-2 ring-primary/40")}>
            <AvatarImage src={other.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <OnlineDot online={online} className="absolute -bottom-0.5 -right-0.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {other.name}
            {isAI && <Sparkles className="h-3.5 w-3.5 text-primary" />}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {showTyping ? (isAI ? "AI is typing…" : "typing…") : presenceText}
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
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            {isAI ? (
              <>
                <Sparkles className="h-12 w-12 text-primary opacity-60" />
                <p className="text-sm font-medium">Hi, I'm TAIPING AI ✨</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Ask me anything — I can help you navigate the platform, suggest content ideas, or just chat.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet. Say hi 👋</p>
            )}
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
              const fromAI = isAIUser(m.sender_id);
              const canDelete = (isOwn || isAdmin) && !readOnly;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={isOwn}
                  fromAI={fromAI}
                  canDelete={canDelete}
                  onDelete={canDelete ? deleteMessage : undefined}
                />
              );
            })}
            {showTyping && (
              <div className="flex items-center gap-1 pl-2 text-xs text-muted-foreground">
                {isAI && <Sparkles className="h-3 w-3 text-primary" />}
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
        <MessageInput
          conversationId={conversationId}
          onSend={send}
          onTyping={sendTyping}
          disableImage={isAI}
          placeholder={isAI ? "Ask TAIPING AI…" : "Type a message"}
          sending={aiThinking}
        />
      )}
    </div>
  );
};
