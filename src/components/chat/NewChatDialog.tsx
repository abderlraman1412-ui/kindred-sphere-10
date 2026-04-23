import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  avatar_url: string | null;
  email: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

export const NewChatDialog = ({ open, onOpenChange, onConversationCreated }: Props) => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    const t = setTimeout(async () => {
      let q = supabase
        .from("profiles")
        .select("id,name,avatar_url,email")
        .neq("id", user.id)
        .eq("banned", false)
        .order("name")
        .limit(30);
      if (query.trim()) {
        q = q.ilike("name", `%${query.trim()}%`);
      }
      const { data } = await q;
      setUsers((data ?? []) as User[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, user?.id]);

  const start = async (otherId: string) => {
    setCreatingId(otherId);
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user: otherId });
    setCreatingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    onOpenChange(false);
    onConversationCreated(data as string);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No users found</p>
          ) : users.map((u) => {
            const initials = u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";
            return (
              <button
                key={u.id}
                onClick={() => start(u.id)}
                disabled={creatingId === u.id}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                {creatingId === u.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
