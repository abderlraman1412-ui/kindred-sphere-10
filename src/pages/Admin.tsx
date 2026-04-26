import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";
import {
  Users, FileText, Image as ImageIcon, Video, ShieldCheck, ShieldOff, Trash2, Search,
  ArrowLeft, Plus, Loader2, Crown, BarChart3, Palette, MessageSquare, Sparkles, Star, Vote, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandingSettings } from "@/components/BrandingSettings";
import { AdminMessages } from "@/components/AdminMessages";
import { AISettings } from "@/components/AISettings";
import { StarRating } from "@/components/StarRating";
import { RatingsAdmin } from "@/components/RatingsAdmin";
import { PollAdmin } from "@/components/PollAdmin";

type Tier = "normal" | "premium" | "pro" | "vip";
type PostType = "text" | "image" | "video" | "rating" | "poll";

interface AdminProfile {
  id: string; email: string | null; name: string; avatar_url: string | null;
  bio: string | null; tier: Tier; banned: boolean; created_at: string;
}
interface AdminPost {
  id: string; author_id: string; type: PostType; content: string | null;
  media_url: string | null; visibility: Tier; created_at: string;
  author?: { name: string };
}

const postSchema = z.object({
  type: z.enum(["text", "image", "video", "rating", "poll"]),
  visibility: z.enum(["normal", "premium", "pro", "vip"]),
  content: z.string().trim().max(5000).optional(),
  media_url: z.string().trim().max(2000).optional(),
});

