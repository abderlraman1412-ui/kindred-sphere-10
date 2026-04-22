import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SITE_NAME = "TAIPING MEDIA";
export const SITE_TAGLINE = "Social Platform";
export const SITE_DESCRIPTION =
  "TAIPING MEDIA is a modern social platform for sharing posts, videos, and images.";

interface BrandingState {
  siteName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BrandingState | undefined>(undefined);

const setFaviconLink = (url: string | null) => {
  // Remove any previous icon links we manage
  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((el) => el.remove());

  const href = url ?? "/favicon.ico";
  const sizes = ["16x16", "32x32", "64x64"];

  sizes.forEach((size) => {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = url ? "image/png" : "image/x-icon";
    link.sizes = size;
    link.href = href;
    document.head.appendChild(link);
  });

  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = href;
  document.head.appendChild(apple);
};

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("logo_url, favicon_url, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (!error && data) {
      // Cache-bust by appending updated_at when present
      const bust = data.updated_at ? `?v=${new Date(data.updated_at).getTime()}` : "";
      setLogoUrl(data.logo_url ? `${data.logo_url}${bust}` : null);
      setFaviconUrl(data.favicon_url ? `${data.favicon_url}${bust}` : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply favicon + page title whenever it changes
  useEffect(() => {
    setFaviconLink(faviconUrl);
  }, [faviconUrl]);

  useEffect(() => {
    document.title = `${SITE_NAME} - ${SITE_TAGLINE}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", SITE_DESCRIPTION);
  }, []);

  const value = useMemo<BrandingState>(
    () => ({
      siteName: SITE_NAME,
      tagline: SITE_TAGLINE,
      logoUrl,
      faviconUrl,
      loading,
      refresh: load,
    }),
    [logoUrl, faviconUrl, loading, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useBranding = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBranding must be used within BrandingProvider");
  return c;
};
