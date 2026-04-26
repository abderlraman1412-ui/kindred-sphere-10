import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Check, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface PollOption {
  id: string;
  post_id: string;
  text: string;
  position: number;
}
interface PollVote {
  option_id: string;
  user_id: string;
}

const sb = supabase as any;

const fireConfetti = () => {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.7 },
  });
};

export const PollWidget = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const myVote = useMemo(
    () => (user ? votes.find((v) => v.user_id === user.id)?.option_id ?? null : null),
    [votes, user]
  );
  const totalVotes = votes.length;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes) m.set(v.option_id, (m.get(v.option_id) ?? 0) + 1);
    return m;
  }, [votes]);

  const load = async () => {
    setLoading(true);
    const [{ data: opts }, { data: vts }] = await Promise.all([
      sb.from("poll_options").select("id, post_id, text, position").eq("post_id", postId).order("position", { ascending: true }),
      sb.from("poll_votes").select("option_id, user_id").eq("post_id", postId),
    ]);
    setOptions((opts ?? []) as PollOption[]);
    setVotes((vts ?? []) as PollVote[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [postId]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel(`poll-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `post_id=eq.${postId}` }, () => {
        void load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const vote = async (optionId: string) => {
    if (!user) { toast.error("Sign in to vote"); return; }
    if (submitting) return;
    const previous = myVote;
    if (previous === optionId) return;
    setSubmitting(true);

    // Optimistic
    const optimistic = votes.filter((v) => v.user_id !== user.id).concat({ option_id: optionId, user_id: user.id });
    setVotes(optimistic);

    const { error } = await sb
      .from("poll_votes")
      .upsert(
        { post_id: postId, option_id: optionId, user_id: user.id },
        { onConflict: "post_id,user_id" }
      );

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      void load();
      return;
    }
    toast.success("Thank you for your opinion 🎉");
    fireConfetti();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (options.length === 0) {
    return <p className="py-2 text-center text-xs text-muted-foreground">No options for this poll yet</p>;
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const count = counts.get(opt.id) ?? 0;
        const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        const selected = myVote === opt.id;
        const showResults = !!myVote;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => vote(opt.id)}
            disabled={submitting}
            className={`group relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-all ${
              selected
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border bg-surface hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            {showResults && (
              <div
                className={`absolute inset-y-0 left-0 transition-all ${selected ? "bg-primary/20" : "bg-muted"}`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            )}
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                <span className={`truncate ${selected ? "font-semibold" : ""}`}>{opt.text}</span>
              </div>
              {showResults && (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {pct}% · {count}
                </span>
              )}
            </div>
          </button>
        );
      })}
      <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <BarChart3 className="h-3 w-3" />
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        {myVote && <span className="ml-2 text-primary">· Thanks for voting</span>}
      </p>
    </div>
  );
};
