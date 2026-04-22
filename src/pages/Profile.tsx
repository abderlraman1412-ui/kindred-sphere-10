import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TierBadge } from "@/components/TierBadge";
import { AdminBadge } from "@/components/AdminBadge";
import { toast } from "sonner";
import { Loader2, Camera, Pencil, X, ShieldCheck } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Name too short").max(60),
  bio: z.string().trim().max(280).optional(),
});

const Profile = () => {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

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
    else {
      toast.success("Profile updated successfully ✓");
      await refreshProfile();
      setEditing(false);
    }
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploading(false);
    if (updErr) toast.error(updErr.message);
    else { toast.success("Profile picture updated ✓"); await refreshProfile(); }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border bg-surface shadow-card">
        <div className="h-28 bg-gradient-to-r from-primary via-primary-hover to-vip sm:h-36" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col items-center gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <div className="relative">
              <Avatar className={`h-24 w-24 ring-4 ring-surface sm:h-28 sm:w-28 ${isAdmin ? "shadow-elevated" : ""}`}>
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-2xl text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-colors hover:bg-primary-hover">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
              </label>
            </div>
            <div className="flex-1 text-center sm:pb-2 sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
                {isAdmin && <AdminBadge />}
                <TierBadge tier={profile.tier} />
              </div>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant={editing ? "outline" : "default"}
                onClick={() => setEditing((v) => !v)}
                className="flex-1 sm:flex-initial"
              >
                {editing ? (<><X className="mr-2 h-4 w-4" /> Cancel</>) : (<><Pencil className="mr-2 h-4 w-4" /> Edit profile</>)}
              </Button>
              {isAdmin && !editing && (
                <Button variant="secondary" onClick={() => navigate("/super-secret-admin-portal")} className="hidden sm:inline-flex">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Admin portal
                </Button>
              )}
            </div>
          </div>

          {profile.bio && !editing && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-surface-foreground">{profile.bio}</p>
          )}
        </div>
      </section>

      {/* Edit form */}
      {editing && (
        <section className="rounded-2xl border bg-surface p-6 shadow-card animate-fade-in">
          <h2 className="mb-4 font-semibold">Edit your profile</h2>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" defaultValue={profile.name} maxLength={60} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                defaultValue={profile.bio ?? ""}
                maxLength={280}
                rows={3}
                placeholder="Tell people about yourself…"
              />
              <p className="text-xs text-muted-foreground">Max 280 characters</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="rounded-2xl border border-vip/30 bg-gradient-to-br from-vip/5 to-warning/5 p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-vip/10 p-2 text-vip">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Admin tools</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Manage users, moderate posts, and publish official content.
              </p>
              <Button className="mt-3" onClick={() => navigate("/super-secret-admin-portal")}>
                Open admin portal
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Profile;
