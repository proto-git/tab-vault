-- Migration: Add usage tracking table
-- Run this in Supabase SQL Editor

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to capture (optional - for per-capture tracking)
  capture_id UUID REFERENCES captures(id) ON DELETE SET NULL,

  -- Service info
  service TEXT NOT NULL,              -- 'openrouter' or 'openai'
  model TEXT NOT NULL,                -- e.g., 'anthropic/claude-haiku-4.5'
  operation TEXT NOT NULL,            -- 'summarize', 'categorize', 'score', 'embed'

  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost (in USD, stored as cents for precision)
  cost_cents INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS usage_capture_id_idx ON usage(capture_id);
CREATE INDEX IF NOT EXISTS usage_service_idx ON usage(service);
CREATE INDEX IF NOT EXISTS usage_created_at_idx ON usage(created_at DESC);

-- Note: Skipping date expression index due to Supabase SQL editor limitations
-- The created_at DESC index handles date-based queries sufficiently

-- Row Level Security
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (single user for now)
CREATE POLICY "Allow all operations on usage" ON usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON usage TO anon;
GRANT ALL ON usage TO authenticated;

-- Helper function to get daily usage summary
CREATE OR REPLACE FUNCTION get_daily_usage(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_cost_cents BIGINT,
  total_tokens BIGINT,
  capture_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CAST(u.created_at AS DATE) as date,
    CAST(SUM(u.cost_cents) AS BIGINT) as total_cost_cents,
    CAST(SUM(u.total_tokens) AS BIGINT) as total_tokens,
    CAST(COUNT(DISTINCT u.capture_id) AS BIGINT) as capture_count
  FROM usage u
  WHERE u.created_at >= NOW() - CAST(days_back || ' days' AS INTERVAL)
  GROUP BY CAST(u.created_at AS DATE)
  ORDER BY date DESC;
END;
$$;

-- Helper function to get usage by service
CREATE OR REPLACE FUNCTION get_usage_by_service(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  service TEXT,
  model TEXT,
  total_cost_cents BIGINT,
  total_tokens BIGINT,
  request_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.service,
    u.model,
    CAST(SUM(u.cost_cents) AS BIGINT) as total_cost_cents,
    CAST(SUM(u.total_tokens) AS BIGINT) as total_tokens,
    CAST(COUNT(*) AS BIGINT) as request_count
  FROM usage u
  WHERE u.created_at >= NOW() - CAST(days_back || ' days' AS INTERVAL)
  GROUP BY u.service, u.model
  ORDER BY total_cost_cents DESC;
END;
$$;
