-- Site-wide branding settings (logo, favicon, etc.)
CREATE TABLE public.site_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  logo_url TEXT,
  favicon_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = TRUE)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated visitors) can read branding
CREATE POLICY "branding readable by all"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Only admins may insert/update branding
CREATE POLICY "admins insert branding"
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update branding"
ON public.site_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the singleton row
INSERT INTO public.site_settings (id) VALUES (TRUE) ON CONFLICT DO NOTHING;

-- Auto-update timestamp
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Public storage bucket for branding assets (logo, favicon)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view branding files
CREATE POLICY "branding files publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'branding');

-- Only admins can upload / replace / delete branding files
CREATE POLICY "admins upload branding"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update branding files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete branding files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));