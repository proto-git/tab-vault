-- Tab Vault Database Schema for Supabase
-- Run this in Supabase SQL Editor to create the required tables

-- Enable vector extension (for RAG in Phase 3)
CREATE EXTENSION IF NOT EXISTS vector;

-- Main captures table
CREATE TABLE IF NOT EXISTS captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info (captured immediately)
  url TEXT NOT NULL,
  title TEXT,
  selected_text TEXT,
  favicon_url TEXT,

  -- Content (added in Phase 2 - AI processing)
  content TEXT,                    -- Full scraped content
  summary TEXT,                    -- AI-generated summary (2-3 sentences)

  -- Classification (added in Phase 2)
  category TEXT,                   -- learning, work, project, news, reference
  tags TEXT[],                     -- Additional AI-generated tags

  -- Scoring (added in Phase 2)
  quality_score INTEGER,           -- 1-10 from AI
  actionability_score INTEGER,     -- 1-10 from AI

  -- Vector embedding (added in Phase 3)
  embedding vector(1536),          -- OpenAI text-embedding-3-small dimensions

  -- Notion sync (added in Phase 4)
  notion_synced BOOLEAN DEFAULT FALSE,
  notion_page_id TEXT,
  notion_synced_at TIMESTAMP,

  -- Multi-user support (added for future-proofing)
  user_id UUID REFERENCES auth.users(id),

  -- Processing status
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, error
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS captures_url_idx ON captures(url);
CREATE INDEX IF NOT EXISTS captures_category_idx ON captures(category);
CREATE INDEX IF NOT EXISTS captures_status_idx ON captures(status);
CREATE INDEX IF NOT EXISTS captures_created_at_idx ON captures(created_at DESC);
CREATE INDEX IF NOT EXISTS captures_quality_score_idx ON captures(quality_score DESC);
CREATE INDEX IF NOT EXISTS captures_user_id_idx ON captures(user_id);

-- Vector similarity index (for semantic search)
-- Using ivfflat for faster approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS captures_embedding_idx ON captures
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full text search index
CREATE INDEX IF NOT EXISTS captures_fts_idx ON captures
USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, '')));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS captures_updated_at ON captures;
CREATE TRIGGER captures_updated_at
  BEFORE UPDATE ON captures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function for semantic search (supports optional user filtering for multi-user)
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
    AND c.user_id = auth.uid()
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
    AND (filter_source IS NULL OR c.source_platform = filter_source)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Row Level Security (optional but recommended)
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY captures_select_own ON captures
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY captures_insert_own ON captures
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY captures_update_own ON captures
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY captures_delete_own ON captures
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
REVOKE ALL ON captures FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON captures TO authenticated;

REVOKE ALL ON FUNCTION search_captures(vector, double precision, integer, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION search_captures(vector, double precision, integer, uuid, text) TO authenticated;
