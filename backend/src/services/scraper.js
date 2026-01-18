// Web Scraper Service
// Extracts main content from URLs for AI processing
// Uses simple fetch with Playwright fallback for JS-heavy sites

// Maximum content length to return (characters)
const MAX_CONTENT_LENGTH = 50000;

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
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
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
      return { success: false, error: 'Content too short (likely JS-rendered)' };
    }

    return {
      success: true,
      content: content.slice(0, MAX_CONTENT_LENGTH),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Scrape content from a URL
 * Uses simple fetch first, falls back to Playwright for JS-heavy sites
 * @param {string} url - The URL to scrape
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
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

      const content = await page.evaluate(() => {
        // Remove unwanted elements
        ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside']
          .forEach(tag => document.querySelectorAll(tag).forEach(el => el.remove()));

        // Try to find main content
        const main = document.querySelector('article, main, [role="main"], .content, #content');
        const el = (main && main.textContent.trim().length > 200) ? main : document.body;

        return el.textContent.replace(/\s+/g, ' ').trim();
      });

      await browser.close();

      console.log(`[Scraper] Playwright succeeded: ${content.length} chars`);

      return {
        success: true,
        content: content.slice(0, MAX_CONTENT_LENGTH),
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
