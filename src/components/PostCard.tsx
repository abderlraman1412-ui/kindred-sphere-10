import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TierBadge } from "@/components/TierBadge";
import { AdminBadge } from "@/components/AdminBadge";
import { useAdminIds } from "@/hooks/useAdminIds";
import { Heart, MessageCircle, Share2, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { StarRating } from "@/components/StarRating";

export interface PostRow {
  id: string;
  author_id: string;
  type: "text" | "image" | "video" | "rating";
  content: string | null;
  media_url: string | null;
  visibility: "normal" | "premium" | "pro" | "vip";
  created_at: string;
  author?: { name: string; avatar_url: string | null; tier: "normal" | "premium" | "pro" | "vip" };
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  author_is_admin?: boolean;
}

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  author?: { name: string; avatar_url: string | null };
}

export const PostCard = ({ post, onDelete }: { post: PostRow; onDelete?: (id: string) => void }) => {
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);

  const commenterIds = comments.map((c) => c.user_id);
  const adminIds = useAdminIds([post.author_id, ...commenterIds]);
  const authorIsAdmin = post.author_is_admin ?? adminIds.has(post.author_id);

  const initials = post.author?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "U";

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false); setLikeCount((c) => c - 1);
      const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) { setLiked(true); setLikeCount((c) => c + 1); toast.error(error.message); }
    } else {
      setLiked(true); setLikeCount((c) => c + 1);
      const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (error) { setLiked(false); setLikeCount((c) => c - 1); toast.error(error.message); }
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, content, created_at, parent_id")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(100);
    const list = (data ?? []) as CommentRow[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      list.forEach((c) => { c.author = map.get(c.user_id) as any; });
    }
    setComments(list);
    setLoadingComments(false);
  };

  const openComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) await loadComments();
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: commentText.trim(),
    });
    setPosting(false);
    if (error) toast.error(error.message);
    else { setCommentText(""); await loadComments(); }
  };

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "TAIPING MEDIU post" });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message);
    else { toast.success("Post deleted"); onDelete?.(post.id); }
  };

  return (
    <article className="rounded-2xl border bg-surface shadow-card animate-fade-in">
      <header className="flex items-center gap-3 p-4">
        <Avatar className="h-10 w-10 ring-2 ring-transparent ring-offset-2 ring-offset-surface data-[admin=true]:ring-vip" data-admin={authorIsAdmin}>
          <AvatarImage src={post.author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-surface-foreground">{post.author?.name ?? "Unknown"}</span>
            {authorIsAdmin && <AdminBadge size="xs" />}
            {post.author?.tier && <TierBadge tier={post.author.tier} size="xs" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })} · <span className="capitalize">{post.visibility}</span>
          </p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </header>

      {post.content && (
        <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] leading-relaxed text-surface-foreground">
          {post.content}
        </p>
      )}

      {post.type === "image" && post.media_url && (
        <img src={post.media_url} alt="Post" loading="lazy" className="max-h-[600px] w-full bg-muted object-cover" />
      )}
      {post.type === "video" && post.media_url && (
        <video src={post.media_url} controls className="max-h-[600px] w-full bg-black" preload="metadata" />
      )}
      {post.type === "rating" && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <StarRating postId={post.id} />
        </div>
      )}

      <div className="flex items-center justify-between border-t px-2 py-1">
        <Button variant="ghost" size="sm" onClick={toggleLike} className={liked ? "text-destructive" : ""}>
          <Heart className={`mr-1.5 h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likeCount}
        </Button>
        <Button variant="ghost" size="sm" onClick={openComments}>
          <MessageCircle className="mr-1.5 h-4 w-4" /> {post.comment_count ?? comments.length}
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 className="mr-1.5 h-4 w-4" /> Share
        </Button>
      </div>

      {showComments && (
        <div className="border-t bg-muted/30 p-3">
          {loadingComments ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No comments yet</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => {
                const cAdmin = adminIds.has(c.user_id);
                return (
                  <li key={c.id} className="flex gap-2">
                    <Avatar className="h-7 w-7"><AvatarImage src={c.author?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{c.author?.name?.[0] ?? "U"}</AvatarFallback></Avatar>
                    <div className="rounded-2xl bg-surface px-3 py-1.5 text-sm shadow-card">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold">{c.author?.name ?? "User"}</p>
                        {cAdmin && <AdminBadge size="xs" />}
                      </div>
                      <p className="break-words">{c.content}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={submitComment} className="mt-3 flex items-end gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, 2000))}
              placeholder="Write a comment…"
              rows={1}
              className="min-h-9 resize-none bg-surface"
            />
            <Button size="icon" type="submit" disabled={posting || !commentText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </article>
  );
};
