import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, Vote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const sb = supabase as any;

interface PostLite { id: string; content: string | null; created_at: string; }
interface OptionLite { id: string; post_id: string; text: string; position: number; }
interface VoteRow { id: string; post_id: string; option_id: string; user_id: string; created_at: string; }
interface ProfileLite { id: string; name: string; avatar_url: string | null; }

const postTitle = (p?: PostLite) => {
  if (!p) return "Unknown poll";
  const c = (p.content ?? "").trim();
  if (!c) return `Poll • ${formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}`;
  return c.length > 60 ? `${c.slice(0, 60)}…` : c;
};

export const PollAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Map<string, PostLite>>(new Map());
  const [options, setOptions] = useState<Map<string, OptionLite>>(new Map());
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [postFilter, setPostFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data: pollPosts } = await sb
      .from("posts").select("id, content, created_at")
      .eq("type", "poll").order("created_at", { ascending: false });

    const postMap = new Map<string, PostLite>((pollPosts ?? []).map((p: PostLite) => [p.id, p]));
    setPosts(postMap);

    if (!pollPosts || pollPosts.length === 0) {
      setOptions(new Map()); setVotes([]); setProfiles(new Map());
      setLoading(false);
      return;
    }

    const ids = pollPosts.map((p: PostLite) => p.id);
    const [{ data: opts }, { data: vts }] = await Promise.all([
      sb.from("poll_options").select("id, post_id, text, position").in("post_id", ids),
      sb.from("poll_votes").select("id, post_id, option_id, user_id, created_at").in("post_id", ids),
    ]);
    setOptions(new Map<string, OptionLite>((opts ?? []).map((o: OptionLite) => [o.id, o])));
    const voteRows = (vts ?? []) as VoteRow[];
    setVotes(voteRows);

    const userIds = Array.from(new Set(voteRows.map((v) => v.user_id)));
    if (userIds.length) {
      const { data: profs } = await sb.from("profiles").select("id, name, avatar_url").in("id", userIds);
      setProfiles(new Map<string, ProfileLite>((profs ?? []).map((p: ProfileLite) => [p.id, p])));
    } else {
      setProfiles(new Map());
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const aggregates = useMemo(() => {
    // post_id -> Map<option_id, count>, plus total
    const m = new Map<string, { total: number; perOption: Map<string, number> }>();
    for (const v of votes) {
      const a = m.get(v.post_id) ?? { total: 0, perOption: new Map() };
      a.total += 1;
      a.perOption.set(v.option_id, (a.perOption.get(v.option_id) ?? 0) + 1);
      m.set(v.post_id, a);
    }
    return m;
  }, [votes]);

  const optionsByPost = useMemo(() => {
    const m = new Map<string, OptionLite[]>();
    for (const o of options.values()) {
      const arr = m.get(o.post_id) ?? [];
      arr.push(o);
      m.set(o.post_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.position - b.position);
    return m;
  }, [options]);

  const filteredVotes = useMemo(() => {
    const list = postFilter === "all" ? votes : votes.filter((v) => v.post_id === postFilter);
    return [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [votes, postFilter]);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (posts.size === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Vote className="h-10 w-10 opacity-30" />
        <p className="text-sm">No poll posts yet</p>
      </Card>
    );
  }

  const pollPostList = Array.from(posts.values());

  return (
    <div className="space-y-6">
      {/* Per-poll summary */}
      <div className="grid gap-3 md:grid-cols-2">
        {pollPostList.map((p) => {
          const agg = aggregates.get(p.id) ?? { total: 0, perOption: new Map() };
          const opts = optionsByPost.get(p.id) ?? [];
          return (
            <Card key={p.id} className="space-y-3 p-4">
              <div className="flex items-start gap-2">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="line-clamp-2 text-sm font-medium">{postTitle(p)}</p>
              </div>
              <div className="space-y-1.5">
                {opts.map((o) => {
                  const count = agg.perOption.get(o.id) ?? 0;
                  const pct = agg.total ? Math.round((count / agg.total) * 100) : 0;
                  return (
                    <div key={o.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{o.text}</span>
                        <span className="shrink-0 font-medium text-muted-foreground">{pct}% · {count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{agg.total} {agg.total === 1 ? "voter" : "voters"}</p>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">Poll</span>
        <Select value={postFilter} onValueChange={setPostFilter}>
          <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All polls</SelectItem>
            {pollPostList.map((p) => (
              <SelectItem key={p.id} value={p.id}>{postTitle(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredVotes.length} {filteredVotes.length === 1 ? "vote" : "votes"}
        </span>
      </div>

      {/* Detailed table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Poll</TableHead>
              <TableHead>Selected option</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No votes to display
                </TableCell>
              </TableRow>
            ) : (
              filteredVotes.map((v) => {
                const u = profiles.get(v.user_id);
                const p = posts.get(v.post_id);
                const opt = options.get(v.option_id);
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{u?.name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{u?.name ?? "Unknown user"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <span className="line-clamp-1 text-sm">{postTitle(p)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {opt?.text ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
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
