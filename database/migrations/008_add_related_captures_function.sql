-- Migration: Add get_related_captures function for semantic similarity
-- Run this in Supabase SQL Editor

-- Create function to find semantically related captures using pgvector
CREATE OR REPLACE FUNCTION get_related_captures(
  capture_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  display_title TEXT,
  category TEXT,
  tags TEXT[],
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
    c.category,
    c.tags,
    c.created_at,
    1 - (c.embedding <=> (SELECT embedding FROM captures WHERE captures.id = capture_id)) AS similarity
  FROM captures c
  WHERE c.id != capture_id
    AND c.embedding IS NOT NULL
    AND (SELECT embedding FROM captures WHERE captures.id = capture_id) IS NOT NULL
  ORDER BY c.embedding <=> (SELECT embedding FROM captures WHERE captures.id = capture_id)
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_related_captures TO anon, authenticated;
