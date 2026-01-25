import express from 'express';
import { supabase, isConfigured } from '../services/supabase.js';
import { processInBackground, processPendingCaptures, processCapture, backfillEmbeddings, backfillDisplayTitles } from '../services/processor.js';
import { isConfigured as isAiConfigured, getModel as getAiModel, clearModelCache } from '../services/ai.js';
import { isConfigured as isEmbeddingsConfigured, getModel as getEmbeddingsModel, generateQueryEmbedding, formatForPgVector } from '../services/embeddings.js';
import { getUsageSummary, getTodayUsage } from '../services/usage.js';
import { getSettingsWithOptions, updateSettings } from '../services/settings.js';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../services/categories.js';
import { getTagsWithCounts, deleteTag, mergeTags, renameTag } from '../services/tags.js';
import { isConfigured as isNotionConfigured, testConnection as testNotionConnection, syncCapture, syncMultiple } from '../services/notion.js';
import { deleteImages } from '../services/imageStorage.js';

const router = express.Router();

// POST /api/capture - Capture a new URL
router.post('/capture', async (req, res, next) => {
  try {
    const { url, title, selectedText, favIconUrl } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Check if Supabase is configured
    if (!isConfigured()) {
      // Return mock response for development without Supabase
      console.log('[DEV MODE] Would capture:', { url, title });
      return res.json({
        success: true,
        message: 'Captured (dev mode - Supabase not configured)',
        data: {
          id: 'dev-' + Date.now(),
          url,
          title,
          category: 'uncategorized',
          created_at: new Date().toISOString()
        }
      });
    }

    // Check for duplicate URL (captured in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('captures')
      .select('id')
      .eq('url', url)
      .gte('created_at', oneDayAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({
        success: true,
        message: 'Already captured recently',
        data: existing[0]
      });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('captures')
      .insert({
        url,
        title: title || url,
        selected_text: selectedText || null,
        favicon_url: favIconUrl || null,
        status: 'pending', // Will be processed by AI in Phase 2
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('[CAPTURED]', url);

    // Queue for AI processing (runs in background)
    processInBackground(data.id);

    res.json({
      success: true,
      message: 'Captured successfully',
      data: {
        id: data.id,
        url: data.url,
        title: data.title,
        category: data.category || 'processing...',
        created_at: data.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search - Search captures
router.get('/search', async (req, res, next) => {
  try {
    const { q: query, source } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    if (!isConfigured()) {
      return res.json({
        success: true,
        results: [],
        message: 'Dev mode - Supabase not configured'
      });
    }

    // Basic text search (Phase 3 will add vector/semantic search)
    let queryBuilder = supabase
      .from('captures')
      .select('id, url, title, display_title, summary, category, tags, quality_score, created_at, notion_synced, notion_page_id, key_takeaways, action_items, source_platform, author_name, image_url')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content.ilike.%${query}%`);

    // Apply source filter if provided
    if (source) {
      queryBuilder = queryBuilder.eq('source_platform', source);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      results: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/semantic-search - Semantic search using embeddings
router.get('/semantic-search', async (req, res, next) => {
  try {
    const { q: query, source } = req.query;
    const threshold = parseFloat(req.query.threshold) || 0.4;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    if (!isConfigured()) {
      return res.json({
        success: true,
        results: [],
        message: 'Dev mode - Supabase not configured'
      });
    }

    if (!isEmbeddingsConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Embeddings not configured - missing OpenAI API key'
      });
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateQueryEmbedding(query);
    const vectorString = formatForPgVector(queryEmbedding);

    // Call the search_captures function with optional source filter
    const { data, error } = await supabase.rpc('search_captures', {
      query_embedding: vectorString,
      match_threshold: threshold,
      match_count: limit,
      filter_source: source || null
    });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      results: data || [],
      count: data?.length || 0,
      searchType: 'semantic'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/recent - Get recent captures
router.get('/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const { source, author } = req.query;

    if (!isConfigured()) {
      return res.json({
        success: true,
        results: [],
        message: 'Dev mode - Supabase not configured'
      });
    }

    let queryBuilder = supabase
      .from('captures')
      .select('id, url, title, display_title, summary, category, tags, quality_score, created_at, notion_synced, notion_page_id, key_takeaways, action_items, source_platform, author_name, image_url');

    // Apply source filter if provided
    if (source) {
      queryBuilder = queryBuilder.eq('source_platform', source);
    }

    // Apply author filter if provided
    if (author) {
      queryBuilder = queryBuilder.ilike('author_name', `%${author}%`);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      results: data || []
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/capture/:id - Get a single capture
router.get('/capture/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured()) {
      return res.status(404).json({
        success: false,
        error: 'Not found (dev mode)'
      });
    }

    const { data, error } = await supabase
      .from('captures')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Capture not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/captures/:id/related - Get semantically related captures
router.get('/captures/:id/related', async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 10);

    if (!isConfigured()) {
      return res.json({
        success: true,
        results: [],
        message: 'Dev mode - Supabase not configured'
      });
    }

    // Use raw SQL query with pgvector to find similar captures
    const { data, error } = await supabase.rpc('get_related_captures', {
      capture_id: id,
      match_count: limit
    });

    if (error) {
      // If RPC doesn't exist, fall back to direct query
      if (error.code === '42883') {
        // Function doesn't exist - use direct query approach
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('captures')
          .select('id, url, title, display_title, category, tags, created_at')
          .neq('id', id)
          .not('embedding', 'is', null)
          .limit(limit);

        if (fallbackError) {
          throw fallbackError;
        }

        // Return results without similarity scores (fallback)
        res.json({
          success: true,
          results: (fallbackData || []).map(item => ({
            ...item,
            similarity: null
          })),
          fallback: true
        });
        return;
      }
      throw error;
    }

    res.json({
      success: true,
      results: data || []
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/captures/:id - Update a capture's category and/or tags
router.patch('/captures/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, tags } = req.body;

    if (!isConfigured()) {
      return res.json({
        success: true,
        message: 'Updated (dev mode)',
        data: { id, category, tags }
      });
    }

    // Build update object with only provided fields
    const updates = {};
    if (category !== undefined) {
      updates.category = category;
    }
    if (tags !== undefined) {
      // Ensure tags is an array
      updates.tags = Array.isArray(tags) ? tags : [];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update. Provide category and/or tags.'
      });
    }

    const { data, error } = await supabase
      .from('captures')
      .update(updates)
      .eq('id', id)
      .select('id, url, title, display_title, summary, category, tags, quality_score, created_at, notion_synced, notion_page_id, key_takeaways, action_items, source_platform, author_name, image_url')
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Capture not found'
      });
    }

    console.log(`[UPDATED] Capture ${id}:`, updates);

    res.json({
      success: true,
      message: 'Capture updated',
      data
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/capture/:id - Delete a capture
router.delete('/capture/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured()) {
      return res.json({
        success: true,
        message: 'Deleted (dev mode)'
      });
    }

    const { error } = await supabase
      .from('captures')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/status - Service status (admin)
router.get('/status', async (req, res) => {
  res.json({
    success: true,
    services: {
      supabase: isConfigured(),
      ai: isAiConfigured(),
      embeddings: isEmbeddingsConfigured(),
      notion: isNotionConfigured(),
    },
    models: {
      ai: getAiModel(),
      embeddings: getEmbeddingsModel(),
    },
    version: '3.0.0', // Phase 4 - Notion sync
  });
});

// GET /api/usage - Get usage statistics (admin)
router.get('/usage', async (req, res, next) => {
  try {
    const daysBack = Math.min(parseInt(req.query.days) || 30, 90);

    // Get both summary and today's usage in parallel
    const [summary, today] = await Promise.all([
      getUsageSummary(daysBack),
      getTodayUsage(),
    ]);

    if (!summary.success) {
      return res.json({
        success: false,
        error: summary.error,
      });
    }

    res.json({
      success: true,
      today: today.success ? today.today : null,
      summary: summary.summary,
      daily: summary.daily,
      byService: summary.byService,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/process-pending - Process pending captures (admin)
router.post('/process-pending', async (req, res, next) => {
  try {
    const result = await processPendingCaptures();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/reprocess/:id - Reprocess a specific capture (admin)
router.post('/reprocess/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await processCapture(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/backfill-embeddings - Generate embeddings for captures that don't have them
router.post('/backfill-embeddings', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const result = await backfillEmbeddings(limit);
    res.json({
      success: !result.error,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/backfill-titles - Generate display titles for captures that don't have them
router.post('/backfill-titles', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const result = await backfillDisplayTitles(limit);
    res.json({
      success: !result.error,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/settings - Get current settings with available options
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSettingsWithOptions();
    res.json({
      success: true,
      ...settings,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings - Update settings
router.put('/settings', async (req, res, next) => {
  try {
    const { aiModel } = req.body;

    const result = await updateSettings({ aiModel });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Clear AI model cache so next request uses new model
    clearModelCache();

    // Return updated settings
    const settings = await getSettingsWithOptions();
    res.json({
      success: true,
      message: 'Settings updated',
      ...settings,
    });
  } catch (error) {
    next(error);
  }
});

// ============ Categories ============

// GET /api/categories - Get all categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await getCategories();
    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/categories - Add a new category
router.post('/categories', async (req, res, next) => {
  try {
    const { name, description, color } = req.body;

    const result = await addCategory({ name, description, color });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:id - Update a category
router.put('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;

    const result = await updateCategory(id, { name, description, color });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await deleteCategory(id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============ Tags ============

// GET /api/tags - Get all tags with counts
router.get('/tags', async (req, res, next) => {
  try {
    const result = await getTagsWithCounts();

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tags/:name - Delete a tag from all captures
router.delete('/tags/:name', async (req, res, next) => {
  try {
    const { name } = req.params;

    const result = await deleteTag(name);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/tags/merge - Merge one tag into another
router.post('/tags/merge', async (req, res, next) => {
  try {
    const { source, target } = req.body;

    const result = await mergeTags(source, target);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tags/:name - Rename a tag
router.put('/tags/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const { newName } = req.body;

    const result = await renameTag(name, newName);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============ Notion Sync ============

// GET /api/notion/status - Check Notion connection status
router.get('/notion/status', async (req, res, next) => {
  try {
    if (!isNotionConfigured()) {
      return res.json({
        success: true,
        configured: false,
        message: 'Notion not configured. Set NOTION_API_KEY and NOTION_DATABASE_ID.',
      });
    }

    const result = await testNotionConnection();

    res.json({
      success: true,
      configured: true,
      connected: result.success,
      database: result.database,
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notion/sync/:id - Sync a single capture to Notion
router.post('/notion/sync/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isNotionConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Notion not configured',
      });
    }

    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured',
      });
    }

    // Get the capture
    const { data: capture, error: fetchError } = await supabase
      .from('captures')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !capture) {
      return res.status(404).json({
        success: false,
        error: 'Capture not found',
      });
    }

    // Sync to Notion
    const result = await syncCapture(capture);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Update capture with Notion sync info
    await supabase
      .from('captures')
      .update({
        notion_synced: true,
        notion_page_id: result.pageId,
        notion_synced_at: new Date().toISOString(),
      })
      .eq('id', id);

    console.log(`[Notion] Synced capture ${id} -> ${result.pageId}`);

    res.json({
      success: true,
      message: result.created ? 'Created in Notion' : 'Updated in Notion',
      pageId: result.pageId,
      pageUrl: result.pageUrl,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notion/sync-all - Sync all unsynced captures to Notion
router.post('/notion/sync-all', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    if (!isNotionConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Notion not configured',
      });
    }

    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured',
      });
    }

    // Get unsynced captures
    const { data: captures, error: fetchError } = await supabase
      .from('captures')
      .select('*')
      .eq('status', 'completed')
      .or('notion_synced.is.null,notion_synced.eq.false')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!captures || captures.length === 0) {
      return res.json({
        success: true,
        message: 'No captures to sync',
        synced: 0,
      });
    }

    // Sync all captures
    const results = await syncMultiple(captures);

    // Update synced captures in database
    for (const synced of results.synced) {
      await supabase
        .from('captures')
        .update({
          notion_synced: true,
          notion_page_id: synced.pageId,
          notion_synced_at: new Date().toISOString(),
        })
        .eq('id', synced.id);
    }

    console.log(`[Notion] Bulk sync: ${results.success} synced, ${results.failed} failed`);

    res.json({
      success: true,
      synced: results.success,
      failed: results.failed,
      errors: results.errors,
    });
  } catch (error) {
    next(error);
  }
});

// ============ Image Cleanup ============

// POST /api/cleanup-images - Delete stale images from storage
// Deletes images for captures that are:
// 1. Not synced to Notion AND
// 2. Older than X days (default 30)
router.post('/cleanup-images', async (req, res, next) => {
  try {
    const daysOld = Math.max(parseInt(req.query.days) || 30, 7); // Minimum 7 days
    const dryRun = req.query.dry_run === 'true';

    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured',
      });
    }

    // Calculate cutoff date
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    // Find captures with images that are:
    // - Not synced to Notion
    // - Older than cutoff date
    // - Have an image_url
    const { data: staleCaptures, error: fetchError } = await supabase
      .from('captures')
      .select('id, image_url, created_at')
      .not('image_url', 'is', null)
      .or('notion_synced.is.null,notion_synced.eq.false')
      .lt('created_at', cutoffDate);

    if (fetchError) {
      throw fetchError;
    }

    if (!staleCaptures || staleCaptures.length === 0) {
      return res.json({
        success: true,
        message: 'No stale images to clean up',
        deleted: 0,
        dryRun,
      });
    }

    // Extract filenames from image URLs
    // URLs are like: https://xxx.supabase.co/storage/v1/object/public/capture-images/uuid.jpg
    const filenames = staleCaptures
      .map(c => {
        const match = c.image_url.match(/capture-images\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    if (dryRun) {
      return res.json({
        success: true,
        message: `Would delete ${filenames.length} images`,
        dryRun: true,
        captures: staleCaptures.map(c => ({ id: c.id, created_at: c.created_at })),
      });
    }

    // Delete images from storage
    const deleteResult = await deleteImages(filenames);

    // Clear image_url from captures
    if (deleteResult.success > 0) {
      const idsToUpdate = staleCaptures.map(c => c.id);
      await supabase
        .from('captures')
        .update({ image_url: null })
        .in('id', idsToUpdate);
    }

    console.log(`[Cleanup] Deleted ${deleteResult.success} stale images (${daysOld}+ days old, not synced to Notion)`);

    res.json({
      success: true,
      deleted: deleteResult.success,
      failed: deleteResult.failed,
      daysOld,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
