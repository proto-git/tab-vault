-- Migration: Add settings table for user preferences
-- Run this in Supabase SQL Editor

-- Settings table (single row for now, expandable for multi-user later)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- AI Model preference
  ai_model TEXT NOT NULL DEFAULT 'claude-haiku',

  -- Future settings can be added here
  -- embedding_model TEXT DEFAULT 'text-embedding-3-small',
  -- auto_categorize BOOLEAN DEFAULT true,
  -- daily_budget_cents INTEGER DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a single default settings row
INSERT INTO settings (ai_model) VALUES ('claude-haiku')
ON CONFLICT DO NOTHING;

-- Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (single user for now)
CREATE POLICY "Allow all operations on settings" ON settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON settings TO anon;
GRANT ALL ON settings TO authenticated;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_timestamp();
