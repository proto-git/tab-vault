// Embeddings Service using OpenAI
// Generates vector embeddings for semantic search

import OpenAI from 'openai';

// Use text-embedding-3-small (1536 dimensions, cost-effective)
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

let openai = null;

/**
 * Initialize OpenAI client
 */
function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Check if embeddings are configured
 */
export function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text) {
  const client = getClient();

  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  // Truncate text if too long (8191 tokens max for embedding model)
  // Rough estimate: 4 chars per token
  const maxChars = 30000;
  const truncatedText = text.length > maxChars
    ? text.slice(0, maxChars)
    : text;

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedText,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embedding for a capture
 * Combines title, summary, and content for rich embedding
 * @param {Object} capture - Capture object
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateCaptureEmbedding(capture) {
  // Build text for embedding - prioritize title and summary
  const parts = [];

  if (capture.title) {
    parts.push(`Title: ${capture.title}`);
  }

  if (capture.summary) {
    parts.push(`Summary: ${capture.summary}`);
  }

  if (capture.category) {
    parts.push(`Category: ${capture.category}`);
  }

  if (capture.tags && capture.tags.length > 0) {
    parts.push(`Tags: ${capture.tags.join(', ')}`);
  }

  // Add content (truncated) for additional context
  if (capture.content) {
    parts.push(`Content: ${capture.content.slice(0, 10000)}`);
  }

  const text = parts.join('\n\n');

  return await generateEmbedding(text);
}

/**
 * Format embedding for Supabase pgvector
 * @param {number[]} embedding - Embedding array
 * @returns {string} - Formatted vector string
 */
export function formatForPgVector(embedding) {
  return `[${embedding.join(',')}]`;
}
