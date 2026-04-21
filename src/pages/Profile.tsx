import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(280).optional(),
});

const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!profile) return null;
  const initials = profile.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ name: fd.get("name"), bio: fd.get("bio") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: parsed.data.name, bio: parsed.data.bio ?? null })
      .eq("id", profile.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); await refreshProfile(); }
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploading(false);
    if (updErr) toast.error(updErr.message);
    else { toast.success("Avatar updated"); await refreshProfile(); }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-surface p-6 shadow-card">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated hover:bg-primary-hover">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
            </label>
          </div>
          <div className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <TierBadge tier={profile.tier} />
            </div>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            {profile.bio && <p className="mt-2 max-w-md text-sm">{profile.bio}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-surface p-6 shadow-card">
        <h2 className="mb-4 font-semibold">Edit profile</h2>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={profile.name} maxLength={60} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={280} rows={3} placeholder="Tell people about yourself…" />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </form>
      </section>
    </div>
  );
};

export default Profile;
