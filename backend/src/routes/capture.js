import express from 'express';
import { supabase, isConfigured } from '../services/supabase.js';
import { processInBackground, processPendingCaptures, processCapture } from '../services/processor.js';
import { isConfigured as isAiConfigured, getModel as getAiModel, clearModelCache } from '../services/ai.js';
import { isConfigured as isEmbeddingsConfigured, getModel as getEmbeddingsModel, generateQueryEmbedding, formatForPgVector } from '../services/embeddings.js';
import { getUsageSummary, getTodayUsage } from '../services/usage.js';
import { getSettingsWithOptions, updateSettings } from '../services/settings.js';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../services/categories.js';
import { getTagsWithCounts, deleteTag, mergeTags, renameTag } from '../services/tags.js';

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
    const { q: query } = req.query;

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
    const { data, error } = await supabase
      .from('captures')
      .select('id, url, title, summary, category, quality_score, created_at')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content.ilike.%${query}%`)
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
    const { q: query } = req.query;
    const threshold = parseFloat(req.query.threshold) || 0.7;
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

    // Call the search_captures function
    const { data, error } = await supabase.rpc('search_captures', {
      query_embedding: vectorString,
      match_threshold: threshold,
      match_count: limit
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

    if (!isConfigured()) {
      return res.json({
        success: true,
        results: [],
        message: 'Dev mode - Supabase not configured'
      });
    }

    const { data, error } = await supabase
      .from('captures')
      .select('id, url, title, summary, category, quality_score, created_at')
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
    },
    models: {
      ai: getAiModel(),
      embeddings: getEmbeddingsModel(),
    },
    version: '2.1.0', // Phase 2 + cost tracking
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

export default router;
