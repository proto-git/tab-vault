# Tab Vault

A Chrome extension + cloud backend system that helps you capture, organize, and search your browser tabs with AI assistance.

## The Problem

Browser tab hoarding - you keep tabs open because you fear losing information. Tab Vault lets you quickly capture URLs, automatically summarizes and categorizes them with AI, and stores them in a searchable knowledge base so you can **close tabs with peace of mind**.

## Features

- **One-click capture** - Click the extension or press `Ctrl+Shift+S` to save any tab
- **AI summarization** - Automatic 2-3 sentence summaries of captured content
- **Smart categorization** - Content sorted into customizable categories
- **Auto-tagging** - AI generates relevant tags for each capture
- **Quality scoring** - AI rates content quality (1-10)
- **Semantic search** - Find content by meaning, not just keywords
- **Notion sync** - Sync captures to your Notion database with one click
- **Cost tracking** - Monitor AI usage and costs in the dashboard
- **Model selection** - Choose between Claude Haiku, Sonnet, or GPT-4o-mini

## Live Demo

- **Dashboard**: https://vault.wireforge.dev
- **Backend API**: Deployed on Railway

## Architecture

```
Chrome Extension → Backend API (Railway) → Supabase (PostgreSQL + pgvector)
                                        ↓
                           OpenRouter (Claude/GPT) + OpenAI (Embeddings)
                                        ↓
                                 Notion API (sync)
```

## Quick Start

### 1. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the contents of `database/schema.sql`
4. Run migrations in `database/migrations/` in order
5. Go to Project Settings > API and copy your URL and anon key

### 2. Set up the Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

npm install
npm run dev
```

Backend runs at http://localhost:8080

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Click the extension icon → Settings → Set your API URL

### 4. Set up Notion (Optional)

1. Create a [Notion integration](https://www.notion.so/my-integrations)
2. Create a database with these properties:
   - **Name** (title) - Required, Notion's default
   - **URL** (url)
   - **Summary** (rich_text)
   - **Category** (select)
   - **Tags** (multi_select)
   - **Quality** (number)
   - **Captured** (date)
3. Share the database with your integration
4. Add `NOTION_API_KEY` and `NOTION_DATABASE_ID` to your environment

## Project Structure

```
tab-vault/
├── extension/           # Chrome extension (Manifest V3)
│   ├── manifest.json    # Extension configuration
│   ├── background.js    # Service worker
│   ├── popup.html/js    # Extension UI
│   └── icons/           # Extension icons
│
├── backend/             # Express.js API server
│   ├── src/
│   │   ├── index.js     # Server entry point
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # AI, embeddings, Notion, etc.
│   │   └── config/      # Model definitions
│   └── package.json
│
├── frontend/            # Search dashboard (vanilla JS)
│   └── index.html       # Single-page app
│
└── database/            # Database schema
    ├── schema.sql       # Main Supabase schema
    └── migrations/      # Incremental migrations
```

## Environment Variables

Backend `.env`:
```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=8080

# AI Processing
OPENROUTER_API_KEY=your-openrouter-key
OPENAI_API_KEY=your-openai-key  # For embeddings

# Notion Sync (optional)
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID=your-database-id
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/capture` | Capture a URL |
| GET | `/api/recent` | Get recent captures |
| GET | `/api/search?q=` | Keyword search |
| GET | `/api/semantic-search?q=` | Semantic/vector search |
| GET | `/api/capture/:id` | Get single capture |
| PATCH | `/api/captures/:id` | Update category/tags |
| DELETE | `/api/capture/:id` | Delete capture |
| GET | `/api/status` | Service health check |
| GET | `/api/usage` | AI usage statistics |
| GET/PUT | `/api/settings` | Model selection |
| GET/POST/PUT/DELETE | `/api/categories` | Category management |
| GET/DELETE | `/api/tags` | Tag management |
| POST | `/api/tags/merge` | Merge tags |
| GET | `/api/notion/status` | Notion connection status |
| POST | `/api/notion/sync/:id` | Sync single capture |
| POST | `/api/notion/sync-all` | Bulk sync captures |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` (Win/Linux) | Capture current tab |
| `Cmd+Shift+S` (Mac) | Capture current tab |

## Implementation Status

### Phase 1: Core Intake ✅
- [x] Chrome extension with keyboard shortcut
- [x] Express backend with capture endpoint
- [x] Supabase storage
- [x] Deploy to Railway

### Phase 2: AI Processing ✅
- [x] Web scraping with Playwright
- [x] Summarization via OpenRouter (Claude/GPT)
- [x] Auto-categorization with custom categories
- [x] Auto-tagging
- [x] Quality scoring
- [x] Generate embeddings (OpenAI)
- [x] Cost/usage tracking

### Phase 3: Search Interface ✅
- [x] Web dashboard with filters
- [x] Semantic search via pgvector
- [x] Category/tag management
- [x] Light/dark mode
- [x] Capture detail modal with editing

### Phase 4: Notion Integration ✅
- [x] Notion API client
- [x] One-click sync from dashboard
- [x] Bulk sync endpoint

## Cost Estimate

| Component | Free Tier | Paid |
|-----------|-----------|------|
| Railway | 500 hrs/mo | ~$5-10/mo |
| Supabase | 500MB | $25/mo |
| OpenRouter | - | ~$5-10/mo |
| OpenAI Embeddings | - | ~$2-5/mo |
| Vercel (frontend) | Hobby free | - |
| **Total** | $0 (limited) | ~$35-50/mo |

## Development

```bash
# Backend development (with auto-reload)
cd backend
npm run dev

# Frontend is static - just open index.html or deploy to Vercel
```

## Deployment

- **Backend**: Push to master → Railway auto-deploys
- **Frontend**: Push to master → Vercel auto-deploys
- **Database**: Run migrations manually in Supabase SQL Editor

## License

MIT
