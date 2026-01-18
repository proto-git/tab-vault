import express from 'express';
import { supabase, isConfigured } from '../services/supabase.js';
import { processInBackground, processPendingCaptures, processCapture } from '../services/processor.js';
import { isConfigured as isAiConfigured } from '../services/ai.js';
import { isConfigured as isEmbeddingsConfigured } from '../services/embeddings.js';

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
    version: '2.0.0', // Phase 2
  });
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

export default router;
