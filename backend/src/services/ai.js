// AI Service using OpenRouter
// Provides summarization, categorization, and scoring

import { recordUsage } from './usage.js';
import { getSelectedModelConfig } from './settings.js';
import { DEFAULT_MODEL, getModelConfig } from '../config/models.js';
import { getCategoryPrompt } from './categories.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Cache the current model (refreshed when settings change)
let currentModelConfig = null;

/**
 * Get the current model config (from settings or default)
 */
async function getCurrentModel() {
  if (!currentModelConfig) {
    try {
      currentModelConfig = await getSelectedModelConfig();
    } catch (err) {
      console.log('[AI] Using default model:', err.message);
      currentModelConfig = getModelConfig(DEFAULT_MODEL);
    }
  }
  return currentModelConfig;
}

/**
 * Clear cached model (call when settings change)
 */
export function clearModelCache() {
  currentModelConfig = null;
}

// Export model for usage tracking (returns current model ID)
export function getModel() {
  return currentModelConfig?.id || getModelConfig(DEFAULT_MODEL).id;
}

// Check if OpenRouter is configured
export function isConfigured() {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Make a request to OpenRouter
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {string} operation - Operation name for usage tracking
 * @param {string|null} captureId - Capture ID for usage tracking
 * @returns {Promise<{content: string, usage: {input: number, output: number}}>}
 */
async function callOpenRouter(systemPrompt, userPrompt, operation = 'unknown', captureId = null) {
  if (!isConfigured()) {
    throw new Error('OpenRouter API key not configured');
  }

  // Get the selected model from settings
  const modelConfig = await getCurrentModel();

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://tab-vault.app',
      'X-Title': 'Tab Vault',
    },
    body: JSON.stringify({
      model: modelConfig.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: modelConfig.maxTokens || 500,
      temperature: modelConfig.temperature || 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract usage from response
  const usage = {
    input: data.usage?.prompt_tokens || 0,
    output: data.usage?.completion_tokens || 0,
  };

  // Record usage asynchronously (don't block response)
  recordUsage({
    captureId,
    service: 'openrouter',
    model: modelConfig.id,
    operation,
    inputTokens: usage.input,
    outputTokens: usage.output,
  }).catch(err => console.error('[AI] Failed to record usage:', err));

  return {
    content: data.choices[0]?.message?.content || '',
    usage,
  };
}

/**
 * Summarize content into 2-3 sentences
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @param {string|null} captureId - Capture ID for usage tracking
 * @returns {Promise<string>} - Summary
 */
export async function summarize(title, content, captureId = null) {
  const systemPrompt = `You are a concise summarizer. Create a 2-3 sentence summary that captures the key points and value of the content. Focus on what makes this content useful or interesting. Return plain text only - do not use markdown formatting, headers, or bullet points.`;

  const userPrompt = `Title: ${title}

Content:
${content.slice(0, 8000)}

Provide a 2-3 sentence summary:`;

  const response = await callOpenRouter(systemPrompt, userPrompt, 'summarize', captureId);
  return response.content;
}

/**
 * Categorize content and generate tags
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @param {string|null} captureId - Capture ID for usage tracking
 * @returns {Promise<{category: string, tags: string[]}>}
 */
export async function categorize(title, content, captureId = null) {
  // Get dynamic categories from database
  const categoryList = await getCategoryPrompt();

  const systemPrompt = `You categorize web content. Respond with JSON only, no other text.

Categories (pick one):
${categoryList}

Tags: Generate 2-4 relevant lowercase tags.

Response format: {"category": "learning", "tags": ["javascript", "tutorial"]}`;

  const userPrompt = `Title: ${title}

Content:
${content.slice(0, 4000)}

Categorize this content:`;

  const response = await callOpenRouter(systemPrompt, userPrompt, 'categorize', captureId);

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (e) {
    console.error('[AI] Failed to parse categorization:', e.message);
    return { category: 'reference', tags: [] };
  }
}

/**
 * Score content for quality and actionability
 * @param {string} title - Page title
 * @param {string} summary - Content summary
 * @param {string} category - Content category
 * @param {string|null} captureId - Capture ID for usage tracking
 * @returns {Promise<{quality: number, actionability: number}>}
 */
export async function score(title, summary, category, captureId = null) {
  const systemPrompt = `You rate content quality and actionability. Respond with JSON only.

Quality (1-10): How valuable, well-written, and informative is this content?
- 1-3: Low quality, thin content, spam-like
- 4-6: Average quality, somewhat useful
- 7-9: High quality, valuable information
- 10: Exceptional, must-save content

Actionability (1-10): How likely is this to lead to action or be referenced again?
- 1-3: Passive reading, unlikely to revisit
- 4-6: Might reference later
- 7-9: Will definitely use or act on this
- 10: Immediate action required

Response format: {"quality": 7, "actionability": 5}`;

  const userPrompt = `Title: ${title}
Category: ${category}
Summary: ${summary}

Rate this content:`;

  const response = await callOpenRouter(systemPrompt, userPrompt, 'score', captureId);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        quality: Math.min(10, Math.max(1, parseInt(parsed.quality) || 5)),
        actionability: Math.min(10, Math.max(1, parseInt(parsed.actionability) || 5)),
      };
    }
    throw new Error('No JSON found in response');
  } catch (e) {
    console.error('[AI] Failed to parse scores:', e.message);
    return { quality: 5, actionability: 5 };
  }
}

/**
 * Generate a clean display title
 * @param {string} title - Original page title
 * @param {string} content - Page content (for context)
 * @param {string|null} captureId - Capture ID for usage tracking
 * @returns {Promise<string>} - Clean display title
 */
export async function generateDisplayTitle(title, content, captureId = null) {
  const systemPrompt = `You create concise, descriptive titles. Your task:
1. Create a clean, readable title (max 80 characters)
2. Remove platform prefixes (like "X:", "YouTube -", etc.)
3. Remove URLs from the title
4. Capture the essence of the content
5. If the original title is already clean and under 80 chars, return it as-is

Return ONLY the title, no quotes or explanation.`;

  const userPrompt = `Original title: ${title}

Content preview:
${content.slice(0, 1000)}

Generate a clean title:`;

  const response = await callOpenRouter(systemPrompt, userPrompt, 'title', captureId);

  // Clean up the response (remove quotes if present)
  let cleanTitle = response.content.trim();
  cleanTitle = cleanTitle.replace(/^["']|["']$/g, '');

  // Ensure max length
  if (cleanTitle.length > 80) {
    cleanTitle = cleanTitle.slice(0, 77) + '...';
  }

  return cleanTitle;
}

/**
 * Process content through all AI steps
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @param {string|null} captureId - Capture ID for usage tracking
 * @returns {Promise<{summary: string, category: string, tags: string[], quality: number, actionability: number, displayTitle: string}>}
 */
export async function processContent(title, content, captureId = null) {
  // Run summarize, categorize, and title generation in parallel
  const [summary, categoryResult, displayTitle] = await Promise.all([
    summarize(title, content, captureId),
    categorize(title, content, captureId),
    generateDisplayTitle(title, content, captureId),
  ]);

  // Score based on summary
  const scores = await score(title, summary, categoryResult.category, captureId);

  return {
    summary,
    category: categoryResult.category,
    tags: categoryResult.tags,
    quality: scores.quality,
    actionability: scores.actionability,
    displayTitle,
  };
}
