-- Migration: Add user_id columns for future multi-user support
-- Run this in Supabase SQL Editor
-- These columns are nullable to maintain backwards compatibility

-- Add user_id to captures table
ALTER TABLE captures
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add user_id to usage table
ALTER TABLE usage
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add user_id to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add user_id to categories table
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create indexes for user_id queries (will be needed when multi-user is enabled)
CREATE INDEX IF NOT EXISTS captures_user_id_idx ON captures(user_id);
CREATE INDEX IF NOT EXISTS usage_user_id_idx ON usage(user_id);
CREATE INDEX IF NOT EXISTS settings_user_id_idx ON settings(user_id);
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);

-- Update the search_captures function to optionally filter by user_id
CREATE OR REPLACE FUNCTION search_captures(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  display_title TEXT,
  summary TEXT,
  category TEXT,
  tags TEXT[],
  quality_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.url,
    c.title,
    c.display_title,
    c.summary,
    c.category,
    c.tags,
    c.quality_score,
    c.created_at,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM captures c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Prepare RLS policies for future multi-user (commented out until auth is implemented)
-- When ready, uncomment and run:
--
-- DROP POLICY IF EXISTS "Allow all operations" ON captures;
--
-- CREATE POLICY "Users can view their own captures"
--   ON captures FOR SELECT
--   USING (auth.uid() = user_id OR user_id IS NULL);
--
-- CREATE POLICY "Users can insert their own captures"
--   ON captures FOR INSERT
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
--
-- CREATE POLICY "Users can update their own captures"
--   ON captures FOR UPDATE
--   USING (auth.uid() = user_id OR user_id IS NULL);
--
-- CREATE POLICY "Users can delete their own captures"
--   ON captures FOR DELETE
--   USING (auth.uid() = user_id OR user_id IS NULL);

-- Note: Current "Allow all operations" policy remains in place for single-user mode
