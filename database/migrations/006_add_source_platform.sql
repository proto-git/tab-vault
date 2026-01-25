-- Migration: Add source_platform column for automatic platform detection
-- Run this in Supabase SQL Editor

-- Add source_platform to captures table
ALTER TABLE captures
ADD COLUMN IF NOT EXISTS source_platform TEXT;

-- Create index for source_platform queries
CREATE INDEX IF NOT EXISTS captures_source_platform_idx ON captures(source_platform);

-- Update the search_captures function to include source_platform
CREATE OR REPLACE FUNCTION search_captures(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_user_id UUID DEFAULT NULL,
  filter_source TEXT DEFAULT NULL
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
  source_platform TEXT,
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
    c.source_platform,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM captures c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
    AND (filter_source IS NULL OR c.source_platform = filter_source)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
