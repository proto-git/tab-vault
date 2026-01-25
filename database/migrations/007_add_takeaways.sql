-- Migration 007: Add key takeaways and action items columns
-- Part of ALU-36: Key Takeaways Extraction

ALTER TABLE captures ADD COLUMN IF NOT EXISTS key_takeaways TEXT[];
ALTER TABLE captures ADD COLUMN IF NOT EXISTS action_items TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN captures.key_takeaways IS 'AI-extracted key points/insights from the content (3-5 items)';
COMMENT ON COLUMN captures.action_items IS 'AI-extracted actionable items from the content (0-3 items)';
