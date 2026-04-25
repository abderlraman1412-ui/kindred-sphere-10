import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TierBadge } from "@/components/TierBadge";
import { AdminBadge } from "@/components/AdminBadge";
import { useAdminIds } from "@/hooks/useAdminIds";
import { toast } from "sonner";
import {
  Heart, MessageCircle, Share2, Trash2, Send,
  Volume2, VolumeX, Play, Loader2, X, ArrowLeft, Star, Bookmark,
} from "lucide-react";

type Tier = "normal" | "premium" | "pro" | "vip";

interface Reel {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  visibility: Tier;
  created_at: string;
  duration_seconds: number | null;
  featured: boolean;
  author?: { name: string; avatar_url: string | null; tier: Tier };
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface ReelComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { name: string; avatar_url: string | null };
}

const PAGE = 5;

const Reels = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const enrich = useCallback(async (rows: any[]): Promise<Reel[]> => {
    if (rows.length === 0) return [];
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
    return rows.map((r: any) => ({
      id: r.id,
      author_id: r.author_id,
      content: r.content,
      media_url: r.media_url,
      visibility: r.visibility,
      created_at: r.created_at,
      duration_seconds: r.duration_seconds,
      featured: !!r.featured,
      author: pmap.get(r.author_id) as any,
      like_count: lcount.get(r.id) ?? 0,
      comment_count: ccount.get(r.id) ?? 0,
      liked_by_me: mineSet.has(r.id),
    }));
  }, [user]);

  const fetchPage = useCallback(async (cursor?: string) => {
    let q = supabase
      .from("posts")
      .select("*")
      .eq("type", "video")
      .eq("is_reel", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (cursor) q = q.lt("created_at", cursor);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return [] as Reel[]; }
    return await enrich(data ?? []);
  }, [enrich]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchPage().then((rows) => {
      if (!mounted) return;
      setReels(rows);
      if (rows.length < PAGE) setDone(true);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [fetchPage]);

  // Realtime: new reels appear at top
  useEffect(() => {
    const ch = supabase
      .channel("reels-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (p) => {
        const np = p.new as any;
        if (np.type !== "video" || !np.is_reel) return;
        const enriched = await enrich([np]);
        setReels((prev) => [enriched[0], ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (p) => {
        const oldId = (p.old as any).id;
        setReels((prev) => prev.filter((r) => r.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enrich]);

  // Snap-scroll observer: detects which reel is active
  useEffect(() => {
    if (!containerRef.current || reels.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.reelId!;
          const idx = reels.findIndex((r) => r.id === id);
          const video = videoRefs.current.get(id);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            if (idx !== -1) setActiveIndex(idx);
            if (video) {
              video.muted = muted;
              video.play().catch(() => {/* autoplay blocked */});
            }
          } else if (video) {
            video.pause();
            video.currentTime = 0;
          }
        });
      },
      { root: containerRef.current, threshold: [0.6] }
    );
    itemRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reels, muted]);

  // Infinite load when nearing the end
  useEffect(() => {
    if (done || loading) return;
    if (activeIndex < reels.length - 2) return;
    let cancelled = false;
    (async () => {
      const last = reels[reels.length - 1];
      if (!last) return;
      const more = await fetchPage(last.created_at);
      if (cancelled) return;
      if (more.length === 0) { setDone(true); return; }
      setReels((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...more.filter((r) => !seen.has(r.id))];
      });
      if (more.length < PAGE) setDone(true);
    })();
    return () => { cancelled = true; };
  }, [activeIndex, reels, done, loading, fetchPage]);

  // Honor ?r=<id> deep-link
  useEffect(() => {
    const id = searchParams.get("r");
    if (!id || reels.length === 0) return;
    const el = itemRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [searchParams, reels]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    videoRefs.current.forEach((v) => { v.muted = next; });
  };

  const toggleLike = async (reel: Reel) => {
    if (!user) return;
    const liked = reel.liked_by_me;
    setReels((prev) => prev.map((r) => r.id === reel.id
      ? { ...r, liked_by_me: !liked, like_count: r.like_count + (liked ? -1 : 1) }
      : r));
    if (liked) {
      const { error } = await supabase.from("likes").delete().eq("post_id", reel.id).eq("user_id", user.id);
      if (error) {
        setReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, liked_by_me: true, like_count: r.like_count + 1 } : r));
        toast.error(error.message);
      }
    } else {
      const { error } = await supabase.from("likes").insert({ post_id: reel.id, user_id: user.id });
      if (error) {
        setReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, liked_by_me: false, like_count: r.like_count - 1 } : r));
        toast.error(error.message);
      }
    }
  };

  const share = async (reel: Reel) => {
    const url = `${window.location.origin}/reels?r=${reel.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "Reel · TAIPING MEDIA" });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {/* user cancel */}
  };

  const deleteReel = async (reel: Reel) => {
    if (!confirm("Delete this reel?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", reel.id);
    if (error) toast.error(error.message);
    else { toast.success("Reel deleted"); setReels((prev) => prev.filter((r) => r.id !== reel.id)); }
  };

  const toggleFeatured = async (reel: Reel) => {
    const next = !reel.featured;
    const { error } = await supabase.from("posts").update({ featured: next }).eq("id", reel.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next ? "Reel featured" : "Removed from featured");
      setReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, featured: next } : r));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
        <Play className="h-14 w-14 opacity-40" />
        <h2 className="text-lg font-bold">No reels yet</h2>
        <p className="max-w-xs text-sm opacity-70">Short videos (≤ 3 minutes) posted by admins will appear here.</p>
        <Button variant="secondary" onClick={() => navigate("/")}>Back to feed</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3">
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto text-white hover:bg-white/10 hover:text-white"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="pointer-events-none text-base font-bold tracking-wide text-white drop-shadow">Reels</h1>
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto text-white hover:bg-white/10 hover:text-white"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* Vertical snap scroller */}
      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        style={{ scrollbarWidth: "none" }}
      >
        {reels.map((reel) => (
          <ReelItem
            key={reel.id}
            reel={reel}
            isAdmin={isAdmin}
            registerEl={(el) => {
              if (el) itemRefs.current.set(reel.id, el);
              else itemRefs.current.delete(reel.id);
            }}
            registerVideo={(el) => {
              if (el) videoRefs.current.set(reel.id, el);
              else videoRefs.current.delete(reel.id);
            }}
            initialMuted={muted}
            onLike={() => toggleLike(reel)}
            onComment={() => setOpenComments(reel.id)}
            onShare={() => share(reel)}
            onDelete={() => deleteReel(reel)}
            onFeature={() => toggleFeatured(reel)}
          />
        ))}
      </div>

      {/* Comments sheet */}
      {openComments && (
        <CommentsSheet
          reelId={openComments}
          onClose={() => setOpenComments(null)}
          onCountChange={(c) => setReels((prev) => prev.map((r) => r.id === openComments ? { ...r, comment_count: c } : r))}
        />
      )}
    </div>
  );
};

/* ---------- Reel item ---------- */

const ReelItem = ({
  reel, isAdmin, registerEl, registerVideo, initialMuted,
  onLike, onComment, onShare, onDelete, onFeature,
}: {
  reel: Reel;
  isAdmin: boolean;
  registerEl: (el: HTMLElement | null) => void;
  registerVideo: (el: HTMLVideoElement | null) => void;
  initialMuted: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onDelete: () => void;
  onFeature: () => void;
}) => {
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPaused(false); }
    else { v.pause(); setPaused(true); }
  };

  const initials = reel.author?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "U";

  return (
    <section
      ref={registerEl}
      data-reel-id={reel.id}
      className="relative h-full w-full snap-start snap-always"
    >
      {reel.media_url ? (
        <video
          ref={(el) => { videoRef.current = el; registerVideo(el); }}
          src={reel.media_url}
          className="h-full w-full bg-black object-contain"
          loop
          playsInline
          muted={initialMuted}
          preload="metadata"
          onClick={togglePlay}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-white/60">No video</div>
      )}

      {paused && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          aria-label="Play"
        >
          <Play className="h-16 w-16 text-white drop-shadow-lg" fill="currentColor" />
        </button>
      )}

      {/* Right-side actions */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
        <ActionButton
          icon={<Heart className={`h-6 w-6 ${reel.liked_by_me ? "fill-current text-destructive" : ""}`} />}
          label={String(reel.like_count)}
          onClick={onLike}
        />
        <ActionButton
          icon={<MessageCircle className="h-6 w-6" />}
          label={String(reel.comment_count)}
          onClick={onComment}
        />
        <ActionButton icon={<Share2 className="h-6 w-6" />} label="Share" onClick={onShare} />
        {isAdmin && (
          <>
            <ActionButton
              icon={<Star className={`h-6 w-6 ${reel.featured ? "fill-current text-warning" : ""}`} />}
              label={reel.featured ? "Featured" : "Feature"}
              onClick={onFeature}
            />
            <ActionButton icon={<Trash2 className="h-6 w-6 text-destructive" />} label="Delete" onClick={onDelete} />
          </>
        )}
      </div>

      {/* Featured ribbon */}
      {reel.featured && (
        <div className="absolute left-3 top-14 z-10 inline-flex items-center gap-1 rounded-full bg-warning/90 px-2 py-0.5 text-[11px] font-bold text-warning-foreground shadow-lg">
          <Star className="h-3 w-3 fill-current" /> Featured
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6 pr-20 text-white">
        <div className="mb-2 flex items-center gap-2">
          <Avatar className="h-9 w-9 ring-2 ring-white/30">
            <AvatarImage src={reel.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{reel.author?.name ?? "Unknown"}</span>
              {reel.author?.tier && <TierBadge tier={reel.author.tier} size="xs" />}
            </div>
          </div>
        </div>
        {reel.content && (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-snug opacity-95">
            {reel.content}
          </p>
        )}
      </div>
    </section>
  );
};

const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 text-white drop-shadow-lg transition-transform active:scale-90"
  >
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
      {icon}
    </span>
    <span className="text-[11px] font-semibold">{label}</span>
  </button>
);

/* ---------- Comments sheet ---------- */

const CommentsSheet = ({
  reelId, onClose, onCountChange,
}: {
  reelId: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const commenterIds = useMemo(() => comments.map((c) => c.user_id), [comments]);
  const adminIds = useAdminIds(commenterIds);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, content, created_at")
      .eq("post_id", reelId)
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (data ?? []) as ReelComment[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      list.forEach((c) => { c.author = map.get(c.user_id) as any; });
    }
    setComments(list);
    onCountChange(list.length);
    setLoading(false);
  }, [reelId, onCountChange]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({
      post_id: reelId,
      user_id: user.id,
      content: text.trim(),
    });
    setPosting(false);
    if (error) toast.error(error.message);
    else { setText(""); await load(); }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-[70%] w-full flex-col rounded-t-2xl bg-surface text-surface-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-bold">Comments ({comments.length})</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Be the first to comment</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.author?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{c.author?.name?.[0] ?? "U"}</AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl bg-muted px-3 py-1.5 text-sm">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold">{c.author?.name ?? "User"}</p>
                      {adminIds.has(c.user_id) && <AdminBadge size="xs" />}
                    </div>
                    <p className="break-words">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 border-t bg-surface p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            placeholder="Add a comment…"
            rows={1}
            className="min-h-9 resize-none"
          />
          <Button size="icon" type="submit" disabled={posting || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Reels;
