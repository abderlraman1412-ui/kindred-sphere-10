import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  postId: string;
  /** Read-only mode (e.g. inside admin lists). Default: false */
  readOnly?: boolean;
}

const STARS = 10;

export const StarRating = ({ postId, readOnly = false }: Props) => {
  const { user } = useAuth();
  const [myValue, setMyValue] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [avg, setAvg] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRatings = async () => {
    setLoading(true);
    const [{ data: all }, mine] = await Promise.all([
      supabase.from("ratings").select("value").eq("post_id", postId),
      user
        ? supabase.from("ratings").select("value").eq("post_id", postId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const values = (all ?? []).map((r: any) => r.value as number);
    setCount(values.length);
    setAvg(values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
    setMyValue((mine.data as { value: number } | null)?.value ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    void loadRatings();
    // Realtime updates so average/count stay live
    const channel = supabase
      .channel(`ratings-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `post_id=eq.${postId}` },
        () => { void loadRatings(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  const submit = async (value: number) => {
    if (!user || readOnly || saving) return;
    const previous = myValue;
    setMyValue(value); // optimistic
    setSaving(true);
    const { error } = await supabase
      .from("ratings")
      .upsert(
        { post_id: postId, user_id: user.id, value },
        { onConflict: "post_id,user_id" },
      );
    setSaving(false);
    if (error) {
      setMyValue(previous);
      toast.error(error.message);
    } else {
      toast.success(`You rated ${value}/${STARS}`);
    }
  };

  const display = hover || myValue;

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-0.5"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="Rate this post"
      >
        {Array.from({ length: STARS }, (_, i) => {
          const v = i + 1;
          const filled = v <= display;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={myValue === v}
              aria-label={`${v} out of ${STARS}`}
              disabled={readOnly || !user || saving}
              onMouseEnter={() => !readOnly && setHover(v)}
              onFocus={() => !readOnly && setHover(v)}
              onClick={() => submit(v)}
              className={cn(
                "rounded p-0.5 transition-transform",
                !readOnly && user && "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                (readOnly || !user) && "cursor-default",
              )}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  filled ? "fill-tier-vip text-tier-vip" : "fill-transparent text-muted-foreground",
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {loading ? (
          <span>Loading…</span>
        ) : count === 0 ? (
          <span>No ratings yet{user && !readOnly ? " · be the first" : ""}</span>
        ) : (
          <>
            <span className="font-semibold text-surface-foreground">{avg.toFixed(1)}</span>
            <span>/ {STARS}</span>
            <span aria-hidden>·</span>
            <span>{count} {count === 1 ? "vote" : "votes"}</span>
            {myValue > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>your rating: {myValue}</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
