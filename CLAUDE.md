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
  │   │   └── usage.js      Cost tracking
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
- `GET /api/recent` - Recent captures
- `GET/PUT /api/settings` - Model selection
- `GET/POST/DELETE /api/categories` - Category management
- `GET/DELETE /api/tags` - Tag management
- `POST /api/tags/merge` - Merge tags

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

Capture ideas here that belong in a global "tech-debt" or "tooling" Linear project:

- [ ] **Global Claude tooling**: User-scope hooks, CLAUDE.md templates, reusable skills/agents that bootstrap new projects
- [ ] **Context tracking hook**: `Stop` hook that feeds transcript size/message count back for pre-task compaction decisions
- [ ] **Project bootstrap script**: Initialize new projects with standard hooks, CLAUDE.md template, Linear integration
