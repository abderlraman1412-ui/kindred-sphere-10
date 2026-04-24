import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard, PostRow } from "@/components/PostCard";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const PAGE = 8;

export const PostFeed = ({ filterType }: { filterType?: "text" | "image" | "video" }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const enrich = useCallback(async (rows: PostRow[]): Promise<PostRow[]> => {
    if (rows.length === 0) return rows;
    const ids = rows.map((r) => r.id);
    const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
    const [{ data: profs }, { data: likes }, { data: comments }, mineRes] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url, tier").in("id", authorIds),
      supabase.from("likes").select("post_id").in("post_id", ids),
      supabase.from("comments").select("post_id").in("post_id", ids),
      user
        ? supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const lcount = new Map<string, number>();
    (likes ?? []).forEach((l: any) => lcount.set(l.post_id, (lcount.get(l.post_id) ?? 0) + 1));
    const ccount = new Map<string, number>();
    (comments ?? []).forEach((c: any) => ccount.set(c.post_id, (ccount.get(c.post_id) ?? 0) + 1));
    const mineSet = new Set((mineRes.data ?? []).map((l: any) => l.post_id));
    return rows.map((r) => ({
      ...r,
      author: pmap.get(r.author_id) as any,
      like_count: lcount.get(r.id) ?? 0,
      comment_count: ccount.get(r.id) ?? 0,
      liked_by_me: mineSet.has(r.id),
    }));
  }, [user]);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      let q = supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (filterType) {
        q = q.eq("type", filterType);
        // Reels are shown only on /reels — exclude them from the regular video feed
        if (filterType === "video") q = q.eq("is_reel", false);
      }
      if (cursor) q = q.lt("created_at", cursor);
      const { data, error } = await q;
      if (error) { toast.error(error.message); return [] as PostRow[]; }
      const rows = (data ?? []) as PostRow[];
      return await enrich(rows);
    },
    [filterType, enrich]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true); setDone(false); setPosts([]);
    fetchPage().then((rows) => {
      if (!mounted) return;
      setPosts(rows);
      if (rows.length < PAGE) setDone(true);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [fetchPage]);

  // Realtime new posts
  useEffect(() => {
    const channel = supabase
      .channel("posts-feed-" + (filterType ?? "all"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const np = payload.new as PostRow & { is_reel?: boolean };
        if (filterType && np.type !== filterType) return;
        if (filterType === "video" && np.is_reel) return;
        const enriched = await enrich([np]);
        setPosts((prev) => [enriched[0], ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        const oldId = (payload.old as any).id;
        setPosts((prev) => prev.filter((p) => p.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filterType, enrich]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || done) return;
    const obs = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore || done || posts.length === 0) return;
      setLoadingMore(true);
      const last = posts[posts.length - 1];
      const more = await fetchPage(last.created_at);
      setPosts((prev) => [...prev, ...more]);
      if (more.length < PAGE) setDone(true);
      setLoadingMore(false);
    }, { rootMargin: "300px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [posts, loadingMore, done, fetchPage]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border bg-surface p-10 text-center text-muted-foreground shadow-card">
        Nothing here yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onDelete={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
      ))}
      <div ref={sentinelRef} className="h-10" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      {done && posts.length >= PAGE && (
        <p className="py-4 text-center text-xs text-muted-foreground">You've reached the end.</p>
      )}
    </div>
  );
};
