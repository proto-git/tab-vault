-- Migration 009: Add author_name column for extracted creator/author information
-- Part of ALU-34: Author Extraction for Tab Vault

ALTER TABLE captures ADD COLUMN IF NOT EXISTS author_name TEXT;
CREATE INDEX IF NOT EXISTS captures_author_idx ON captures(author_name);
