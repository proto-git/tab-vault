-- Add display_title column to captures table
-- Stores AI-generated clean titles (max 80 chars)

ALTER TABLE captures ADD COLUMN IF NOT EXISTS display_title TEXT;

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS search_captures(vector, double precision, integer);

-- Recreate search_captures function with display_title and tags
CREATE OR REPLACE FUNCTION search_captures(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
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
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Optionally backfill existing captures with their original title
-- (they'll get proper display_title on next reprocess)
-- UPDATE captures SET display_title = title WHERE display_title IS NULL;
