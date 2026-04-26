import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, BarChart3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RatingRow {
  id: string;
  value: number;
  created_at: string;
  post_id: string;
  user_id: string;
}
interface PostLite { id: string; content: string | null; created_at: string; }
interface ProfileLite { id: string; name: string; avatar_url: string | null; }

const STAR_COUNT = 10;

const Stars = ({ value }: { value: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${value} of ${STAR_COUNT} stars`}>
    {Array.from({ length: STAR_COUNT }).map((_, i) => (
      <Star
        key={i}
        className={
          i < value
            ? "h-4 w-4 fill-yellow-400 text-yellow-400"
            : "h-4 w-4 text-muted-foreground/40"
        }
      />
    ))}
    <span className="ml-2 text-xs font-medium text-muted-foreground">{value}/10</span>
  </div>
);

const postTitle = (p: PostLite | undefined) => {
  if (!p) return "Unknown post";
  const c = (p.content ?? "").trim();
  if (!c) return `Rating post • ${formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}`;
  return c.length > 60 ? `${c.slice(0, 60)}…` : c;
};

export const RatingsAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [posts, setPosts] = useState<Map<string, PostLite>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [postFilter, setPostFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"highest" | "lowest" | "newest">("highest");

  const load = async () => {
    setLoading(true);
    // 1) Get all rating posts
    const { data: ratingPosts } = await supabase
      .from("posts")
      .select("id, content, created_at")
      .eq("type", "rating")
      .order("created_at", { ascending: false });

    const postMap = new Map<string, PostLite>((ratingPosts ?? []).map((p) => [p.id, p]));
    setPosts(postMap);

    if (!ratingPosts || ratingPosts.length === 0) {
      setRatings([]);
      setProfiles(new Map());
      setLoading(false);
      return;
    }

    // 2) Get ratings for those posts
    const postIds = ratingPosts.map((p) => p.id);
    const { data: rs } = await supabase
      .from("ratings")
      .select("id, value, created_at, post_id, user_id")
      .in("post_id", postIds);

    const rows = (rs ?? []) as RatingRow[];
    setRatings(rows);

    // 3) Get profiles for raters
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);
      setProfiles(new Map((profs ?? []).map((p) => [p.id, p])));
    } else {
      setProfiles(new Map());
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Per-post aggregates
  const aggregates = useMemo(() => {
    const m = new Map<string, { count: number; sum: number }>();
    for (const r of ratings) {
      const a = m.get(r.post_id) ?? { count: 0, sum: 0 };
      a.count += 1;
      a.sum += r.value;
      m.set(r.post_id, a);
    }
    return m;
  }, [ratings]);

  const filtered = useMemo(() => {
    let list = ratings;
    if (postFilter !== "all") list = list.filter((r) => r.post_id === postFilter);
    if (sortBy === "highest") list = [...list].sort((a, b) => b.value - a.value);
    else if (sortBy === "lowest") list = [...list].sort((a, b) => a.value - b.value);
    else list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [ratings, postFilter, sortBy]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.size === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Star className="h-10 w-10 opacity-30" />
        <p className="text-sm">No rating posts yet</p>
      </Card>
    );
  }

  const ratingPostList = Array.from(posts.values());

  return (
    <div className="space-y-6">
      {/* Per-post summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ratingPostList.map((p) => {
          const agg = aggregates.get(p.id) ?? { count: 0, sum: 0 };
          const avg = agg.count ? agg.sum / agg.count : 0;
          return (
            <Card key={p.id} className="space-y-2 p-4">
              <div className="flex items-start gap-2">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="line-clamp-2 text-sm font-medium">{postTitle(p)}</p>
              </div>
              <div className="flex items-center justify-between">
                <Stars value={Math.round(avg)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Avg <span className="font-semibold text-foreground">{avg.toFixed(2)}</span> · {agg.count} {agg.count === 1 ? "voter" : "voters"}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Post</span>
          <Select value={postFilter} onValueChange={setPostFilter}>
            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rating posts</SelectItem>
              {ratingPostList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{postTitle(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="highest">Highest rating</SelectItem>
              <SelectItem value="lowest">Lowest rating</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "rating" : "ratings"}
        </span>
      </div>

      {/* Detailed table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Post</TableHead>
              <TableHead>Stars</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No ratings to display
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const u = profiles.get(r.user_id);
                const p = posts.get(r.post_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{u?.name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{u?.name ?? "Unknown user"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <span className="line-clamp-1 text-sm">{postTitle(p)}</span>
                    </TableCell>
                    <TableCell><Stars value={r.value} /></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
