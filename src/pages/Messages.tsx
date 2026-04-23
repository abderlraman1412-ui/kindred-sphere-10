import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";
import { usePresence } from "@/hooks/usePresence";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { MessageSquare } from "lucide-react";

const Messages = () => {
  const { items, loading } = useConversations();
  const onlineIds = usePresence();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(searchParams.get("c"));
  const [newOpen, setNewOpen] = useState(false);

  // Sync URL <-> active
  useEffect(() => {
    const fromUrl = searchParams.get("c");
    if (fromUrl !== activeId) setActiveId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const select = (id: string) => {
    setActiveId(id);
    setSearchParams({ c: id }, { replace: true });
  };

  const back = () => {
    setActiveId(null);
    setSearchParams({}, { replace: true });
  };

  const active = items.find((c) => c.id === activeId);

  return (
    <div className="-mx-3 -my-4 h-[calc(100vh-7.5rem)] sm:-mx-4 sm:-my-6 sm:h-[calc(100vh-9rem)]">
      <div className="flex h-full overflow-hidden rounded-none border bg-surface sm:rounded-xl">
        {/* Left list — hide on mobile when chat open */}
        <div className={`${activeId ? "hidden md:flex" : "flex"} w-full flex-col border-r md:w-[340px]`}>
          <ConversationList
            items={items}
            loading={loading}
            activeId={activeId}
            onlineIds={onlineIds}
            onSelect={select}
            onNewChat={() => setNewOpen(true)}
          />
        </div>

        {/* Right pane */}
        <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
          {active ? (
            <ChatWindow
              key={active.id}
              conversationId={active.id}
              other={active.other}
              onlineIds={onlineIds}
              onBack={back}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-14 w-14 opacity-30" />
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onConversationCreated={(id) => select(id)}
      />
    </div>
  );
};

export default Messages;
