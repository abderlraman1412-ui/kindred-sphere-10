import { format } from "date-fns";
import { Check, CheckCheck, Trash2, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/hooks/useMessages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  fromAI?: boolean;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}

export const MessageBubble = ({ message, isOwn, fromAI, canDelete, onDelete }: Props) => {
  const deleted = !!message.deleted_at;

  return (
    <div className={cn("group flex w-full gap-2", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[78%] flex-col gap-1 sm:max-w-[65%]", isOwn ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative rounded-2xl px-3 py-2 text-sm shadow-sm transition-all",
            isOwn
              ? "rounded-br-md bg-primary text-primary-foreground"
              : fromAI
                ? "rounded-bl-md border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/40 text-foreground"
                : "rounded-bl-md bg-muted text-foreground",
            deleted && "italic opacity-60",
          )}
        >
          {fromAI && !deleted && (
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3 w-3" />
              TAIPING AI
            </div>
          )}
          {deleted ? (
            <span>Message deleted</span>
          ) : (
            <>
              {message.image_url && (
                <a href={message.image_url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={message.image_url}
                    alt="Sent image"
                    className="mb-1 max-h-72 max-w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                </a>
              )}
              {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
            </>
          )}
        </div>
        <div className={cn("flex items-center gap-1 px-1 text-[10px] text-muted-foreground", isOwn ? "flex-row-reverse" : "")}>
          <span>{format(new Date(message.created_at), "p")}</span>
          {isOwn && !deleted && (
            message.seen ? (
              <CheckCheck className="h-3 w-3 text-primary" />
            ) : (
              <Check className="h-3 w-3" />
            )
          )}
          {canDelete && !deleted && onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onDelete(message.id)}
              aria-label="Delete message"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
