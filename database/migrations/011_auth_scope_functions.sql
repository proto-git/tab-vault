-- Migration: Add optional user scoping to helper RPC functions

-- Recreate related-captures RPC with user filter support.
DROP FUNCTION IF EXISTS get_related_captures(UUID, INT);

CREATE OR REPLACE FUNCTION get_related_captures(
  capture_id UUID,
  match_count INT DEFAULT 5,
  filter_user_id UUID DEFAULT NULL
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
  WITH source_capture AS (
    SELECT c.embedding
    FROM captures c
    WHERE c.id = capture_id
      AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
    LIMIT 1
  )
  SELECT
    c.id,
    c.url,
    c.title,
    c.display_title,
    c.category,
    c.tags,
    c.created_at,
    1 - (c.embedding <=> s.embedding) AS similarity
  FROM captures c
  CROSS JOIN source_capture s
  WHERE c.id != capture_id
    AND c.embedding IS NOT NULL
    AND s.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
  ORDER BY c.embedding <=> s.embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_related_captures TO anon, authenticated;

-- Recreate usage summary RPCs with user filter support.
DROP FUNCTION IF EXISTS get_daily_usage(INTEGER);

CREATE OR REPLACE FUNCTION get_daily_usage(
  days_back INTEGER DEFAULT 30,
  filter_user_id UUID DEFAULT NULL
)
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
    CAST(u.created_at AS DATE) AS date,
    CAST(SUM(u.cost_cents) AS BIGINT) AS total_cost_cents,
    CAST(SUM(u.total_tokens) AS BIGINT) AS total_tokens,
    CAST(COUNT(DISTINCT u.capture_id) AS BIGINT) AS capture_count
  FROM usage u
  WHERE u.created_at >= NOW() - CAST(days_back || ' days' AS INTERVAL)
    AND (filter_user_id IS NULL OR u.user_id = filter_user_id)
  GROUP BY CAST(u.created_at AS DATE)
  ORDER BY date DESC;
END;
$$;

DROP FUNCTION IF EXISTS get_usage_by_service(INTEGER);

CREATE OR REPLACE FUNCTION get_usage_by_service(
  days_back INTEGER DEFAULT 30,
  filter_user_id UUID DEFAULT NULL
)
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
    CAST(SUM(u.cost_cents) AS BIGINT) AS total_cost_cents,
    CAST(SUM(u.total_tokens) AS BIGINT) AS total_tokens,
    CAST(COUNT(*) AS BIGINT) AS request_count
  FROM usage u
  WHERE u.created_at >= NOW() - CAST(days_back || ' days' AS INTERVAL)
    AND (filter_user_id IS NULL OR u.user_id = filter_user_id)
  GROUP BY u.service, u.model
  ORDER BY total_cost_cents DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_usage TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_usage_by_service TO anon, authenticated;

