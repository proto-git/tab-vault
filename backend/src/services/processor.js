// Background Processor Pipeline
// Orchestrates: scrape → AI process → embed → update

import { supabase, isConfigured as isSupabaseConfigured } from './supabase.js';
import { scrapeUrl, isScrapeable, extractAuthor } from './scraper.js';
import { processContent, generateDisplayTitle, extractInsights, isConfigured as isAiConfigured } from './ai.js';
import { generateCaptureEmbedding, formatForPgVector, isConfigured as isEmbeddingsConfigured } from './embeddings.js';
import { detectSourcePlatform } from './sourceDetector.js';
import { extractImageUrl, storeImage } from './imageStorage.js';

/**
 * Process a single capture through the AI pipeline
 * @param {string} captureId - The capture ID to process
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function processCapture(captureId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // 1. Fetch the capture
    const { data: capture, error: fetchError } = await supabase
      .from('captures')
      .select('*')
      .eq('id', captureId)
      .single();

    if (fetchError || !capture) {
      throw new Error(`Failed to fetch capture: ${fetchError?.message || 'Not found'}`);
    }

    console.log(`[Processor] Processing capture: ${capture.title || capture.url}`);

    // 2. Update status to processing
    await supabase
      .from('captures')
      .update({ status: 'processing' })
      .eq('id', captureId);

    // 3. Scrape content (if URL is scrapeable)
    let content = '';
    let rawHtml = '';
    if (isScrapeable(capture.url)) {
      console.log('[Processor] Scraping URL...');
      const scrapeResult = await scrapeUrl(capture.url);
      if (scrapeResult.success) {
        content = scrapeResult.content;
        rawHtml = scrapeResult.html || '';
        console.log(`[Processor] Scraped ${content.length} characters`);
      } else {
        console.log(`[Processor] Scrape failed: ${scrapeResult.error}`);
        // Even on failure, we might have HTML for author extraction
        rawHtml = scrapeResult.html || '';
      }
    }

    // Detect source platform from URL
    const sourcePlatform = detectSourcePlatform(capture.url);
    console.log(`[Processor] Source platform: ${sourcePlatform}`);

    // Extract author name from HTML and URL
    const authorName = extractAuthor(rawHtml, capture.url);
    if (authorName) {
      console.log(`[Processor] Extracted author: ${authorName}`);
    }

    // Extract and store image (platform-specific APIs + og:image fallback)
    let imageUrl = null;
    const sourceImageUrl = await extractImageUrl(capture.url, rawHtml);
    if (sourceImageUrl) {
      console.log(`[Processor] Found image: ${sourceImageUrl}`);
      const imageResult = await storeImage(sourceImageUrl, captureId);
      if (imageResult.success) {
        imageUrl = imageResult.url;
        console.log(`[Processor] Stored image: ${imageUrl}`);
      } else {
        console.log(`[Processor] Image storage failed: ${imageResult.error}`);
      }
    }

    // Prepare update object
    const updates = {
      content: content || null,
      processed_at: new Date().toISOString(),
      source_platform: sourcePlatform,
      author_name: authorName,
      image_url: imageUrl,
    };

    // 4. AI Processing (if configured)
    if (isAiConfigured() && (content || capture.title)) {
      console.log('[Processor] Running AI processing...');
      try {
        // Run processContent and extractInsights in parallel
        const [aiResult, insights] = await Promise.all([
          processContent(
            capture.title || capture.url,
            content || capture.title || '',
            captureId
          ),
          extractInsights(
            capture.title || capture.url,
            content || capture.title || '',
            captureId
          ),
        ]);

        updates.summary = aiResult.summary;
        updates.category = aiResult.category;
        updates.tags = aiResult.tags;
        updates.quality_score = aiResult.quality;
        updates.actionability_score = aiResult.actionability;
        updates.display_title = aiResult.displayTitle;
        updates.key_takeaways = insights.takeaways;
        updates.action_items = insights.actions;

        console.log(`[Processor] AI complete: ${aiResult.category}, quality=${aiResult.quality}, takeaways=${insights.takeaways.length}, actions=${insights.actions.length}`);
      } catch (aiError) {
        console.error('[Processor] AI processing failed:', aiError.message);
        // Continue without AI - don't fail the whole process
      }
    } else {
      console.log('[Processor] AI not configured, skipping');
    }

    // 5. Generate embeddings (if configured)
    if (isEmbeddingsConfigured()) {
      console.log('[Processor] Generating embeddings...');
      try {
        const captureForEmbedding = {
          ...capture,
          ...updates,
        };
        const embedding = await generateCaptureEmbedding(captureForEmbedding);
        updates.embedding = formatForPgVector(embedding);
        console.log('[Processor] Embeddings generated');
      } catch (embError) {
        console.error('[Processor] Embedding failed:', embError.message);
        // Continue without embeddings
      }
    } else {
      console.log('[Processor] Embeddings not configured, skipping');
    }

    // 6. Update capture with results
    updates.status = 'completed';

    const { error: updateError } = await supabase
      .from('captures')
      .update(updates)
      .eq('id', captureId);

    if (updateError) {
      throw new Error(`Failed to update capture: ${updateError.message}`);
    }

    console.log(`[Processor] Capture processed successfully: ${captureId}`);
    return { success: true };

  } catch (error) {
    console.error('[Processor] Processing failed:', error.message);

    // Update capture with error status
    if (isSupabaseConfigured()) {
      await supabase
        .from('captures')
        .update({
          status: 'error',
          error_message: error.message,
        })
        .eq('id', captureId)
        .catch(() => {});
    }

    return { success: false, error: error.message };
  }
}

/**
 * Process a capture in the background (fire and forget)
 * @param {string} captureId - The capture ID to process
 */
