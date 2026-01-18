// Background Processor Pipeline
// Orchestrates: scrape → AI process → embed → update

import { supabase, isConfigured as isSupabaseConfigured } from './supabase.js';
import { scrapeUrl, isScrapeable } from './scraper.js';
import { processContent, isConfigured as isAiConfigured } from './ai.js';
import { generateCaptureEmbedding, formatForPgVector, isConfigured as isEmbeddingsConfigured } from './embeddings.js';

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
    if (isScrapeable(capture.url)) {
      console.log('[Processor] Scraping URL...');
      const scrapeResult = await scrapeUrl(capture.url);
      if (scrapeResult.success) {
        content = scrapeResult.content;
        console.log(`[Processor] Scraped ${content.length} characters`);
      } else {
        console.log(`[Processor] Scrape failed: ${scrapeResult.error}`);
      }
    }

    // Prepare update object
    const updates = {
      content: content || null,
      processed_at: new Date().toISOString(),
    };

    // 4. AI Processing (if configured)
    if (isAiConfigured() && (content || capture.title)) {
      console.log('[Processor] Running AI processing...');
      try {
        const aiResult = await processContent(
          capture.title || capture.url,
          content || capture.title || ''
        );

        updates.summary = aiResult.summary;
        updates.category = aiResult.category;
        updates.tags = aiResult.tags;
        updates.quality_score = aiResult.quality;
        updates.actionability_score = aiResult.actionability;

        console.log(`[Processor] AI complete: ${aiResult.category}, quality=${aiResult.quality}`);
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
