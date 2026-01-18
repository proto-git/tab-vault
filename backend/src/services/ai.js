// AI Service using OpenRouter
// Provides summarization, categorization, and scoring

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Use a cost-effective model - Claude 3 Haiku or GPT-4o-mini
const MODEL = 'anthropic/claude-3-haiku';

// Check if OpenRouter is configured
export function isConfigured() {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Make a request to OpenRouter
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @returns {Promise<string>} - Model response
 */
async function callOpenRouter(systemPrompt, userPrompt) {
  if (!isConfigured()) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://tab-vault.app',
      'X-Title': 'Tab Vault',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Summarize content into 2-3 sentences
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @returns {Promise<string>} - Summary
 */
export async function summarize(title, content) {
  const systemPrompt = `You are a concise summarizer. Create a 2-3 sentence summary that captures the key points and value of the content. Focus on what makes this content useful or interesting.`;

  const userPrompt = `Title: ${title}

Content:
${content.slice(0, 8000)}

Provide a 2-3 sentence summary:`;

  return await callOpenRouter(systemPrompt, userPrompt);
}

/**
 * Categorize content and generate tags
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @returns {Promise<{category: string, tags: string[]}>}
 */
export async function categorize(title, content) {
  const systemPrompt = `You categorize web content. Respond with JSON only, no other text.

Categories (pick one):
- learning: tutorials, courses, documentation, how-to guides
- work: professional tools, productivity, career-related
- project: code repos, project ideas, side projects
- news: current events, announcements, blog posts
- reference: APIs, specs, reference materials, wikis

Tags: Generate 2-4 relevant lowercase tags.

Response format: {"category": "learning", "tags": ["javascript", "tutorial"]}`;

  const userPrompt = `Title: ${title}

Content:
${content.slice(0, 4000)}

Categorize this content:`;

  const response = await callOpenRouter(systemPrompt, userPrompt);

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
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
 * @returns {Promise<{quality: number, actionability: number}>}
 */
export async function score(title, summary, category) {
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

  const response = await callOpenRouter(systemPrompt, userPrompt);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
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
 * Process content through all AI steps
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @returns {Promise<{summary: string, category: string, tags: string[], quality: number, actionability: number}>}
 */
export async function processContent(title, content) {
  // Run summarize and categorize in parallel
  const [summary, categoryResult] = await Promise.all([
    summarize(title, content),
    categorize(title, content),
  ]);

  // Score based on summary
  const scores = await score(title, summary, categoryResult.category);

  return {
    summary,
    category: categoryResult.category,
    tags: categoryResult.tags,
    quality: scores.quality,
    actionability: scores.actionability,
  };
}
