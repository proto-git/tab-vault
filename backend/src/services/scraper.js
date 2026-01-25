// Web Scraper Service
// Extracts main content from URLs for AI processing
// Uses simple fetch with Playwright fallback for JS-heavy sites

// Maximum content length to return (characters)
const MAX_CONTENT_LENGTH = 50000;

/**
 * Extract author/creator name from HTML and URL
 * Tries multiple methods: meta tags, JSON-LD, platform-specific patterns
 * @param {string} html - The raw HTML content
 * @param {string} url - The page URL
 * @returns {string|null} - The author name or null if not found
 */
export function extractAuthor(html, url) {
  if (!html && !url) return null;

  // Try URL-based extraction first (most reliable for known platforms)
  const urlAuthor = extractAuthorFromUrl(url);
  if (urlAuthor) return urlAuthor;

  if (!html) return null;

  // Try meta tags
  const metaAuthor = extractAuthorFromMeta(html);
  if (metaAuthor) return metaAuthor;

  // Try JSON-LD schema.org
  const jsonLdAuthor = extractAuthorFromJsonLd(html);
  if (jsonLdAuthor) return jsonLdAuthor;

  // Try platform-specific HTML patterns
  const platformAuthor = extractAuthorFromHtmlPatterns(html, url);
  if (platformAuthor) return platformAuthor;

  return null;
}

/**
 * Extract author from URL patterns (platform-specific)
 * @param {string} url - The page URL
 * @returns {string|null}
 */
function extractAuthorFromUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // Twitter/X: Extract @username from URL path
    // Pattern: twitter.com/username/status/... or x.com/username/...
    if (hostname === 'twitter.com' || hostname === 'www.twitter.com' ||
        hostname === 'x.com' || hostname === 'www.x.com' ||
        hostname === 'mobile.twitter.com' || hostname === 'mobile.x.com') {
      const match = pathname.match(/^\/([^\/]+)/);
      if (match && match[1] && !['home', 'explore', 'search', 'notifications', 'messages', 'i', 'settings'].includes(match[1])) {
        return `@${match[1]}`;
      }
    }

    // GitHub: Extract owner from URL (github.com/OWNER/repo)
    if (hostname === 'github.com' || hostname === 'www.github.com') {
      const match = pathname.match(/^\/([^\/]+)/);
      if (match && match[1] && !['explore', 'trending', 'collections', 'events', 'sponsors', 'settings', 'notifications', 'pulls', 'issues', 'marketplace', 'features', 'pricing', 'enterprise', 'team', 'about', 'search'].includes(match[1])) {
        return match[1];
      }
    }

    // YouTube: Channel URLs (youtube.com/@channelname or youtube.com/c/channelname or youtube.com/channel/...)
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com') {
      // Handle @username format
      const atMatch = pathname.match(/^\/@([^\/]+)/);
      if (atMatch && atMatch[1]) {
        return `@${atMatch[1]}`;
      }
      // Handle /c/channelname format
      const cMatch = pathname.match(/^\/c\/([^\/]+)/);
      if (cMatch && cMatch[1]) {
        return cMatch[1];
      }
      // Handle /user/username format
      const userMatch = pathname.match(/^\/user\/([^\/]+)/);
      if (userMatch && userMatch[1]) {
        return userMatch[1];
      }
    }

    // Substack: subdomain is the author (e.g., authorname.substack.com)
    if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
      const subdomain = hostname.replace('.substack.com', '');
      if (subdomain && subdomain !== 'www') {
        return subdomain;
      }
    }

    // Medium: Check for custom domains or @username paths
    if (hostname === 'medium.com' || hostname === 'www.medium.com') {
      const match = pathname.match(/^\/@([^\/]+)/);
      if (match && match[1]) {
        return `@${match[1]}`;
      }
    }

    // Reddit: Extract u/username from URL
    if (hostname === 'reddit.com' || hostname === 'www.reddit.com' ||
        hostname === 'old.reddit.com' || hostname === 'new.reddit.com') {
      const userMatch = pathname.match(/^\/u(?:ser)?\/([^\/]+)/);
      if (userMatch && userMatch[1]) {
        return `u/${userMatch[1]}`;
      }
    }

    // LinkedIn: Extract profile name from URL
    if (hostname === 'linkedin.com' || hostname === 'www.linkedin.com') {
      const profileMatch = pathname.match(/^\/in\/([^\/]+)/);
      if (profileMatch && profileMatch[1]) {
        // Convert URL slug to readable name
        return profileMatch[1].replace(/-/g, ' ');
      }
    }

  } catch (e) {
    // URL parsing failed
  }

  return null;
}

