-- Migration 010: Add image_url column and storage bucket for og:image capture
-- Images are stored in Supabase Storage, URL referenced in this column

-- Add image_url column
ALTER TABLE captures ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN captures.image_url IS 'URL to captured og:image stored in Supabase Storage';

-- Create storage bucket (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('capture-images', 'capture-images', true, 5242880)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket:
-- 1. Public read access
-- 2. Insert access for uploads
-- 3. Delete access for cleanup
