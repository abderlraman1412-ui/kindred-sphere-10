import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ConversationListItem } from "@/hooks/useConversations";
import { OnlineDot } from "./OnlineDot";
import { cn } from "@/lib/utils";
import { isAIUser } from "@/lib/aiAssistant";

interface Props {
  items: ConversationListItem[];
  loading: boolean;
  activeId: string | null;
  onlineIds: Set<string>;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onChatWithAI?: () => void;
}

export const ConversationList = ({ items, loading, activeId, onlineIds, onSelect, onNewChat, onChatWithAI }: Props) => {
  // Sort: AI first, then by last_message_at (already sorted by hook)
  const sorted = [...items].sort((a, b) => {
    if (isAIUser(a.other.id)) return -1;
    if (isAIUser(b.other.id)) return 1;
    return 0;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h2 className="text-base font-semibold">Chats</h2>
        <div className="flex gap-1">
          {onChatWithAI && (
            <Button size="sm" variant="outline" onClick={onChatWithAI} className="h-8" aria-label="Chat with AI">
              <Sparkles className="mr-1 h-4 w-4 text-primary" /> AI
            </Button>
          )}
          <Button size="sm" onClick={onNewChat} className="h-8">
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">No conversations yet</p>
            <Button size="sm" variant="outline" onClick={onNewChat}>Start a chat</Button>
          </div>
        ) : (
          sorted.map((c) => {
            const isAI = isAIUser(c.other.id);
            const initials = c.other.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";
            const online = isAI ? true : onlineIds.has(c.other.id);
            const active = activeId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/60",
                  active && "bg-accent",
                  isAI && "bg-gradient-to-r from-primary/5 to-transparent",
                )}
              >
                <div className="relative">
                  <Avatar className={cn("h-11 w-11", isAI && "ring-2 ring-primary/40")}>
                    <AvatarImage src={c.other.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <OnlineDot online={online} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1 truncate text-sm font-medium">
                      {c.other.name}
                      {isAI && <Sparkles className="h-3 w-3 shrink-0 text-primary" />}
                    </p>
                    {c.last_message_at && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_message ?? (isAI ? "Ask me anything ✨" : "No messages yet")}
                    </p>
                    {c.unread > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
