-- Migration 012: Phase 1 security and data governance hardening
-- Enforces strict per-user ownership at the DB layer for core tables.

-- 1) Categories move from global uniqueness to per-user uniqueness.
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_name_key
  ON public.categories (user_id, name);

-- 2) Normalize legacy ownership before strict RLS policies.
DO $$
DECLARE
  user_count INTEGER;
  only_user UUID;
  null_captures BIGINT;
  null_usage BIGINT;
  null_settings BIGINT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count = 1 THEN
    SELECT id INTO only_user FROM auth.users LIMIT 1;

    UPDATE public.captures SET user_id = only_user WHERE user_id IS NULL;
    UPDATE public.usage SET user_id = only_user WHERE user_id IS NULL;
    UPDATE public.settings SET user_id = only_user WHERE user_id IS NULL;
    UPDATE public.categories SET user_id = only_user WHERE user_id IS NULL;
  END IF;

  IF user_count > 1 THEN
    -- Categories are safe to fan out to all users because they are taxonomy metadata.
    INSERT INTO public.categories (
      name,
      description,
      color,
      icon,
      is_default,
      sort_order,
      created_at,
      updated_at,
      user_id
    )
    SELECT
      c.name,
      c.description,
      c.color,
      c.icon,
      c.is_default,
      c.sort_order,
      c.created_at,
      c.updated_at,
      u.id
    FROM public.categories c
    CROSS JOIN auth.users u
    WHERE c.user_id IS NULL
    ON CONFLICT (user_id, name) DO UPDATE SET
      description = EXCLUDED.description,
      color = EXCLUDED.color,
      icon = EXCLUDED.icon,
      is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order;

    DELETE FROM public.categories WHERE user_id IS NULL;

    SELECT COUNT(*) INTO null_captures FROM public.captures WHERE user_id IS NULL;
    SELECT COUNT(*) INTO null_usage FROM public.usage WHERE user_id IS NULL;
    SELECT COUNT(*) INTO null_settings FROM public.settings WHERE user_id IS NULL;

    IF null_captures > 0 OR null_usage > 0 OR null_settings > 0 THEN
      RAISE EXCEPTION
        'RLS hardening blocked: legacy rows without user ownership remain (captures=%, usage=%, settings=%). Backfill user_id before applying strict policies.',
        null_captures, null_usage, null_settings;
    END IF;
  END IF;
END $$;

-- 3) Deduplicate and constrain settings to one row per user.
DELETE FROM public.settings older
USING public.settings newer
WHERE older.user_id IS NOT NULL
  AND newer.user_id = older.user_id
  AND (
    newer.created_at > older.created_at
    OR (newer.created_at = older.created_at AND newer.id::text > older.id::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS settings_user_id_unique
  ON public.settings (user_id)
  WHERE user_id IS NOT NULL;

-- 4) Replace permissive policies with strict owner-only policies.
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['captures', 'usage', 'settings', 'categories']
  LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY captures_select_own ON public.captures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY captures_insert_own ON public.captures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY captures_update_own ON public.captures
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY captures_delete_own ON public.captures
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY usage_select_own ON public.usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY usage_insert_own ON public.usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY usage_update_own ON public.usage
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY usage_delete_own ON public.usage
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY settings_select_own ON public.settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY settings_insert_own ON public.settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY settings_update_own ON public.settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY settings_delete_own ON public.settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY categories_select_own ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- 5) Limit table access to authenticated users only.
REVOKE ALL ON TABLE public.captures FROM anon;
REVOKE ALL ON TABLE public.usage FROM anon;
REVOKE ALL ON TABLE public.settings FROM anon;
REVOKE ALL ON TABLE public.categories FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.captures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;

-- 6) Harden helper RPCs to always execute in caller scope and enforce auth ownership.
DROP FUNCTION IF EXISTS public.search_captures(vector, double precision, integer, uuid);
DROP FUNCTION IF EXISTS public.get_related_captures(uuid, integer);
DROP FUNCTION IF EXISTS public.get_daily_usage(integer);
DROP FUNCTION IF EXISTS public.get_usage_by_service(integer);

CREATE OR REPLACE FUNCTION public.search_captures(
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
SECURITY INVOKER
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
  FROM public.captures c
  WHERE c.embedding IS NOT NULL
    AND c.user_id = auth.uid()
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
    AND (filter_source IS NULL OR c.source_platform = filter_source)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_related_captures(
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
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH source_capture AS (
    SELECT c.embedding
    FROM public.captures c
    WHERE c.id = capture_id
      AND c.user_id = auth.uid()
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
  FROM public.captures c
  CROSS JOIN source_capture s
  WHERE c.id != capture_id
    AND c.embedding IS NOT NULL
    AND s.embedding IS NOT NULL
    AND c.user_id = auth.uid()
    AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
  ORDER BY c.embedding <=> s.embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_usage(
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
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CAST(u.created_at AS DATE) AS date,
    CAST(SUM(u.cost_cents) AS BIGINT) AS total_cost_cents,
    CAST(SUM(u.total_tokens) AS BIGINT) AS total_tokens,
    CAST(COUNT(DISTINCT u.capture_id) AS BIGINT) AS capture_count
  FROM public.usage u
  WHERE u.created_at >= NOW() - CAST(days_back || ' days' AS INTERVAL)
    AND u.user_id = auth.uid()
    AND (filter_user_id IS NULL OR u.user_id = filter_user_id)
  GROUP BY CAST(u.created_at AS DATE)
  ORDER BY date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_by_service(
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
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.service,
    u.model,
    CAST(SUM(u.cost_cents) AS BIGINT) AS total_cost_cents,
    CAST(SUM(u.total_tokens) AS BIGINT) AS total_tokens,
    CAST(COUNT(*) AS BIGINT) AS request_count
  FROM public.usage u
  WHERE u.created_at >= NOW() - CAST(days_back || ' days' AS INTERVAL)
    AND u.user_id = auth.uid()
    AND (filter_user_id IS NULL OR u.user_id = filter_user_id)
  GROUP BY u.service, u.model
  ORDER BY total_cost_cents DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.search_captures(vector, double precision, integer, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_related_captures(uuid, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_daily_usage(integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_usage_by_service(integer, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.search_captures(vector, double precision, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_related_captures(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_usage(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_by_service(integer, uuid) TO authenticated;