/**
 * Extract author from HTML meta tags
 * @param {string} html - The raw HTML content
 * @returns {string|null}
 */
function extractAuthorFromMeta(html) {
  // Try <meta name="author">
  const authorMatch = html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']author["']/i);
  if (authorMatch && authorMatch[1]) {
    return cleanAuthorName(authorMatch[1]);
  }

  // Try <meta property="article:author">
  const articleAuthorMatch = html.match(/<meta\s+property=["']article:author["']\s+content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']article:author["']/i);
  if (articleAuthorMatch && articleAuthorMatch[1]) {
    return cleanAuthorName(articleAuthorMatch[1]);
  }

  // Try <meta name="twitter:creator">
  const twitterCreatorMatch = html.match(/<meta\s+name=["']twitter:creator["']\s+content=["']([^"']+)["']/i) ||
                              html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:creator["']/i);
  if (twitterCreatorMatch && twitterCreatorMatch[1]) {
    return cleanAuthorName(twitterCreatorMatch[1]);
  }

  // Try <meta property="og:article:author">
  const ogAuthorMatch = html.match(/<meta\s+property=["']og:article:author["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:article:author["']/i);
  if (ogAuthorMatch && ogAuthorMatch[1]) {
    return cleanAuthorName(ogAuthorMatch[1]);
  }

  return null;
}

/**
 * Extract author from JSON-LD schema.org data
 * @param {string} html - The raw HTML content
 * @returns {string|null}
 */
function extractAuthorFromJsonLd(html) {
  // Find all JSON-LD script blocks
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const data = JSON.parse(jsonStr);

      // Handle array of JSON-LD objects
      const objects = Array.isArray(data) ? data : [data];

      for (const obj of objects) {
        const author = extractAuthorFromJsonLdObject(obj);
        if (author) return author;
      }
    } catch (e) {
      // JSON parsing failed, continue to next block
    }
  }

  return null;
}

/**
 * Recursively extract author from a JSON-LD object
 * @param {object} obj - The JSON-LD object
 * @returns {string|null}
 */
function extractAuthorFromJsonLdObject(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // Direct author field
  if (obj.author) {
    if (typeof obj.author === 'string') {
      return cleanAuthorName(obj.author);
    }
    if (typeof obj.author === 'object') {
      if (obj.author.name) {
        return cleanAuthorName(obj.author.name);
      }
      // Handle array of authors
      if (Array.isArray(obj.author) && obj.author.length > 0) {
        const firstAuthor = obj.author[0];
        if (typeof firstAuthor === 'string') {
          return cleanAuthorName(firstAuthor);
        }
        if (firstAuthor && firstAuthor.name) {
          return cleanAuthorName(firstAuthor.name);
        }
      }
    }
  }

  // Creator field (sometimes used instead of author)
  if (obj.creator) {
    if (typeof obj.creator === 'string') {
      return cleanAuthorName(obj.creator);
    }
    if (typeof obj.creator === 'object' && obj.creator.name) {
      return cleanAuthorName(obj.creator.name);
    }
  }

  // Check nested @graph array
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const author = extractAuthorFromJsonLdObject(item);
      if (author) return author;
    }
  }

  return null;
}

/**
 * Extract author from platform-specific HTML patterns
 * @param {string} html - The raw HTML content
 * @param {string} url - The page URL
 * @returns {string|null}
 */
function extractAuthorFromHtmlPatterns(html, url) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch (e) {
    // URL parsing failed
  }

  // YouTube: Look for channel name in various places
  if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
    // Try to find channel name in ytInitialData or other patterns
    const channelMatch = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
    if (channelMatch && channelMatch[1]) {
      return cleanAuthorName(channelMatch[1]);
    }
    // Fallback: look for channel link text
    const channelLinkMatch = html.match(/<a[^>]*class="[^"]*yt-simple-endpoint[^"]*"[^>]*>([^<]+)<\/a>/);
    if (channelLinkMatch && channelLinkMatch[1]) {
      return cleanAuthorName(channelLinkMatch[1]);
    }
  }

  // Medium/Substack: Look for author byline patterns
  // Common patterns: "Written by X", "By X", class="author-name"
  const bylinePatterns = [
    /<[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)</i,
    /<[^>]*data-testid="[^"]*author[^"]*"[^>]*>([^<]+)</i,
    /<a[^>]*rel="author"[^>]*>([^<]+)</i,
    /<span[^>]*class="[^"]*byline[^"]*"[^>]*>.*?(?:By|Written by)\s*([^<]+)</i,
  ];

  for (const pattern of bylinePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return cleanAuthorName(match[1]);
    }
  }

  return null;
}

/**
 * Clean and normalize an author name
 * @param {string} name - The raw author name
 * @returns {string|null}
 */
function cleanAuthorName(name) {
  if (!name) return null;

  // Decode HTML entities
  let cleaned = name
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Skip if it looks like a URL
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return null;
  }

  // Skip if too short or too long
  if (cleaned.length < 2 || cleaned.length > 100) {
    return null;
  }

  return cleaned;
}

