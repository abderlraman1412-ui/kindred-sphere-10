import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Image as ImageIcon, Globe } from "lucide-react";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

type Kind = "logo" | "favicon";

export const BrandingSettings = () => {
  const { logoUrl, faviconUrl, refresh } = useBranding();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingFavicon, setSavingFavicon] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  const handlePick = (kind: Kind, file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("Allowed formats: PNG, JPG, SVG, WEBP");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Max file size is 2 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === "logo") { setLogoFile(file); setLogoPreview(url); }
    else { setFaviconFile(file); setFaviconPreview(url); }
  };

  const upload = async (kind: Kind) => {
    const file = kind === "logo" ? logoFile : faviconFile;
    if (!file) return;
    const setSaving = kind === "logo" ? setSavingLogo : setSavingFavicon;
    setSaving(true);

    const ext = file.name.split(".").pop() || "png";
    const path = `${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
    if (upErr) { toast.error(upErr.message); setSaving(false); return; }

    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    const updates = kind === "logo" ? { logo_url: pub.publicUrl } : { favicon_url: pub.publicUrl };
    const { error: updErr } = await supabase
      .from("site_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", true);

    setSaving(false);
    if (updErr) { toast.error(updErr.message); return; }

    toast.success(kind === "logo" ? "Site logo updated ✓" : "Favicon updated ✓");
    if (kind === "logo") { setLogoFile(null); setLogoPreview(null); if (logoInput.current) logoInput.current.value = ""; }
    else { setFaviconFile(null); setFaviconPreview(null); if (faviconInput.current) faviconInput.current.value = ""; }
    await refresh();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" /> Site logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center rounded-xl border bg-muted/40 p-6">
            {(logoPreview || logoUrl) ? (
              <img
                src={logoPreview ?? logoUrl ?? ""}
                alt="Site logo preview"
                className="max-h-32 max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No logo uploaded</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo-input">Choose new logo</Label>
            <input
              ref={logoInput}
              id="logo-input"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => handlePick("logo", e.target.files?.[0])}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary-hover"
            />
            <p className="text-xs text-muted-foreground">PNG, JPG, SVG or WEBP · Max 2 MB</p>
          </div>
          <Button onClick={() => upload("logo")} disabled={!logoFile || savingLogo} className="w-full">
            {savingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Upload className="mr-2 h-4 w-4" /> Save logo</>)}
          </Button>
        </CardContent>
      </Card>

      {/* Favicon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Browser favicon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-4 rounded-xl border bg-muted/40 p-6">
            {(faviconPreview || faviconUrl) ? (
              <>
                <img src={faviconPreview ?? faviconUrl ?? ""} alt="Favicon 16" className="h-4 w-4 object-contain" />
                <img src={faviconPreview ?? faviconUrl ?? ""} alt="Favicon 32" className="h-8 w-8 object-contain" />
                <img src={faviconPreview ?? faviconUrl ?? ""} alt="Favicon 64" className="h-16 w-16 object-contain" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No favicon uploaded</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="favicon-input">Choose new favicon</Label>
            <input
              ref={faviconInput}
              id="favicon-input"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => handlePick("favicon", e.target.files?.[0])}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary-hover"
            />
            <p className="text-xs text-muted-foreground">Square image works best · Max 2 MB</p>
          </div>
          <Button onClick={() => upload("favicon")} disabled={!faviconFile || savingFavicon} className="w-full">
            {savingFavicon ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Upload className="mr-2 h-4 w-4" /> Save favicon</>)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
