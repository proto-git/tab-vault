# Tab Vault - Claude Code Project Guide

## Project Overview

Tab Vault is a browser extension + backend system for AI-powered tab capture and search. Users capture web pages, which are processed by AI to generate summaries, categories, tags, and embeddings for semantic search.

## Architecture

```
extension/          Chrome Extension (Manifest V3)
  ├── background.js   Service worker - API calls
  ├── popup.html/js   Extension popup UI
  └── manifest.json   Extension config

backend/            Node.js + Express API (deployed on Railway)
  ├── src/
  │   ├── routes/     API endpoints
  │   ├── services/   Business logic
  │   │   ├── ai.js         OpenRouter (Claude/GPT models)
  │   │   ├── embeddings.js OpenAI embeddings
  │   │   ├── processor.js  Background AI processing
  │   │   ├── categories.js Custom category management
  │   │   ├── tags.js       Tag aggregation/merge
  │   │   ├── settings.js   User preferences
  │   │   ├── usage.js      Cost tracking
  │   │   └── notion.js     Notion sync service
  │   └── config/
  │       └── models.js     AI model definitions

database/           Supabase (PostgreSQL + pgvector)
  └── migrations/   SQL migration files
```

## Key Patterns

- **Async fire-and-forget**: AI processing runs in background after API response
- **Dynamic prompts**: Categories loaded from DB into AI prompts at runtime
- **Token tracking**: Usage logged per-capture for cost visibility
- **Model abstraction**: Models defined in config, switchable via settings

## API Endpoints

- `POST /api/capture` - Capture a URL
- `GET /api/search?q=` - Keyword search captures
- `GET /api/semantic-search?q=` - Vector similarity search (finds conceptually related content)
- `POST /api/backfill-embeddings?limit=50` - Generate embeddings for old captures
- `POST /api/backfill-titles?limit=50` - Generate display titles for old captures
- `GET /api/recent` - Recent captures
- `GET/PUT /api/settings` - Model selection
- `GET/POST/DELETE /api/categories` - Category management
- `GET/DELETE /api/tags` - Tag management
- `POST /api/tags/merge` - Merge tags
- `GET /api/notion/status` - Check Notion connection
- `POST /api/notion/sync/:id` - Sync capture to Notion
- `POST /api/notion/sync-all?limit=50` - Bulk sync unsynced captures

## Development

```bash
# Backend (local)
cd backend && npm run dev

# Extension
Load unpacked from extension/ in chrome://extensions
```

## Deployment

- **Backend**: Railway (auto-deploys on push to master)
- **Database**: Supabase (run migrations in SQL Editor)
- **Extension**: Manual reload in Chrome

---

## Session Management

### Pre-Task Context Evaluation

Before starting any new task (especially multi-step features), evaluate context capacity:

1. **Check context usage** - If approaching limits, suggest compacting first
2. **Assess task complexity** - Multi-file features need more context headroom
3. **Proactive compaction** - Better to compact between tasks than mid-implementation

### When to Suggest Compacting

- Before starting a new feature (ALU-XX tasks)
- After completing a major feature
- When context feels "heavy" from accumulated file reads
- Before deep exploration of unfamiliar code areas

### Session Continuity

Session transcripts are stored at:
```
~/.claude/projects/-Users-danmac-Developer-personal/
```

When resuming from a compacted session:
- Read the summary carefully for pending tasks
- Check the todo list state
- Verify any "in progress" work was captured

### Task Tracking

Always use TodoWrite for multi-step tasks. This helps:
- Survive context compaction with task state preserved
- Give visibility into progress
- Prevent forgotten steps

---

## Future Ideas (Cross-Project)

Now tracked in Linear tech-debt project: https://linear.app/alucent/project/tech-debt-a1ff70e7896c

- **ALU-18**: Global Claude tooling - user-scope hooks, templates, skills
- **ALU-19**: Context tracking hook for pre-task compaction decisions
- **ALU-20**: Project bootstrap script with standard Claude setup

---

## Current Status (Jan 26, 2026)

**Completed features:**
- Phase 1: Chrome extension + Express backend + Supabase
- Phase 2: AI pipeline (scrape → summarize → categorize → tag → embed)
- Phase 3: Semantic search using pgvector
- ALU-15: Cost tracking with usage dashboard
- ALU-16: Model selection (Claude Haiku, Sonnet, GPT-4o-mini)
- ALU-17: Category & tag management with custom categories
- ALU-21: Frontend dashboard with search, filters, light/dark mode
- ALU-22: AI-generated display titles and backfill endpoint
- ALU-27: Editable categories/tags in capture modal
- ALU-28: Fixed dropdown positioning in modal
- ALU-29: Clean AI summaries (no markdown)
- ALU-32: Notion sync integration with sync button in modal

**Deployments:**
- Frontend: https://vault.wireforge.dev (Vercel)
- Backend: Railway (auto-deploys on push to master)
- Database: Supabase

**Known issues:**
- Old captures may lack embeddings or display_title
- Check: `SELECT * FROM captures WHERE embedding IS NULL` or `WHERE display_title IS NULL`
- Fix: `POST /api/backfill-embeddings?limit=50` or `POST /api/backfill-titles?limit=50` (batch)
- Or `POST /api/reprocess/:id` (individual - reruns full AI pipeline)

---

## Architecture Decisions & Future Considerations

### Current Limitations (Single-User Design)
- **user_id columns added but unused** - Ready for multi-user but not enforced
- **Shared API keys** - Single OpenRouter/OpenAI key for all usage
- **Single Notion workspace** - Current sync uses env-based configuration

### Future: Multi-User (ALU-30)
`user_id` columns already added (nullable) to: captures, usage, settings, categories

When implementing multi-user:
1. Implement Supabase Auth
2. Enable RLS policies (commented out in migration 005)
3. Filter by user_id in queries (search_captures already supports filter_user_id)
4. Add admin approval workflow for new users

### Current: Notion Integration (ALU-32 Complete)
Single-workspace Notion sync via environment variables:
- `NOTION_API_KEY` - Integration token
- `NOTION_DATABASE_ID` - Target database

Database schema for Notion:
- Name (title), URL, Summary (rich_text), Category (select), Tags (multi_select), Quality (number), Captured (date)

Sync service designed for future multi-workspace - accepts optional `apiKey` and `databaseId` params.

### Future: Multi-Notion Workspace (ALU-31)
For multi-workspace support, will need:
- `notion_integrations` table (stores tokens per workspace)
- `notion_syncs` table (tracks syncs per capture per workspace)
- `notion_routing_rules` table (auto-route by URL pattern, category, etc.)

---

## Backlog (in Linear)

- ALU-23: Auto-capture rules (capture tabs matching URL patterns)
- ALU-30: Multi-user authentication and data isolation
- ALU-31: Multi-Notion workspace support