export function processInBackground(captureId) {
  // Use setImmediate to not block the response
  setImmediate(async () => {
    try {
      await processCapture(captureId);
    } catch (error) {
      console.error('[Processor] Background processing error:', error);
    }
  });
}

/**
 * Process all pending captures
 * Useful for batch processing or recovery
 * @returns {Promise<{processed: number, failed: number}>}
 */
export async function processPendingCaptures() {
  if (!isSupabaseConfigured()) {
    return { processed: 0, failed: 0 };
  }

  const { data: pendingCaptures, error } = await supabase
    .from('captures')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error || !pendingCaptures) {
    console.error('[Processor] Failed to fetch pending captures:', error?.message);
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const capture of pendingCaptures) {
    const result = await processCapture(capture.id);
    if (result.success) {
      processed++;
    } else {
      failed++;
    }
  }

  console.log(`[Processor] Batch complete: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

/**
 * Backfill embeddings for captures that don't have them
 * Only generates embeddings - doesn't re-run AI processing
 * @param {number} limit - Max captures to process (default 50)
 * @returns {Promise<{processed: number, failed: number, remaining: number}>}
 */
export async function backfillEmbeddings(limit = 50) {
  if (!isSupabaseConfigured()) {
    return { processed: 0, failed: 0, remaining: 0, error: 'Supabase not configured' };
  }

  if (!isEmbeddingsConfigured()) {
    return { processed: 0, failed: 0, remaining: 0, error: 'Embeddings not configured' };
  }

  // Find captures without embeddings that have been processed
  const { data: captures, error: fetchError } = await supabase
    .from('captures')
    .select('id, title, summary, category, tags, content')
    .is('embedding', null)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fetchError) {
    console.error('[Backfill] Failed to fetch captures:', fetchError.message);
    return { processed: 0, failed: 0, remaining: 0, error: fetchError.message };
  }

  if (!captures || captures.length === 0) {
    console.log('[Backfill] No captures need embeddings');
    return { processed: 0, failed: 0, remaining: 0 };
  }

  console.log(`[Backfill] Found ${captures.length} captures without embeddings`);

  let processed = 0;
  let failed = 0;

  for (const capture of captures) {
    try {
      console.log(`[Backfill] Generating embedding for: ${capture.title || capture.id}`);

      const embedding = await generateCaptureEmbedding(capture);
      const vectorString = formatForPgVector(embedding);

      const { error: updateError } = await supabase
        .from('captures')
        .update({ embedding: vectorString })
        .eq('id', capture.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      processed++;
      console.log(`[Backfill] Embedded: ${capture.id}`);
    } catch (err) {
      console.error(`[Backfill] Failed for ${capture.id}:`, err.message);
      failed++;
    }
  }

  // Check how many remain
  const { count: remaining } = await supabase
    .from('captures')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)
    .eq('status', 'completed');

  console.log(`[Backfill] Complete: ${processed} processed, ${failed} failed, ${remaining || 0} remaining`);
  return { processed, failed, remaining: remaining || 0 };
}

/**
 * Backfill display titles for captures that don't have them
 * Only generates titles - doesn't re-run full AI processing
 * @param {number} limit - Max captures to process (default 50)
 * @returns {Promise<{processed: number, failed: number, remaining: number}>}
 */
export async function backfillDisplayTitles(limit = 50) {
  if (!isSupabaseConfigured()) {
    return { processed: 0, failed: 0, remaining: 0, error: 'Supabase not configured' };
  }

  if (!isAiConfigured()) {
    return { processed: 0, failed: 0, remaining: 0, error: 'AI not configured' };
  }

  // Find captures without display_title that have been processed
  const { data: captures, error: fetchError } = await supabase
    .from('captures')
    .select('id, title, content')
    .is('display_title', null)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fetchError) {
    console.error('[BackfillTitles] Failed to fetch captures:', fetchError.message);
    return { processed: 0, failed: 0, remaining: 0, error: fetchError.message };
  }

  if (!captures || captures.length === 0) {
    console.log('[BackfillTitles] No captures need display titles');
    return { processed: 0, failed: 0, remaining: 0 };
  }

  console.log(`[BackfillTitles] Found ${captures.length} captures without display titles`);

  let processed = 0;
  let failed = 0;

  for (const capture of captures) {
    try {
      console.log(`[BackfillTitles] Generating title for: ${capture.title || capture.id}`);

      const displayTitle = await generateDisplayTitle(
        capture.title || '',
        capture.content || '',
        capture.id
      );

      const { error: updateError } = await supabase
        .from('captures')
        .update({ display_title: displayTitle })
        .eq('id', capture.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      processed++;
      console.log(`[BackfillTitles] Generated: "${displayTitle}"`);
    } catch (err) {
      console.error(`[BackfillTitles] Failed for ${capture.id}:`, err.message);
      failed++;
    }
  }

  // Check how many remain
  const { count: remaining } = await supabase
    .from('captures')
    .select('id', { count: 'exact', head: true })
    .is('display_title', null)
    .eq('status', 'completed');

  console.log(`[BackfillTitles] Complete: ${processed} processed, ${failed} failed, ${remaining || 0} remaining`);
  return { processed, failed, remaining: remaining || 0 };
}
