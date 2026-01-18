// Usage Tracking Service
// Tracks API costs and token usage

import { supabase, isConfigured } from './supabase.js';

// Pricing per million tokens (in cents)
const PRICING = {
  // Claude models
  'anthropic/claude-haiku-4.5': { input: 100, output: 500 },      // $1/$5 per M
  'anthropic/claude-sonnet-4-20250514': { input: 300, output: 1500 }, // $3/$15 per M
  'anthropic/claude-3.5-haiku': { input: 80, output: 400 },       // $0.80/$4 per M
  'anthropic/claude-3-haiku': { input: 25, output: 125 },         // $0.25/$1.25 per M
  // OpenAI models
  'openai/gpt-4o-mini': { input: 15, output: 60 },                // $0.15/$0.60 per M
  'openai/gpt-4o': { input: 250, output: 1000 },                  // $2.50/$10 per M
  // Embeddings
  'text-embedding-3-small': { input: 2, output: 0 },              // $0.02 per M (no output)
  'text-embedding-3-large': { input: 13, output: 0 },             // $0.13 per M
};

/**
 * Calculate cost in cents from token counts
 * @param {string} model - Model ID
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @returns {number} - Cost in cents
 */
export function calculateCost(model, inputTokens, outputTokens = 0) {
  const pricing = PRICING[model] || { input: 100, output: 500 }; // Default to Haiku 4.5 pricing

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  // Return cost in cents, rounded up to nearest 0.01 cent
  return Math.ceil((inputCost + outputCost) * 100) / 100;
}

/**
 * Record usage to the database
 * @param {Object} params - Usage parameters
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function recordUsage({
  captureId = null,
  service,
  model,
  operation,
  inputTokens,
  outputTokens = 0,
}) {
  if (!isConfigured()) {
    console.log('[Usage] Supabase not configured, skipping recording');
    return { success: false, error: 'Supabase not configured' };
  }

  const costCents = calculateCost(model, inputTokens, outputTokens);

  try {
    const { error } = await supabase.from('usage').insert({
      capture_id: captureId,
      service,
      model,
      operation,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_cents: Math.round(costCents * 100), // Store as integer (hundredths of cents)
    });

    if (error) {
      console.error('[Usage] Failed to record:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Usage] Recorded: ${operation} - ${inputTokens}/${outputTokens} tokens, $${(costCents / 100).toFixed(4)}`);
    return { success: true };
  } catch (err) {
    console.error('[Usage] Error recording usage:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get usage summary for a time period
 * @param {number} daysBack - Number of days to look back
 * @returns {Promise<Object>} - Usage summary
 */
export async function getUsageSummary(daysBack = 30) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Get daily breakdown
    const { data: daily, error: dailyError } = await supabase
      .rpc('get_daily_usage', { days_back: daysBack });

    if (dailyError) {
      throw dailyError;
    }

    // Get by service breakdown
    const { data: byService, error: serviceError } = await supabase
      .rpc('get_usage_by_service', { days_back: daysBack });

    if (serviceError) {
      throw serviceError;
    }

    // Calculate totals
    const totalCostCents = daily?.reduce((sum, d) => sum + (d.total_cost_cents || 0), 0) || 0;
    const totalTokens = daily?.reduce((sum, d) => sum + (d.total_tokens || 0), 0) || 0;

    return {
      success: true,
      summary: {
        totalCost: (totalCostCents / 10000).toFixed(4), // Convert from hundredths of cents to dollars
        totalTokens,
        daysBack,
      },
      daily: daily || [],
      byService: byService || [],
    };
  } catch (err) {
    console.error('[Usage] Error getting summary:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get today's usage
 * @returns {Promise<Object>} - Today's usage
 */
export async function getTodayUsage() {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('usage')
      .select('service, model, operation, input_tokens, output_tokens, cost_cents')
      .gte('created_at', today);

    if (error) {
      throw error;
    }

    const totalCostCents = data?.reduce((sum, d) => sum + (d.cost_cents || 0), 0) || 0;
    const totalTokens = data?.reduce((sum, d) => sum + (d.input_tokens || 0) + (d.output_tokens || 0), 0) || 0;

    return {
      success: true,
      today: {
        cost: (totalCostCents / 10000).toFixed(4),
        tokens: totalTokens,
        requests: data?.length || 0,
      },
    };
  } catch (err) {
    console.error('[Usage] Error getting today usage:', err.message);
    return { success: false, error: err.message };
  }
}
