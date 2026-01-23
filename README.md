# Tab Vault

A Chrome extension + cloud backend system that helps you capture, organize, and search your browser tabs with AI assistance.

## The Problem

Browser tab hoarding - you keep tabs open because you fear losing information. Tab Vault lets you quickly capture URLs, automatically summarizes and categorizes them with AI, and stores them in a searchable knowledge base so you can **close tabs with peace of mind**.

## Features

- **One-click capture** - Click the extension or press `Ctrl+Shift+S` to save any tab
- **AI summarization** - Automatic 2-3 sentence summaries of captured content
- **AI-generated display titles** - Clean, readable titles for your captures
- **Auto-categorization** - Content is sorted into customizable categories (learning, work, project, news, reference, or your own)
- **Smart tagging** - AI generates relevant tags with merge and rename support
- **Quality scoring** - AI rates content quality and actionability (1-10)
- **Semantic search** - Find content by meaning, not just keywords (powered by pgvector)
- **Model selection** - Choose between Claude Haiku, Claude Sonnet, or GPT-4o Mini
- **Cost tracking** - Monitor AI usage and costs per capture
- **Light/dark mode** - Beautiful web dashboard with theme toggle
- **Editable metadata** - Edit categories and tags directly on capture cards

## Architecture

```
Chrome Extension → Cloud Backend (Railway) → Supabase (PostgreSQL + pgvector)
                                          ↓
                              OpenRouter (AI) + OpenAI (Embeddings)
```

## Quick Start

### 1. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the contents of `database/schema.sql`
4. Run the migrations in `database/migrations/` in order (001, 002, 003, 004)
5. Go to Project Settings > API and copy your URL and anon key

### 2. Set up the Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

npm install
npm run dev
```

Backend runs at http://localhost:3001

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder

### 4. Open the Dashboard

Open `frontend/index.html` in your browser to access the web dashboard for searching and managing captures.

### 5. Test It!

1. Open any webpage
2. Click the Tab Vault extension icon (or press `Ctrl+Shift+S`)
3. Click "Capture This Tab"
4. The page will be captured and AI processing will run in the background
5. Check the dashboard to see your capture with summary, category, and tags!

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
│   │   ├── services/    # AI, embeddings, categories, tags, etc.
│   │   └── config/      # Model definitions
│   └── package.json
│
├── database/            # Database schema & migrations
│   ├── schema.sql       # Main Supabase schema
│   └── migrations/      # Incremental migrations
│
├── frontend/            # Web dashboard (single-file app)
│   └── index.html       # Search, filter, manage captures
│
└── scripts/             # Utility scripts
    └── generate-icons.ps1
```

## API Endpoints

### Captures
- `POST /api/capture` - Capture a URL
- `GET /api/capture/:id` - Get a single capture
- `PATCH /api/captures/:id` - Update capture (category, tags)
- `DELETE /api/capture/:id` - Delete a capture
- `GET /api/recent` - Recent captures (paginated)

### Search
- `GET /api/search?q=` - Keyword/full-text search
- `GET /api/semantic-search?q=` - Vector similarity search (finds conceptually related content)

### Processing
- `POST /api/process-pending` - Process pending captures
- `POST /api/reprocess/:id` - Re-run AI pipeline on a capture
- `POST /api/backfill-embeddings?limit=50` - Generate embeddings for old captures
- `POST /api/backfill-titles?limit=50` - Generate display titles for old captures

### Settings & Usage
- `GET /api/settings` - Get current settings (selected model)
- `PUT /api/settings` - Update settings
- `GET /api/usage` - Get AI usage and cost data
- `GET /api/status` - Health check

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create custom category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Tags
- `GET /api/tags` - List all tags with counts
- `DELETE /api/tags/:name` - Delete a tag
- `PUT /api/tags/:name` - Rename a tag
- `POST /api/tags/merge` - Merge tags

## Implementation Status

### Phase 1: Core Intake ✅
- [x] Chrome extension with keyboard shortcut
- [x] Express backend with capture endpoint
- [x] Supabase storage
- [x] Deploy to Railway

### Phase 2: AI Processing ✅
- [x] Web scraping with Cheerio
- [x] Summarization via OpenRouter (Claude/GPT)
- [x] Auto-categorization with custom categories
- [x] Tag generation
- [x] Quality & actionability scoring
- [x] Generate embeddings (OpenAI)
- [x] AI-generated display titles
- [x] Model selection (Haiku, Sonnet, GPT-4o Mini)
- [x] Usage and cost tracking

### Phase 3: Search Interface ✅
- [x] Web dashboard with search
- [x] Semantic search via pgvector
- [x] Category and tag filters
- [x] Light/dark mode toggle
- [x] Editable categories and tags on cards

### Phase 4: Notion Integration (Planned)
- [ ] Notion API client
- [ ] Auto-sync high-score items
- [ ] Weekly digest

## Configuration

### Extension Settings

Click "Settings" in the extension popup to configure:
- **API URL**: Backend URL (default: http://localhost:3001/api)

### Model Selection

In the dashboard, go to Settings to choose your AI model:
- **Claude Haiku 4.5** - Fast and efficient (default)
- **Claude Sonnet 4** - Higher quality, slower
- **GPT-4o Mini** - Fast OpenAI alternative

### Environment Variables

Backend `.env`:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3002

# OpenRouter API (AI summarization & categorization)
# Get your key at: https://openrouter.ai/keys
OPENROUTER_API_KEY=your-openrouter-key

# OpenAI API (embeddings for semantic search)
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-key
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` (Win/Linux) | Capture current tab |
| `Cmd+Shift+S` (Mac) | Capture current tab |

## Cost Estimate

| Component | Free Tier | Paid |
|-----------|-----------|------|
| Railway | 500 hours/mo | ~$5-10/mo |
| Supabase | 500MB | $25/mo |
| OpenRouter | Pay-as-you-go | ~$2-5/mo |
| OpenAI Embeddings | Pay-as-you-go | ~$1-2/mo |
| **Total** | $0 (limited) | ~$30-40/mo |

## Troubleshooting

### Old captures missing embeddings or titles?
```bash
# Check for captures without embeddings
SELECT COUNT(*) FROM captures WHERE embedding IS NULL;

# Backfill embeddings (batch of 50)
POST /api/backfill-embeddings?limit=50

# Check for captures without display titles
SELECT COUNT(*) FROM captures WHERE display_title IS NULL;

# Backfill titles (batch of 50)
POST /api/backfill-titles?limit=50

# Or reprocess a single capture (re-runs full AI pipeline)
POST /api/reprocess/:id
```

## Development

```bash
# Backend development (with auto-reload)
cd backend
npm run dev

# The frontend is a single HTML file - just open it in your browser
# For development, you may want to serve it:
cd frontend
python -m http.server 3002
```

## Deployment

- **Backend**: Railway (auto-deploys on push to master)
- **Database**: Supabase (run migrations in SQL Editor)
- **Frontend**: Any static host (Vercel, Netlify, GitHub Pages)
- **Extension**: Chrome Web Store or manual load

## License

MIT
