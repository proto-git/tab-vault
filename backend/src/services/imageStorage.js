// Image Storage Service
// Downloads og:image and stores in Supabase Storage

import { supabase, isConfigured } from './supabase.js';

const BUCKET_NAME = 'capture-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Extract og:image URL from HTML
 * @param {string} html - Raw HTML content
 * @returns {string|null} - The og:image URL or null
 */
export function extractOgImage(html) {
  if (!html) return null;

  // Try og:image first (most common)
  const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (ogMatch && ogMatch[1]) {
    return ogMatch[1];
  }

  // Try twitter:image
  const twitterMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
  if (twitterMatch && twitterMatch[1]) {
    return twitterMatch[1];
  }

  // Try twitter:image:src
  const twitterSrcMatch = html.match(/<meta\s+name=["']twitter:image:src["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image:src["']/i);
  if (twitterSrcMatch && twitterSrcMatch[1]) {
    return twitterSrcMatch[1];
  }

  return null;
}

/**
 * Download image from URL and upload to Supabase Storage
 * @param {string} imageUrl - The source image URL
 * @param {string} captureId - The capture ID (used for filename)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function storeImage(imageUrl, captureId) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  if (!imageUrl) {
    return { success: false, error: 'No image URL provided' };
  }

  try {
    // Download the image
    console.log(`[ImageStorage] Downloading image from ${imageUrl}`);
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TabVault/1.0)',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      return { success: false, error: `Failed to download: ${response.status}` };
    }

    // Check content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return { success: false, error: `Not an image: ${contentType}` };
    }

    // Get the image data
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check size
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image too large: ${Math.round(buffer.length / 1024 / 1024)}MB` };
    }

    // Determine file extension
    const ext = getExtensionFromContentType(contentType);
    const filename = `${captureId}.${ext}`;

    console.log(`[ImageStorage] Uploading ${filename} (${Math.round(buffer.length / 1024)}KB)`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('Bucket not found')) {
        console.log('[ImageStorage] Bucket not found, creating...');
        const createResult = await createBucket();
        if (!createResult.success) {
          return { success: false, error: `Bucket creation failed: ${createResult.error}` };
        }
        // Retry upload
        const retryResult = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filename, buffer, { contentType, upsert: true });

        if (retryResult.error) {
          return { success: false, error: retryResult.error.message };
        }
      } else {
        return { success: false, error: error.message };
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    console.log(`[ImageStorage] Stored image: ${urlData.publicUrl}`);

    return {
      success: true,
      url: urlData.publicUrl,
      filename,
    };
  } catch (error) {
    console.error('[ImageStorage] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an image from storage
 * @param {string} filename - The filename to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteImage(filename) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filename]);

    if (error) {
      return { success: false, error: error.message };
    }

    console.log(`[ImageStorage] Deleted image: ${filename}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete multiple images from storage
 * @param {string[]} filenames - Array of filenames to delete
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function deleteImages(filenames) {
  if (!isConfigured() || !filenames.length) {
    return { success: 0, failed: 0 };
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filenames);

    if (error) {
      console.error('[ImageStorage] Bulk delete error:', error.message);
      return { success: 0, failed: filenames.length };
    }

    console.log(`[ImageStorage] Deleted ${filenames.length} images`);
    return { success: filenames.length, failed: 0 };
  } catch (error) {
    return { success: 0, failed: filenames.length };
  }
}

/**
 * Create the storage bucket if it doesn't exist
 */
async function createBucket() {
  try {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_IMAGE_SIZE,
    });

    if (error && !error.message?.includes('already exists')) {
      return { success: false, error: error.message };
    }

    console.log(`[ImageStorage] Bucket '${BUCKET_NAME}' ready`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[contentType] || 'jpg';
}
