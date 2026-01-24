// Notion Service - Sync captures to Notion database
// Designed to support future multi-workspace (see ALU-31)

import { Client } from '@notionhq/client';

// Initialize Notion client (will be null if not configured)
let notionClient = null;

/**
 * Check if Notion is configured
 */
export function isConfigured() {
  return !!(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID);
}

/**
 * Get or create Notion client
 * @param {string} apiKey - Optional API key (for future multi-workspace support)
 */
function getClient(apiKey = null) {
  const key = apiKey || process.env.NOTION_API_KEY;
  if (!key) {
    throw new Error('Notion API key not configured');
  }

  // For single-workspace mode, reuse the client
  if (!apiKey && notionClient) {
    return notionClient;
  }

  const client = new Client({ auth: key });

  if (!apiKey) {
    notionClient = client;
  }

  return client;
}

/**
 * Get the target database ID
 * @param {string} databaseId - Optional database ID (for future multi-workspace)
 */
function getDatabaseId(databaseId = null) {
  const id = databaseId || process.env.NOTION_DATABASE_ID;
  if (!id) {
    throw new Error('Notion database ID not configured');
  }
  return id;
}

/**
 * Test connection to Notion
 * @returns {Promise<{success: boolean, database?: object, error?: string}>}
 */
export async function testConnection() {
  try {
    if (!isConfigured()) {
      return { success: false, error: 'Notion not configured' };
    }

    const client = getClient();
    const databaseId = getDatabaseId();

    const database = await client.databases.retrieve({ database_id: databaseId });

    return {
      success: true,
      database: {
        id: database.id,
        title: database.title?.[0]?.plain_text || 'Untitled',
        url: database.url,
      },
    };
  } catch (error) {
    console.error('[Notion] Connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Map a capture to Notion page properties
 * Expected database schema:
 * - Name (title) - display_title or title (Notion's default title property)
 * - URL (url) - url
 * - Summary (rich_text) - summary
 * - Category (select) - category
 * - Tags (multi_select) - tags
 * - Quality (number) - quality_score
 * - Captured (date) - created_at
 */
function mapCaptureToProperties(capture) {
  const properties = {
    // Title property (required) - Notion default is "Name"
    Name: {
      title: [
        {
          type: 'text',
          text: {
            content: capture.display_title || capture.title || capture.url,
          },
        },
      ],
    },
    // URL property
    URL: {
      url: capture.url,
    },
  };

  // Summary (rich_text) - truncate to 2000 chars (Notion limit)
  if (capture.summary) {
    properties.Summary = {
      rich_text: [
        {
          type: 'text',
          text: {
            content: capture.summary.slice(0, 2000),
          },
        },
      ],
    };
  }

  // Category (select)
  if (capture.category) {
    properties.Category = {
      select: {
        name: capture.category,
      },
    };
  }

  // Tags (multi_select)
  if (capture.tags && capture.tags.length > 0) {
    properties.Tags = {
      multi_select: capture.tags.map(tag => ({ name: tag })),
    };
  }

  // Quality score (number)
  if (capture.quality_score) {
    properties.Quality = {
      number: capture.quality_score,
    };
  }

  // Captured date
  if (capture.created_at) {
    properties.Captured = {
      date: {
        start: new Date(capture.created_at).toISOString().split('T')[0],
      },
    };
  }

  return properties;
}

/**
 * Sync a single capture to Notion
 * @param {object} capture - The capture object from database
 * @param {object} options - Optional: { apiKey, databaseId } for multi-workspace
 * @returns {Promise<{success: boolean, pageId?: string, pageUrl?: string, error?: string}>}
 */
export async function syncCapture(capture, options = {}) {
  try {
    const client = getClient(options.apiKey);
    const databaseId = getDatabaseId(options.databaseId);

    // Check if already synced (update) or new (create)
    if (capture.notion_page_id) {
      // Update existing page
      const response = await client.pages.update({
        page_id: capture.notion_page_id,
        properties: mapCaptureToProperties(capture),
      });

      console.log(`[Notion] Updated page ${capture.notion_page_id}`);

      return {
        success: true,
        pageId: response.id,
        pageUrl: response.url,
        updated: true,
      };
    } else {
      // Create new page
      const response = await client.pages.create({
        parent: {
          type: 'database_id',
          database_id: databaseId,
        },
        properties: mapCaptureToProperties(capture),
        // Add page content with the full summary
        children: capture.summary ? [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: capture.summary,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'divider',
            divider: {},
          },
          {
            object: 'block',
            type: 'bookmark',
            bookmark: {
              url: capture.url,
            },
          },
        ] : [
          {
            object: 'block',
            type: 'bookmark',
            bookmark: {
              url: capture.url,
            },
          },
        ],
      });

      console.log(`[Notion] Created page ${response.id}`);

      return {
        success: true,
        pageId: response.id,
        pageUrl: response.url,
        created: true,
      };
    }
  } catch (error) {
    console.error('[Notion] Sync failed:', error.message);

    // Handle specific Notion errors
    if (error.code === 'validation_error') {
      return { success: false, error: `Validation error: ${error.message}` };
    }
    if (error.code === 'object_not_found') {
      return { success: false, error: 'Database or page not found. Check your Notion configuration.' };
    }
    if (error.code === 'unauthorized') {
      return { success: false, error: 'Unauthorized. Check your Notion API key and database permissions.' };
    }

    return { success: false, error: error.message };
  }
}

/**
 * Sync multiple captures to Notion
 * @param {array} captures - Array of capture objects
 * @param {object} options - Optional: { apiKey, databaseId } for multi-workspace
 * @returns {Promise<{success: number, failed: number, errors: array}>}
 */
export async function syncMultiple(captures, options = {}) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
    synced: [],
  };

  for (const capture of captures) {
    const result = await syncCapture(capture, options);

    if (result.success) {
      results.success++;
      results.synced.push({
        id: capture.id,
        pageId: result.pageId,
        pageUrl: result.pageUrl,
      });
    } else {
      results.failed++;
      results.errors.push({
        id: capture.id,
        url: capture.url,
        error: result.error,
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}
