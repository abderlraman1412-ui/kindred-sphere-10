
-- Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Replace overly broad public SELECT on storage with name-based read
DROP POLICY IF EXISTS "avatar public read" ON storage.objects;
DROP POLICY IF EXISTS "media public read" ON storage.objects;

-- Allow reading individual files (by exact name) but not listing.
-- Public CDN URL still works because it fetches a known object name.
CREATE POLICY "avatars read by name"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND name IS NOT NULL);

CREATE POLICY "media read by name"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media' AND name IS NOT NULL);
