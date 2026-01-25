# Tab Vault Feature Backlog

> Generated: January 25, 2026
>
> Comprehensive feature ideas from multi-agent codebase review covering backend, frontend, integrations, and AI functionality.

---

## Table of Contents

- [AI-Powered Features](#ai-powered-features)
- [Backend Enhancements](#backend-enhancements)
- [Frontend & UX](#frontend--ux)
- [Integrations](#integrations)
- [Quick Reference](#quick-reference)

---

## AI-Powered Features

### 1. Nano Banana 🍌
**Visual Infographic Generation from Summaries**

| | |
|---|---|
| **Description** | Transform capture summaries into shareable visual infographics using AI image generation |
| **Technical Approach** | Add new AI service using DALL-E 3 or Stable Diffusion via OpenRouter. Take summary + key takeaways and generate infographic-style images. Store in existing `capture-images` Supabase bucket. New endpoint `POST /api/captures/:id/generate-infographic`. Display in modal with download/share buttons. |
| **Complexity** | High |

---

### 2. Vision Vault
**AI Vision Analysis for Screenshots and Image-Heavy Content**

| | |
|---|---|
| **Description** | Automatically analyze images and screenshots using vision AI to extract text, diagrams, and visual insights |
| **Technical Approach** | Extend `imageStorage.js` to process stored images through Claude Vision or GPT-4V. Extract chart data, diagram descriptions, text from screenshots. Store in new `visual_insights` JSON column. Makes image content searchable via semantic search. |
| **Complexity** | Medium |

---

### 3. Thread Weaver
**Auto-Generate Twitter/LinkedIn Threads from Long-Form Content**

| | |
|---|---|
| **Description** | Convert article summaries into engaging Twitter/LinkedIn thread formats optimized for social sharing |
| **Technical Approach** | New endpoint `POST /api/captures/:id/generate-thread`. Break down summaries into tweet-sized chunks (280 chars) with hooks, numbered sequences, and CTAs. Return array of posts with character counts and hashtag suggestions. "Share as Thread" button in modal. |
| **Complexity** | Low |

---

### 4. Smart Collections (AI)
**AI-Powered Auto-Collections Based on Content Clustering**

| | |
|---|---|
| **Description** | Automatically group related captures into thematic collections using embedding-based clustering |
| **Technical Approach** | Background job using k-means clustering on embeddings. AI generates collection names/descriptions. New `collections` table with many-to-many relationship. Browse collections like "React Performance Articles" or "Career Growth Resources". |
| **Complexity** | Medium |

---

### 5. Insight Digest
**Weekly AI-Generated Newsletter from Your Captures**

| | |
|---|---|
| **Description** | Generate personalized weekly digest summarizing your week's captures with themes, patterns, and actionable insights |
| **Technical Approach** | Scheduled job fetches week's captures, analyzes categories/tags, identifies trends. AI writes newsletter-style summary: "This Week's Focus", "Hidden Gems", "Action Items". Store in `digests` table, send via email. |
| **Complexity** | Medium |

---

### 6. Duplicate Detective
**AI-Powered Duplicate & Near-Duplicate Detection**

| | |
|---|---|
| **Description** | Automatically detect duplicate or similar captures using semantic similarity and suggest merges |
| **Technical Approach** | Check new captures against existing using embedding similarity (threshold >0.95). Flag in `duplicate_candidates` table. AI analyzes if URLs differ but content is identical. Provide "merge" action keeping better version. |
| **Complexity** | Low-Medium |

---

### 7. Context Companion
**Just-in-Time Capture Recommendations Based on Current Tab**

| | |
|---|---|
| **Description** | Browser extension shows relevant past captures while browsing, based on semantic similarity to current page |
| **Technical Approach** | Extension monitors active tab URL changes. Send context to `POST /api/recommend?context=...`. Quick embedding query returns top 3-5 related items. Unobtrusive notification: "You saved 3 related items: [links]". |
| **Complexity** | Medium |

---

### 8. Learning Path Generator
**AI-Curated Learning Sequences from Saved Content**

| | |
|---|---|
| **Description** | Organize captures into sequential learning paths based on topic complexity and prerequisites |
| **Technical Approach** | AI analyzes captures by category using summaries, quality scores, takeaways. Identify prerequisite relationships and complexity levels. Generate ordered paths with estimated read time. New `learning_paths` table with progress tracking. |
| **Complexity** | High |

---

## Backend Enhancements

### 9. TLDR on Demand
**Smart Content Summarization Levels**

| | |
|---|---|
| **Description** | Generate multiple summary lengths (tweet, paragraph, detailed) on request via API parameter |
| **Technical Approach** | Extend `ai.js` with `summaryLength` parameter (short/medium/long). Different prompts and token limits per length. Store in `summary_short`, `summary_medium`, `summary_long` columns or generate on-demand with caching. |
| **Complexity** | Low |

---

### 10. Time Capsules
**Temporal Collections & Auto-Archiving**

| | |
|---|---|
| **Description** | Automatically group captures by time periods with AI-generated collection summaries |
| **Technical Approach** | New `collections.js` service on cron job. Aggregate by week/month/quarter. AI generates meta-summaries like "This week you explored 3 themes: AI tooling, database optimization, UX patterns." New `collections` table. |
| **Complexity** | Medium |

---

### 11. Stale Check
**Content Freshness Monitoring**

| | |
|---|---|
| **Description** | Re-scrape URLs periodically to detect content changes and notify when saved articles are updated |
| **Technical Approach** | Add `last_checked_at` column. New `freshnessMonitor.js` re-scrapes URLs older than X days. Compare content hash, set `content_updated: true` if changed, optionally re-run AI. Endpoints: `POST /api/check-freshness/:id` and `/batch`. |
| **Complexity** | Medium |

---

### 12. De-Dupe Detective
**Duplicate Detection & Clustering**

| | |
|---|---|
| **Description** | Use embedding similarity to identify near-duplicate captures and suggest merges or groupings |
| **Technical Approach** | New RPC function `find_duplicate_captures(threshold: 0.95)`. Endpoint `/api/duplicates` returns clusters. Add `merged_into_id` column for tracking merged captures. Filter merged items from results. |
| **Complexity** | Medium |

---

### 13. Know Before You Go
**AI-Powered Reading Time & Difficulty Scoring**

| | |
|---|---|
| **Description** | Estimate reading time and technical difficulty level for each capture to help prioritize learning |
| **Technical Approach** | New fields `reading_time_minutes` and `difficulty_score` (1-10). New `assessReadability()` in `ai.js` analyzes complexity, jargon density, length. Run in `processContent()` pipeline. Add filters to search endpoints. |
| **Complexity** | Low |

---

### 14. Connection Finder
**Cross-Reference Graph**

| | |
|---|---|
| **Description** | Build a knowledge graph showing captures that reference each other or share common concepts |
| **Technical Approach** | New `capture_references` table with relationship types ('mentions_url', 'semantic_similar', 'same_author'). Detect URL mentions in content, use embeddings for clustering, group by author. Endpoint `/api/captures/:id/connections` returns graph structure. |
| **Complexity** | High |

---

### 15. Retroactive Enrichment
**Smart Backfill Pipeline**

| | |
|---|---|
| **Description** | Re-process old captures with new AI models or extraction techniques without full re-scraping |
| **Technical Approach** | Generic `POST /api/backfill/:operation` endpoint (embeddings, titles, insights, images, authors, etc.). New `backfillManager.js` queues and tracks operations. `backfill_status` table for progress and resumption. |
| **Complexity** | Medium |

---

### 16. Relevance Aging
**Content Quality Decay Model**

| | |
|---|---|
| **Description** | Automatically adjust quality scores over time based on content type to surface timely content |
| **Technical Approach** | Add `relevance_decay_rate` by category (news decays fast, reference stays fresh). New `adjusted_quality_score` column: `quality_score * exp(-decay_rate * days_old)`. Daily cron recalculates. Sort by relevance in search. |
| **Complexity** | Medium |

---

## Frontend & UX

### 17. History Lane
**Timeline View**

| | |
|---|---|
| **Description** | Visualize captures on an interactive timeline with date-based browsing and filters |
| **Technical Approach** | New view mode toggle rendering captures as nodes on vertical timeline, grouped by day/week/month. CSS Grid with `grid-template-rows`. Smooth scroll-to-date functionality. Leverage existing `formatDate()` logic. |
| **Complexity** | Medium |

---

### 18. Bundles
**Smart Collections UI**

| | |
|---|---|
| **Description** | Auto-generate collections of related captures based on topic clusters |
| **Technical Approach** | New sidebar section for collections. Use `/captures/:id/related` endpoint to build clusters. Store collection metadata in localStorage/IndexedDB. Manual collection creation with drag-and-drop. |
| **Complexity** | High |

---

### 19. Stack
**Reading Queue**

| | |
|---|---|
| **Description** | Mark captures as "to read" with priority ordering and reading progress tracking |
| **Technical Approach** | New capture status field (prototype with localStorage). "Add to Stack" button in modal, dedicated sidebar nav showing queue count. Drag-to-reorder, "mark as read" action, visual progress indicator. |
| **Complexity** | Medium |

---

### 20. Peek Mode
**Quick Capture Preview**

| | |
|---|---|
| **Description** | Hover over capture cards to see an iframe preview of the actual page without opening modal |
| **Technical Approach** | `@mouseover` event with 500ms debounce. Floating preview panel with iframe (sandbox attributes). Blur/fade background, smooth animations. Handle sites blocking iframes gracefully. |
| **Complexity** | Medium |

---

### 21. Tag Galaxy
**Visual Tag Cloud**

| | |
|---|---|
| **Description** | Interactive tag visualization showing size-weighted bubbles for tag frequency, clickable for filtering |
| **Technical Approach** | New view with tags as CSS-sized bubbles (font-size based on count). Flexbox with wrapping and hover effects. On click, apply tag filter. Could use D3.js or CSS transforms for animation. Fetch from `/tags` endpoint. |
| **Complexity** | Low-Medium |

---

### 22. Commander
**Keyboard Command Palette**

| | |
|---|---|
| **Description** | Vim-style command palette (Cmd+K) for power users to search, filter, navigate, and execute actions |
| **Technical Approach** | Global keydown listener for `Cmd/Ctrl+K`. Modal with fuzzy search input. Commands: "filter:learning", "open:settings", "search:query", "sort:quality". Recent commands in localStorage for auto-complete. |
| **Complexity** | Medium |

---

### 23. Activity Map
**Capture Heatmap**

| | |
|---|---|
| **Description** | Calendar-style heatmap (GitHub contribution graph style) showing capture frequency over time |
| **Technical Approach** | Stats widget with grid of date cells (7 cols × N rows). Group captures by date, apply color intensity by count. CSS Grid with `repeat(7, 1fr)`. Click cell to filter. Tooltip shows exact count. |
| **Complexity** | Low-Medium |

---

### 24. Swipe Deck
**Mobile-Optimized Gesture Navigation**

| | |
|---|---|
| **Description** | Tinder-like swipe interface for mobile browsing - swipe right to save, left to archive, up for details |
| **Technical Approach** | Touch event listeners (`touchstart`, `touchmove`, `touchend`). Swipe detection with >100px threshold. Animate card transform during drag. Trigger action on release. Works within existing `@media (max-width: 900px)`. |
| **Complexity** | Medium |

---

## Integrations

### 25. Vault Bridge
**Obsidian Bidirectional Sync**

| | |
|---|---|
| **Description** | Two-way sync between Tab Vault and Obsidian vault with markdown conversion and backlink support |
| **Technical Approach** | New `obsidian.js` service using Obsidian's Local REST API plugin. Export as markdown with frontmatter (tags, category, quality_score). Import notes by watching vault folder. Support `[[wikilinks]]` via related_captures. |
| **Complexity** | Medium-High |

---

### 26. Reader Relay
**Readwise Reader Integration**

| | |
|---|---|
| **Description** | Automatically sync highlights and annotations from Readwise Reader with AI-enhanced context |
| **Technical Approach** | Poll Readwise API hourly for highlights. Create captures with `source_platform: 'readwise'`. Store highlights in `highlights` JSONB field. Run AI extractInsights on highlight clusters. Webhook endpoint for real-time sync. |
| **Complexity** | Medium |

---

### 27. Slack Vault
**Slack Knowledge Base Connector**

| | |
|---|---|
| **Description** | Capture valuable Slack messages/threads directly to Tab Vault with team attribution and context |
| **Technical Approach** | Slack app with message action "Save to Tab Vault". OAuth and API in `slack.js`. Capture message + thread context, author info, channel metadata. Auto-capture starred messages or specific emoji reactions. |
| **Complexity** | Medium |

---

### 28. Time Machine
**Browser History Mining**

| | |
|---|---|
| **Description** | Retroactively import and process browser history to populate Tab Vault with past discoveries |
| **Technical Approach** | Extension reads `chrome.history` API. Filter by visit count, time spent, domain whitelist. Batch import via `POST /api/import/bulk` (rate-limited). Async processor pipeline. Progress in extension popup. Deduplication by URL. |
| **Complexity** | Low-Medium |

---

### 29. Zapier Lite
**Webhook Automation Hub**

| | |
|---|---|
| **Description** | Trigger external webhooks when captures match rules (quality threshold, categories, tags) |
| **Technical Approach** | New `webhooks` table with trigger types and filter rules. After AI processing, evaluate webhooks and send POST requests. CRUD endpoints at `/api/webhooks`. Activity log in extension. Integrate with Zapier, Make, n8n. |
| **Complexity** | Medium |

---

### 30. Knowledge Graph
**Cross-Capture Relationship Graph**

| | |
|---|---|
| **Description** | Visualize and navigate connections between captures using semantic similarity, shared tags, and citation detection |
| **Technical Approach** | Extend `search_related_captures`. New `/graph` page with D3.js/Cytoscape.js. Nodes = captures (sized by quality), edges = similarity. Citation detection in scraper (extract URLs from content). Endpoint `/api/graph/:id` with depth parameter. |
| **Complexity** | High |

---

## Quick Reference

### By Complexity

| Low | Low-Medium | Medium | Medium-High | High |
|-----|------------|--------|-------------|------|
| Thread Weaver | Duplicate Detective | Vision Vault | Obsidian Sync | Nano Banana |
| TLDR on Demand | Tag Galaxy | Smart Collections | | Learning Paths |
| Reading Time | Activity Map | Insight Digest | | Bundles |
| | Time Machine | Context Companion | | Knowledge Graph |
| | | Time Capsules | | Connection Finder |
| | | Stale Check | | |
| | | De-Dupe Detective | | |
| | | Retroactive Enrichment | | |
| | | Relevance Aging | | |
| | | Timeline View | | |
| | | Reading Queue | | |
| | | Peek Mode | | |
| | | Commander | | |
| | | Swipe Deck | | |
| | | Readwise Sync | | |
| | | Slack Vault | | |
| | | Webhook Hub | | |

### Most Impactful (Recommended Priority)

1. **Nano Banana** - Unique visual differentiation
2. **Vision Vault** - Unlocks image content for search
3. **Smart Collections** - Better organization
4. **Commander** - Power user retention
5. **Reading Queue (Stack)** - Core workflow feature
6. **Obsidian Sync** - Popular PKM integration
7. **Weekly Digest** - Engagement driver

---

## Notes

- All features should follow existing patterns in `processor.js` for async processing
- AI features should track usage via existing `usage.js` service
- New database tables should include `user_id` column for future multi-user support
- Consider feature flags for gradual rollout of experimental features

---

*Last updated: January 25, 2026*
