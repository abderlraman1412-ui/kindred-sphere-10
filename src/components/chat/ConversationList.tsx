import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ConversationListItem } from "@/hooks/useConversations";
import { OnlineDot } from "./OnlineDot";
import { cn } from "@/lib/utils";

interface Props {
  items: ConversationListItem[];
  loading: boolean;
  activeId: string | null;
  onlineIds: Set<string>;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export const ConversationList = ({ items, loading, activeId, onlineIds, onSelect, onNewChat }: Props) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h2 className="text-base font-semibold">Chats</h2>
        <Button size="sm" onClick={onNewChat} className="h-8">
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">No conversations yet</p>
            <Button size="sm" variant="outline" onClick={onNewChat}>Start a chat</Button>
          </div>
        ) : (
          items.map((c) => {
            const initials = c.other.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";
            const online = onlineIds.has(c.other.id);
            const active = activeId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/60",
                  active && "bg-accent",
                )}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={c.other.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <OnlineDot online={online} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.other.name}</p>
                    {c.last_message_at && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_message ?? "No messages yet"}
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
