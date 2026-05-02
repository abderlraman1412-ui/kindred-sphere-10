import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PostType = "text" | "image" | "video";

const postSchema = z.object({
  type: z.enum(["text", "image", "video"]),
  content: z.string().trim().max(5000).optional(),
  media_url: z.string().trim().max(2000).optional(),
});

const REEL_MAX_SECONDS = 180;

const CreatePost = () => {
  const { user, profile, isAdmin, loading } = useAuth();
  const [composerType, setComposerType] = useState<PostType>("text");
  const [composerContent, setComposerContent] = useState("");
  const [composerMediaUrl, setComposerMediaUrl] = useState("");
  const [composerDuration, setComposerDuration] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // Admins go to admin portal
  if (isAdmin) return <Navigate to="/super-secret-admin-portal" replace />;

  // Only VIP can create posts
  if (profile?.tier !== "vip") {
    return <AccessDenied message="فقط مستخدمي VIP يمكنهم نشر المحتوى." />;
  }

  const onMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const max = composerType === "video" ? 100 : 10;
    if (file.size > max * 1024 * 1024) { toast.error(`Max ${max} MB`); return; }
    setUploading(true);
    setComposerDuration(null);

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
        // Non-fatal
      }
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${composerType}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    setComposerMediaUrl(pub.publicUrl);
    setUploading(false);
    toast.success("تم الرفع بنجاح");
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = postSchema.safeParse({
      type: composerType,
      content: composerContent,
      media_url: composerMediaUrl || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (composerType !== "text" && !composerMediaUrl) { toast.error("ارفع ملف أولاً"); return; }
    if (composerType === "text" && !composerContent.trim()) { toast.error("اكتب شيئاً"); return; }

    setPosting(true);
    const isReel = composerType === "video" && composerDuration !== null && composerDuration <= REEL_MAX_SECONDS;
    const { error } = await supabase.from("posts").insert({
      author_id: user.id,
      type: composerType as any,
      visibility: "normal" as any,
      content: composerContent.trim() || null,
      media_url: composerMediaUrl || null,
      is_reel: isReel,
      duration_seconds: composerType === "video" ? composerDuration : null,
    });

    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("تم النشر بنجاح! 🎉");
    setComposerContent("");
    setComposerMediaUrl("");
    setComposerDuration(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> العودة
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>✨</span> نشر محتوى جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPost} className="space-y-4">
            <div className="space-y-2">
              <Label>نوع المنشور</Label>
              <Select value={composerType} onValueChange={(v) => { setComposerType(v as PostType); setComposerMediaUrl(""); setComposerDuration(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">📝 نص</SelectItem>
                  <SelectItem value="image">🖼️ صورة</SelectItem>
                  <SelectItem value="video">🎬 فيديو</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>المحتوى</Label>
              <Textarea
                value={composerContent}
                onChange={(e) => setComposerContent(e.target.value)}
                placeholder="اكتب محتوى المنشور..."
                rows={4}
              />
            </div>

            {composerType !== "text" && (
              <div className="space-y-2">
                <Label>{composerType === "image" ? "رفع صورة" : "رفع فيديو"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept={composerType === "image" ? "image/*" : "video/*"}
                    onChange={onMediaUpload}
                    disabled={uploading}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {composerMediaUrl && (
                  <p className="text-xs text-muted-foreground truncate">✅ {composerMediaUrl.split("/").pop()}</p>
                )}
              </div>
            )}

            <Button type="submit" disabled={posting || uploading} className="w-full">
              {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              نشر
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatePost;
