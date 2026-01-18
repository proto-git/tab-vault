// Tags Service
// Manages tags aggregated from captures

import { supabase, isConfigured } from './supabase.js';

/**
 * Get all tags with their usage counts
 * @returns {Promise<{success: boolean, tags?: Array, error?: string}>}
 */
export async function getTagsWithCounts() {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Get all captures with tags
    const { data, error } = await supabase
      .from('captures')
      .select('tags')
      .not('tags', 'is', null);

    if (error) {
      throw error;
    }

    // Aggregate tag counts
    const tagCounts = {};
    for (const capture of data || []) {
      if (Array.isArray(capture.tags)) {
        for (const tag of capture.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    // Convert to sorted array
    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { success: true, tags };
  } catch (err) {
    console.error('[Tags] Failed to get tags:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a tag from all captures
 * @param {string} tagName - Tag to delete
 * @returns {Promise<{success: boolean, affected?: number, error?: string}>}
 */
export async function deleteTag(tagName) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  if (!tagName) {
    return { success: false, error: 'Tag name is required' };
  }

  try {
    // Get all captures that have this tag
    const { data: captures, error: fetchError } = await supabase
      .from('captures')
      .select('id, tags')
      .contains('tags', [tagName]);

    if (fetchError) {
      throw fetchError;
    }

    if (!captures || captures.length === 0) {
      return { success: true, affected: 0 };
    }

    // Update each capture to remove the tag
    let affected = 0;
    for (const capture of captures) {
      const newTags = capture.tags.filter(t => t !== tagName);

      const { error: updateError } = await supabase
        .from('captures')
        .update({ tags: newTags })
        .eq('id', capture.id);

      if (!updateError) {
        affected++;
      }
    }

    console.log(`[Tags] Deleted '${tagName}' from ${affected} captures`);
    return { success: true, affected };
  } catch (err) {
    console.error('[Tags] Delete failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Merge one tag into another
 * @param {string} sourceTag - Tag to merge from (will be removed)
 * @param {string} targetTag - Tag to merge into
 * @returns {Promise<{success: boolean, affected?: number, error?: string}>}
 */
export async function mergeTags(sourceTag, targetTag) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  if (!sourceTag || !targetTag) {
    return { success: false, error: 'Both source and target tags are required' };
  }

  if (sourceTag === targetTag) {
    return { success: false, error: 'Source and target tags must be different' };
  }

  try {
    // Get all captures that have the source tag
    const { data: captures, error: fetchError } = await supabase
      .from('captures')
      .select('id, tags')
      .contains('tags', [sourceTag]);

    if (fetchError) {
      throw fetchError;
    }

    if (!captures || captures.length === 0) {
      return { success: true, affected: 0 };
    }

    // Update each capture: remove source, add target (if not already present)
    let affected = 0;
    for (const capture of captures) {
      let newTags = capture.tags.filter(t => t !== sourceTag);

      // Add target tag if not already present
      if (!newTags.includes(targetTag)) {
        newTags.push(targetTag);
      }

      const { error: updateError } = await supabase
        .from('captures')
        .update({ tags: newTags })
        .eq('id', capture.id);

      if (!updateError) {
        affected++;
      }
    }

    console.log(`[Tags] Merged '${sourceTag}' into '${targetTag}' in ${affected} captures`);
    return { success: true, affected };
  } catch (err) {
    console.error('[Tags] Merge failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Rename a tag across all captures
 * @param {string} oldName - Current tag name
 * @param {string} newName - New tag name
 * @returns {Promise<{success: boolean, affected?: number, error?: string}>}
 */
export async function renameTag(oldName, newName) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  if (!oldName || !newName) {
    return { success: false, error: 'Both old and new names are required' };
  }

  const normalizedNew = newName.toLowerCase().trim();

  if (oldName === normalizedNew) {
    return { success: true, affected: 0 };
  }

  try {
    // Get all captures that have the old tag
    const { data: captures, error: fetchError } = await supabase
      .from('captures')
      .select('id, tags')
      .contains('tags', [oldName]);

    if (fetchError) {
      throw fetchError;
    }

    if (!captures || captures.length === 0) {
      return { success: true, affected: 0 };
    }

    // Update each capture: replace old tag with new
    let affected = 0;
    for (const capture of captures) {
      const newTags = capture.tags.map(t => t === oldName ? normalizedNew : t);

      // Remove duplicates
      const uniqueTags = [...new Set(newTags)];

      const { error: updateError } = await supabase
        .from('captures')
        .update({ tags: uniqueTags })
        .eq('id', capture.id);

      if (!updateError) {
        affected++;
      }
    }

    console.log(`[Tags] Renamed '${oldName}' to '${normalizedNew}' in ${affected} captures`);
    return { success: true, affected };
  } catch (err) {
    console.error('[Tags] Rename failed:', err.message);
    return { success: false, error: err.message };
  }
}