const Admin = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [composerType, setComposerType] = useState<PostType>("text");
  const [composerVisibility, setComposerVisibility] = useState<Tier>("normal");
  const [composerContent, setComposerContent] = useState("");
  const [composerMediaUrl, setComposerMediaUrl] = useState("");
  const [composerDuration, setComposerDuration] = useState<number | null>(null);
  const [composerPollOptions, setComposerPollOptions] = useState<string[]>(["", ""]);

  const REEL_MAX_SECONDS = 180; // 3 minutes

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const usersData = (u ?? []) as AdminProfile[];
    setUsers(usersData);
    const ids = Array.from(new Set((p ?? []).map((x: any) => x.author_id)));
    const map = new Map(usersData.filter((x) => ids.includes(x.id)).map((x) => [x.id, x]));
    setPosts(((p ?? []) as AdminPost[]).map((post) => ({ ...post, author: { name: map.get(post.author_id)?.name ?? "Unknown" } })));
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const filteredUsers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => u.name.toLowerCase().includes(s) || (u.email ?? "").toLowerCase().includes(s));
  }, [users, search]);

  const stats = useMemo(() => ({
    total: users.length,
    banned: users.filter((u) => u.banned).length,
    vip: users.filter((u) => u.tier === "vip").length,
    pro: users.filter((u) => u.tier === "pro").length,
    premium: users.filter((u) => u.tier === "premium").length,
    normal: users.filter((u) => u.tier === "normal").length,
    posts: posts.length,
    text: posts.filter((p) => p.type === "text").length,
    image: posts.filter((p) => p.type === "image").length,
    video: posts.filter((p) => p.type === "video").length,
  }), [users, posts]);

  const toggleBan = async (u: AdminProfile) => {
    const { error } = await supabase.from("profiles").update({ banned: !u.banned }).eq("id", u.id);
    if (error) toast.error(error.message);
    else { toast.success(u.banned ? "User unbanned" : "User banned"); setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, banned: !u.banned } : x)); }
  };

  const changeTier = async (u: AdminProfile, tier: Tier) => {
    const { error } = await supabase.from("profiles").update({ tier }).eq("id", u.id);
    if (error) toast.error(error.message);
    else { toast.success(`Tier set to ${tier}`); setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, tier } : x)); }
  };

  const deleteUser = async (u: AdminProfile) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", u.id);
    if (error) toast.error(error.message);
    else { toast.success("User deleted"); setUsers((prev) => prev.filter((x) => x.id !== u.id)); }
  };

  const deletePost = async (p: AdminPost) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Post deleted"); setPosts((prev) => prev.filter((x) => x.id !== p.id)); }
  };

  const onMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const max = composerType === "video" ? 100 : 10;
    if (file.size > max * 1024 * 1024) { toast.error(`Max ${max} MB`); return; }
    setUploading(true);
    setComposerDuration(null);

    // Detect video duration locally before upload
    let duration: number | null = null;
    if (composerType === "video") {
      try {
        duration = await new Promise<number>((resolve, reject) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => {
            const d = isFinite(v.duration) ? Math.round(v.duration) : 0;
            URL.revokeObjectURL(v.src);
            resolve(d);
          };
          v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Could not read video metadata")); };
          v.src = URL.createObjectURL(file);
        });
        setComposerDuration(duration);
      } catch {
        // Non-fatal; reel detection just falls back to normal video
      }
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${composerType}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    setComposerMediaUrl(pub.publicUrl);
    setUploading(false);
    if (composerType === "video" && duration !== null) {
      toast.success(
        duration <= REEL_MAX_SECONDS
          ? `Uploaded · Reel (${duration}s)`
          : `Uploaded · Video (${Math.floor(duration / 60)}m ${duration % 60}s)`
      );
    } else {
      toast.success("Uploaded");
    }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = postSchema.safeParse({
      type: composerType, visibility: composerVisibility,
      content: composerContent, media_url: composerMediaUrl || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (composerType !== "text" && composerType !== "rating" && composerType !== "poll" && !composerMediaUrl) { toast.error("Upload a file first"); return; }
    if (composerType === "text" && !composerContent.trim()) { toast.error("Write something"); return; }
    if (composerType === "rating" && !composerContent.trim()) { toast.error("Add a question or topic for the rating"); return; }
    if (composerType === "poll") {
      if (!composerContent.trim()) { toast.error("Add a poll question"); return; }
      const cleanOpts = composerPollOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2) { toast.error("Add at least 2 options"); return; }
    }
    setPosting(true);
    const isReel = composerType === "video" && composerDuration !== null && composerDuration <= REEL_MAX_SECONDS;
    const { data, error } = await supabase.from("posts").insert({
      author_id: user.id,
      type: composerType as any,
      visibility: composerVisibility,
      content: composerContent.trim() || null,
      media_url: composerMediaUrl || null,
      is_reel: isReel,
      duration_seconds: composerType === "video" ? composerDuration : null,
    }).select().single();

    if (error || !data) {
      setPosting(false);
      toast.error(error?.message ?? "Failed to publish");
      return;
    }

    if (composerType === "poll") {
      const cleanOpts = composerPollOptions.map((o) => o.trim()).filter(Boolean);
      const rows = cleanOpts.map((text, i) => ({ post_id: data.id, text, position: i }));
      const { error: optErr } = await (supabase as any).from("poll_options").insert(rows);
      if (optErr) {
        // rollback the post if options failed
        await supabase.from("posts").delete().eq("id", data.id);
        setPosting(false);
        toast.error(optErr.message);
        return;
      }
    }

    setPosting(false);
    toast.success(
      composerType === "poll" ? "Poll published 🗳️" :
      isReel ? "Reel published 🎬" : "Post published"
    );
    setComposerContent(""); setComposerMediaUrl(""); setComposerDuration(null);
    setComposerPollOptions(["", ""]);
    setPosts((prev) => [{ ...(data as AdminPost), author: { name: "You" } }, ...prev]);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <BrandLogo nameOverride="TAIPING MEDIA Admin" size="sm" />
          <Link to="/" className="ml-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
          <Link to="/admin/profile" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Users className="h-4 w-4" /> My profile
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold">Admin Portal</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage users, content, branding, and platform activity.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview"><BarChart3 className="mr-2 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
            <TabsTrigger value="posts"><FileText className="mr-2 h-4 w-4" />Posts</TabsTrigger>
            <TabsTrigger value="compose"><Plus className="mr-2 h-4 w-4" />New post</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="mr-2 h-4 w-4" />Messages</TabsTrigger>
            <TabsTrigger value="ratings"><Star className="mr-2 h-4 w-4" />Ratings</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="mr-2 h-4 w-4" />AI</TabsTrigger>
            <TabsTrigger value="branding"><Palette className="mr-2 h-4 w-4" />Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="ai"><AISettings /></TabsContent>
          <TabsContent value="ratings"><RatingsAdmin /></TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total users" value={stats.total} icon={Users} />
              <StatCard label="Banned" value={stats.banned} icon={ShieldOff} tone="destructive" />
              <StatCard label="Total posts" value={stats.posts} icon={FileText} />
              <StatCard label="VIP members" value={stats.vip} icon={Crown} tone="vip" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Users by tier</CardTitle></CardHeader>
                <CardContent>
                  <BarRow label="VIP" value={stats.vip} total={stats.total} color="bg-tier-vip" />
                  <BarRow label="Pro" value={stats.pro} total={stats.total} color="bg-tier-pro" />
                  <BarRow label="Premium" value={stats.premium} total={stats.total} color="bg-tier-premium" />
                  <BarRow label="Normal" value={stats.normal} total={stats.total} color="bg-tier-normal" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Posts by type</CardTitle></CardHeader>
                <CardContent>
                  <BarRow label="Text" value={stats.text} total={stats.posts} color="bg-primary" />
                  <BarRow label="Image" value={stats.image} total={stats.posts} color="bg-success" />
                  <BarRow label="Video" value={stats.video} total={stats.posts} color="bg-warning" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by name or email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <span className="text-sm text-muted-foreground">{filteredUsers.length} users</span>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No users</TableCell></TableRow>
                  ) : filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{u.name?.[0] ?? "U"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{u.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={u.tier} onValueChange={(v) => changeTier(u, v as Tier)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Banned</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Active</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={u.banned ? "outline" : "ghost"} onClick={() => toggleBan(u)}>
                          {u.banned ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteUser(u)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No posts yet</TableCell></TableRow>
                  ) : posts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.type === "text" && <FileText className="h-4 w-4 text-primary" />}
                        {p.type === "image" && <ImageIcon className="h-4 w-4 text-success" />}
                        {p.type === "video" && <Video className="h-4 w-4 text-warning" />}
                        {p.type === "rating" && <Star className="h-4 w-4 text-tier-vip" />}
                      </TableCell>
                      <TableCell className="max-w-xs"><p className="truncate text-sm">{p.content ?? p.media_url ?? "—"}</p></TableCell>
                      <TableCell><TierBadge tier={p.visibility} size="xs" /></TableCell>
                      <TableCell className="text-sm">{p.author?.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deletePost(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="compose">
            <Card>
              <CardHeader><CardTitle className="text-base">Create a new post</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submitPost} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={composerType} onValueChange={(v) => { setComposerType(v as PostType); setComposerMediaUrl(""); setComposerDuration(null); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="rating">Rating (1–10 stars)</SelectItem>
                          <SelectItem value="poll">Poll (voting)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <Select value={composerVisibility} onValueChange={(v) => setComposerVisibility(v as Tier)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal (everyone)</SelectItem>
                          <SelectItem value="premium">Premium and above</SelectItem>
                          <SelectItem value="pro">Pro and above</SelectItem>
                          <SelectItem value="vip">VIP only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {composerType === "rating" ? "Question / topic"
                        : composerType === "poll" ? "Poll question"
                        : "Content"}
                      {composerType !== "text" && composerType !== "rating" && composerType !== "poll" && <span className="text-xs text-muted-foreground"> (optional caption)</span>}
                    </Label>
                    <Textarea
                      value={composerContent}
                      onChange={(e) => setComposerContent(e.target.value.slice(0, 5000))}
                      rows={4}
                      placeholder={
                        composerType === "text" ? "What's on your mind?"
                        : composerType === "rating" ? "What should people rate? e.g. How useful was this lesson?"
                        : composerType === "poll" ? "What do you want to ask? e.g. Which feature should we build next?"
                        : "Add a caption…"
                      }
                    />
                  </div>

                  {composerType !== "text" && composerType !== "rating" && composerType !== "poll" && (
                    <div className="space-y-2">
                      <Label>{composerType === "image" ? "Image" : "Video"}</Label>
                      <Input
                        type="file"
                        accept={composerType === "image" ? "image/*" : "video/*"}
                        onChange={onMediaUpload}
                        disabled={uploading}
                      />
                      {composerType === "video" && (
                        <p className="text-xs text-muted-foreground">
                          Videos ≤ 3 minutes are auto-published as <span className="font-semibold text-primary">Reels</span>.
                        </p>
                      )}
                      {uploading && <p className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Uploading…</p>}
                      {composerMediaUrl && composerType === "image" && (
                        <img src={composerMediaUrl} alt="preview" className="max-h-60 rounded-lg border" />
                      )}
                      {composerMediaUrl && composerType === "video" && (
                        <>
                          <video src={composerMediaUrl} controls className="max-h-60 rounded-lg border" />
                          {composerDuration !== null && (
                            <p className="text-xs">
                              Duration: <span className="font-medium">{Math.floor(composerDuration / 60)}m {composerDuration % 60}s</span>
                              {composerDuration <= REEL_MAX_SECONDS ? (
                                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Reel</span>
                              ) : (
                                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Video</span>
                              )}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {composerType === "rating" && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Preview · users will see 10 stars to rate</p>
                      <div className="flex items-center gap-0.5 text-tier-vip">
                        {Array.from({ length: 10 }).map((_, i) => <Star key={i} className="h-5 w-5" />)}
                      </div>
                    </div>
                  )}

                  {composerType === "poll" && (
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">Poll options (min 2)</Label>
                        <Button
                          type="button" variant="ghost" size="sm"
                          onClick={() => setComposerPollOptions((opts) => opts.length < 10 ? [...opts, ""] : opts)}
                          disabled={composerPollOptions.length >= 10}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add option
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {composerPollOptions.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              value={opt}
                              maxLength={120}
                              placeholder={`Option ${i + 1}`}
                              onChange={(e) => setComposerPollOptions((opts) => opts.map((o, idx) => idx === i ? e.target.value : o))}
                            />
                            {composerPollOptions.length > 2 && (
                              <Button
                                type="button" variant="ghost" size="icon"
                                onClick={() => setComposerPollOptions((opts) => opts.filter((_, idx) => idx !== i))}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Each user can vote once. They can change their vote at any time.</p>
                    </div>
                  )}

                  <Button type="submit" disabled={posting}>
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish post"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <AdminMessages />
          </TabsContent>

          <TabsContent value="branding">
            <BrandingSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, tone = "default" }: { label: string; value: number; icon: any; tone?: "default" | "destructive" | "vip" }) => {
  const toneCls = tone === "destructive" ? "bg-destructive/10 text-destructive"
    : tone === "vip" ? "bg-tier-vip/15 text-tier-vip"
    : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneCls}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const BarRow = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value} ({pct}%)</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default Admin;