// Simple HTML tag stripper for basic content extraction
function stripHtml(html) {
  // Remove script and style elements
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  html = html.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // Remove all HTML tags
  html = html.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  html = html.replace(/&nbsp;/g, ' ');
  html = html.replace(/&amp;/g, '&');
  html = html.replace(/&lt;/g, '<');
  html = html.replace(/&gt;/g, '>');
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#39;/g, "'");

  // Clean up whitespace
  html = html.replace(/\s+/g, ' ').trim();

  return html;
}

/**
 * Simple fetch-based scraper (works without browser dependencies)
 * @param {string} url - The URL to scrape
 * @returns {Promise<{success: boolean, content?: string, html?: string, error?: string}>}
 */
async function simpleScrape(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { success: false, error: 'Not an HTML page' };
    }

    const html = await response.text();
    const content = stripHtml(html);

    if (content.length < 100) {
      return { success: false, error: 'Content too short (likely JS-rendered)', html };
    }

    return {
      success: true,
      content: content.slice(0, MAX_CONTENT_LENGTH),
      html, // Return raw HTML for author extraction
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Scrape content from a URL
 * Uses simple fetch first, falls back to Playwright for JS-heavy sites
 * @param {string} url - The URL to scrape
 * @returns {Promise<{success: boolean, content?: string, html?: string, error?: string}>}
 */
export async function scrapeUrl(url) {
  // Try simple fetch-based scraping first (fast, no dependencies)
  console.log('[Scraper] Trying simple scrape for:', url);
  const simpleResult = await simpleScrape(url);

  if (simpleResult.success) {
    console.log(`[Scraper] Simple scrape succeeded: ${simpleResult.content.length} chars`);
    return simpleResult;
  }

  console.log(`[Scraper] Simple scrape failed: ${simpleResult.error}`);

  // Try Playwright for JS-rendered content (if available)
  try {
    const { chromium } = await import('playwright');

    console.log('[Scraper] Trying Playwright for JS-rendered content...');

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });

      const page = await context.newPage();
      await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Get both raw HTML and processed content
      const { content, html } = await page.evaluate(() => {
        // Get raw HTML first
        const rawHtml = document.documentElement.outerHTML;

        // Remove unwanted elements
        ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside']
          .forEach(tag => document.querySelectorAll(tag).forEach(el => el.remove()));

        // Try to find main content
        const main = document.querySelector('article, main, [role="main"], .content, #content');
        const el = (main && main.textContent.trim().length > 200) ? main : document.body;

        return {
          content: el.textContent.replace(/\s+/g, ' ').trim(),
          html: rawHtml,
        };
      });

      await browser.close();

      console.log(`[Scraper] Playwright succeeded: ${content.length} chars`);

      return {
        success: true,
        content: content.slice(0, MAX_CONTENT_LENGTH),
        html, // Return raw HTML for author extraction
      };
    } catch (pageError) {
      await browser.close();
      throw pageError;
    }
  } catch (error) {
    // Playwright not available or failed - return simple scrape error
    console.log(`[Scraper] Playwright failed or unavailable: ${error.message}`);

    return {
      success: false,
      error: `Scraping failed: ${simpleResult.error}`,
      html: simpleResult.html, // Pass through any HTML we got from simple scrape
    };
  }
}

/**
 * Check if a URL is scrapeable (not a special protocol)
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isScrapeable(url) {
  if (!url) return false;

  const unscrapeable = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'file://',
    'javascript:',
    'data:',
  ];

  return !unscrapeable.some(prefix => url.startsWith(prefix));
}
