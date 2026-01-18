-- Migration: Add categories table for custom category management
-- Run this in Supabase SQL Editor

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Category info
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#667eea',  -- Hex color for UI
  icon TEXT DEFAULT 'folder',     -- Icon name (for future use)

  -- Is this a default category or user-created?
  is_default BOOLEAN DEFAULT false,

  -- Sort order for display
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, description, color, is_default, sort_order) VALUES
  ('learning', 'Tutorials, courses, documentation, how-to guides', '#10b981', true, 1),
  ('work', 'Professional tools, productivity, career-related', '#3b82f6', true, 2),
  ('project', 'Code repos, project ideas, side projects', '#8b5cf6', true, 3),
  ('news', 'Current events, announcements, blog posts', '#f59e0b', true, 4),
  ('reference', 'APIs, specs, reference materials, wikis', '#6b7280', true, 5)
ON CONFLICT (name) DO NOTHING;

-- Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (single user for now)
CREATE POLICY "Allow all operations on categories" ON categories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON categories TO anon;
GRANT ALL ON categories TO authenticated;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_categories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_timestamp();
