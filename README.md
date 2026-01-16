# Tab Vault

A Chrome extension + cloud backend system that helps you capture, organize, and search your browser tabs with AI assistance.

## The Problem

Browser tab hoarding - you keep tabs open because you fear losing information. Tab Vault lets you quickly capture URLs, automatically summarizes and categorizes them with AI, and stores them in a searchable knowledge base so you can **close tabs with peace of mind**.

## Features

- **One-click capture** - Click the extension or press `Ctrl+Shift+S` to save any tab
- **AI summarization** - Automatic 2-3 sentence summaries of captured content
- **Auto-categorization** - Content is sorted into: learning, work, project, news, reference
- **Quality scoring** - AI rates content quality and actionability (1-10)
- **RAG search** - Semantic search to find content even without exact keywords
- **Notion sync** - High-quality items automatically sync to your Notion database

## Architecture

```
Chrome Extension → Cloud Backend (Railway) → Supabase (PostgreSQL + pgvector)
                                          ↓
                              OpenRouter (AI) + OpenAI (Embeddings)
                                          ↓
                                   Notion API (sync)
```

## Quick Start

### 1. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the contents of `database/schema.sql`
4. Go to Project Settings > API and copy your URL and anon key

### 2. Set up the Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials

npm install
npm run dev
```

Backend runs at http://localhost:3001

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder

### 4. Test It!

1. Open any webpage
2. Click the Tab Vault extension icon (or press `Ctrl+Shift+S`)
3. Click "Capture This Tab"
4. Check your Supabase dashboard - you should see the captured URL!

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
│   │   └── services/    # Supabase, AI, etc.
│   └── package.json
│
├── database/            # Database schema
│   └── schema.sql       # Supabase SQL schema
│
└── frontend/            # Search web app (Phase 3)
    └── (coming soon)
```

## Implementation Phases

### Phase 1: Core Intake (Current)
- [x] Chrome extension with keyboard shortcut
- [x] Express backend with capture endpoint
- [x] Supabase storage
- [ ] Deploy to Railway

### Phase 2: AI Processing
- [ ] Web scraping with Playwright
- [ ] Summarization via OpenRouter
- [ ] Auto-categorization
- [ ] Generate embeddings

### Phase 3: Search Interface
- [ ] React web app
- [ ] Semantic search via pgvector
- [ ] Extension popup search

### Phase 4: Notion Integration
- [ ] Notion API client
- [ ] Auto-sync high-score items
- [ ] Weekly digest

## Configuration

### Extension Settings

Click "Settings" in the extension popup to configure:
- **API URL**: Backend URL (default: http://localhost:3001/api)

### Environment Variables

Backend `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=3001
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` (Win/Linux) | Capture current tab |
| `Cmd+Shift+S` (Mac) | Capture current tab |

## Cost Estimate

| Component | Free Tier | Paid |
|-----------|-----------|------|
| Railway | - | ~$10-15/mo |
| Supabase | 500MB | $25/mo |
| OpenRouter | - | ~$5-10/mo |
| OpenAI Embeddings | - | ~$2-5/mo |
| **Total** | $0 (limited) | ~$40-55/mo |

## Development

```bash
# Backend development
cd backend
npm run dev  # Starts with --watch for auto-reload

# Generate extension icons
# (Use any SVG to PNG converter on extension/icons/icon.svg)
```

## License

MIT
