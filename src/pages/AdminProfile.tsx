import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminBadge } from "@/components/AdminBadge";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";
import { Loader2, Camera, ArrowLeft, KeyRound, LogOut, ShieldCheck, Save } from "lucide-react";
import { useEffect } from "react";

const nameSchema = z.string().trim().min(2, "Name too short").max(60, "Name too long");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);

const AdminProfile = () => {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  if (loading || !profile || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const initials = profile.name
    ?.split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Only PNG, JPG, WEBP or SVG allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max file size is 2 MB");
      return;
    }
    // Local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/admin-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-busting query param
    const busted = `${pub.publicUrl}?v=${Date.now()}`;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: busted })
      .eq("id", user.id);
    setUploading(false);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    toast.success("Profile picture updated ✓");
    setPreviewUrl(null);
    await refreshProfile();
  };

  const onSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: parsed.data })
      .eq("id", user.id);
    setSavingName(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Name updated ✓");
      await refreshProfile();
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPwd(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated ✓");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const onLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const displayedAvatar = previewUrl ?? profile.avatar_url ?? undefined;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/super-secret-admin-portal")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Button>
        <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>

      {/* Profile card */}
      <section className="overflow-hidden rounded-2xl border bg-surface shadow-card">
        <div className="h-24 bg-gradient-to-r from-primary via-primary-hover to-vip" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-28 w-28 ring-4 ring-surface shadow-elevated transition-all duration-300">
                <AvatarImage src={displayedAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary text-3xl text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <label
                className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-colors hover:bg-primary-hover"
                aria-label="Change profile picture"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={onAvatar}
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-surface-foreground">
                  {profile.name}
                </h1>
                <AdminBadge />
                <TierBadge tier={profile.tier} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                PNG, JPG, WEBP or SVG • Max 2 MB
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Edit name */}
      <section className="rounded-2xl border bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-surface-foreground">Account details</h2>
        </div>
        <form onSubmit={onSaveName} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-name">Display name</Label>
            <Input
              id="admin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" value={profile.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">Email can't be changed here</p>
          </div>
          <Button type="submit" disabled={savingName} className="gap-2">
            {savingName ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
        </form>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-surface-foreground">Change password</h2>
        </div>
        <form onSubmit={onChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pwd">New password</Label>
            <Input
              id="new-pwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pwd">Confirm password</Label>
            <Input
              id="confirm-pwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              placeholder="Repeat the new password"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={savingPwd || !newPassword} className="gap-2">
            {savingPwd ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
};

export default AdminProfile;
