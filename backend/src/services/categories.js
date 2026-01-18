// Categories Service
// Manages custom categories for capture organization

import { supabase, isConfigured } from './supabase.js';

// Default categories (used when Supabase not configured)
const DEFAULT_CATEGORIES = [
  { name: 'learning', description: 'Tutorials, courses, documentation, how-to guides', color: '#10b981' },
  { name: 'work', description: 'Professional tools, productivity, career-related', color: '#3b82f6' },
  { name: 'project', description: 'Code repos, project ideas, side projects', color: '#8b5cf6' },
  { name: 'news', description: 'Current events, announcements, blog posts', color: '#f59e0b' },
  { name: 'reference', description: 'APIs, specs, reference materials, wikis', color: '#6b7280' },
];

// Cache categories (refreshed on changes)
let cachedCategories = null;

/**
 * Get all categories
 * @returns {Promise<Array>} List of categories
 */
export async function getCategories() {
  if (!isConfigured()) {
    return DEFAULT_CATEGORIES;
  }

  if (cachedCategories) {
    return cachedCategories;
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[Categories] Failed to fetch:', error.message);
      return DEFAULT_CATEGORIES;
    }

    cachedCategories = data;
    return data;
  } catch (err) {
    console.error('[Categories] Error:', err.message);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Get category names for AI prompt
 * @returns {Promise<string>} Formatted category list for prompt
 */
export async function getCategoryPrompt() {
  const categories = await getCategories();

  return categories.map(cat =>
    `- ${cat.name}: ${cat.description}`
  ).join('\n');
}

/**
 * Add a new category
 * @param {Object} category - Category data
 * @returns {Promise<{success: boolean, category?: Object, error?: string}>}
 */
export async function addCategory({ name, description, color }) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Validate
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Category name is required' };
  }

  const normalizedName = name.toLowerCase().trim().replace(/\s+/g, '-');

  try {
    // Get max sort_order
    const { data: maxOrder } = await supabase
      .from('categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: normalizedName,
        description: description || '',
        color: color || '#667eea',
        is_default: false,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Category already exists' };
      }
      throw error;
    }

    // Clear cache
    cachedCategories = null;

    console.log('[Categories] Added:', normalizedName);
    return { success: true, category: data };
  } catch (err) {
    console.error('[Categories] Add failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update a category
 * @param {string} id - Category ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateCategory(id, { name, description, color }) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const updates = {};
    if (name) updates.name = name.toLowerCase().trim().replace(/\s+/g, '-');
    if (description !== undefined) updates.description = description;
    if (color) updates.color = color;

    const { error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Clear cache
    cachedCategories = null;

    return { success: true };
  } catch (err) {
    console.error('[Categories] Update failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a category (only non-default)
 * @param {string} id - Category ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteCategory(id) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Check if it's a default category
    const { data: cat } = await supabase
      .from('categories')
      .select('is_default, name')
      .eq('id', id)
      .single();

    if (cat?.is_default) {
      return { success: false, error: 'Cannot delete default categories' };
    }

    // Update captures using this category to 'reference' (fallback)
    await supabase
      .from('captures')
      .update({ category: 'reference' })
      .eq('category', cat.name);

    // Delete the category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Clear cache
    cachedCategories = null;

    console.log('[Categories] Deleted:', cat.name);
    return { success: true };
  } catch (err) {
    console.error('[Categories] Delete failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Clear the categories cache
 */
export function clearCategoriesCache() {
  cachedCategories = null;
}
