// Source Platform Detection
// Detects the source platform from URL patterns

/**
 * Detects the source platform from a URL
 * @param {string} url - The URL to analyze
 * @returns {string} - The detected platform name or cleaned domain
 */
export function detectSourcePlatform(url) {
  if (!url) return 'unknown';

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Twitter / X
    if (hostname === 'twitter.com' || hostname === 'www.twitter.com' ||
        hostname === 'x.com' || hostname === 'www.x.com' ||
        hostname === 'mobile.twitter.com' || hostname === 'mobile.x.com') {
      return 'twitter';
    }

    // YouTube
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' ||
        hostname === 'm.youtube.com' || hostname === 'youtu.be') {
      return 'youtube';
    }

    // Medium (includes subdomains like blog.medium.com)
    if (hostname === 'medium.com' || hostname === 'www.medium.com' ||
        hostname.endsWith('.medium.com')) {
      return 'medium';
    }

    // Substack (*.substack.com)
    if (hostname.endsWith('.substack.com') || hostname === 'substack.com') {
      return 'substack';
    }

    // GitHub
    if (hostname === 'github.com' || hostname === 'www.github.com' ||
        hostname === 'gist.github.com') {
      return 'github';
    }

    // Reddit
    if (hostname === 'reddit.com' || hostname === 'www.reddit.com' ||
        hostname === 'old.reddit.com' || hostname === 'new.reddit.com' ||
        hostname.endsWith('.reddit.com')) {
      return 'reddit';
    }

    // Hacker News
    if (hostname === 'news.ycombinator.com' || hostname === 'ycombinator.com') {
      return 'hackernews';
    }

    // LinkedIn
    if (hostname === 'linkedin.com' || hostname === 'www.linkedin.com' ||
        hostname.endsWith('.linkedin.com')) {
      return 'linkedin';
    }

    // Default: extract clean domain name
    return extractCleanDomain(hostname);
  } catch (e) {
    // If URL parsing fails, return unknown
    return 'unknown';
  }
}

/**
 * Extracts a clean domain name from hostname
 * @param {string} hostname - The hostname to clean
 * @returns {string} - The cleaned domain name
 */
function extractCleanDomain(hostname) {
  // Remove www prefix
  let domain = hostname.replace(/^www\./, '');

  // Extract the main domain (e.g., "example" from "blog.example.com")
  const parts = domain.split('.');

  if (parts.length >= 2) {
    // Get the domain name (second to last part for most TLDs)
    // Handle common TLDs like .co.uk, .com.au
    const commonTwoPartTlds = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp'];
    const lastTwo = parts.slice(-2).join('.');

    if (commonTwoPartTlds.includes(lastTwo) && parts.length >= 3) {
      return parts[parts.length - 3];
    }

    return parts[parts.length - 2];
  }

  return domain;
}

/**
 * Gets a display-friendly name for a source platform
 * @param {string} platform - The platform identifier
 * @returns {string} - Human-readable platform name
 */
export function getSourceDisplayName(platform) {
  const displayNames = {
    twitter: 'Twitter',
    youtube: 'YouTube',
    medium: 'Medium',
    substack: 'Substack',
    github: 'GitHub',
    reddit: 'Reddit',
    hackernews: 'Hacker News',
    linkedin: 'LinkedIn',
    unknown: 'Unknown',
  };

  return displayNames[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * Gets all known source platforms
 * @returns {string[]} - Array of known platform identifiers
 */
export function getKnownPlatforms() {
  return ['twitter', 'youtube', 'medium', 'substack', 'github', 'reddit', 'hackernews', 'linkedin'];
}
