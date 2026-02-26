// Settings Service
// Manages user preferences stored in Supabase

import { supabase, isConfigured } from './supabase.js';
import { DEFAULT_MODEL, getModelConfig, getAvailableModels } from '../config/models.js';

// Cache settings in memory, keyed by user ID.
const cachedSettings = new Map();

function getCacheKey(userId) {
  return userId || '__anonymous__';
}

/**
 * Get current settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings(userId = null) {
  if (!isConfigured()) {
    return getDefaultSettings();
  }

  // Return cached if available
  const cacheKey = getCacheKey(userId);
  if (cachedSettings.has(cacheKey)) {
    return cachedSettings.get(cacheKey);
  }

  try {
    let settingsQuery = supabase
      .from('settings')
      .select('*');

    if (userId) {
      settingsQuery = settingsQuery.eq('user_id', userId);
    }

    const { data, error } = await settingsQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Settings] Failed to fetch:', error.message);
      return getDefaultSettings();
    }

    // Create a per-user settings row lazily if one does not exist.
    if (!data && userId) {
      const { data: inserted, error: insertError } = await supabase
        .from('settings')
        .insert({
          ai_model: DEFAULT_MODEL,
          user_id: userId,
        })
        .select('*')
        .single();

      if (insertError || !inserted) {
        console.error('[Settings] Failed to create defaults:', insertError?.message || 'Unknown error');
        return getDefaultSettings();
      }

      const createdDefaults = {
        aiModel: inserted.ai_model || DEFAULT_MODEL,
        updatedAt: inserted.updated_at,
      };
      cachedSettings.set(cacheKey, createdDefaults);
      return createdDefaults;
    }

    if (!data) {
      const defaults = getDefaultSettings();
      cachedSettings.set(cacheKey, defaults);
      return defaults;
    }

    const resolved = {
      aiModel: data.ai_model || DEFAULT_MODEL,
      updatedAt: data.updated_at,
    };

    cachedSettings.set(cacheKey, resolved);
    return resolved;
  } catch (err) {
    console.error('[Settings] Error:', err.message);
    return getDefaultSettings();
  }
}

/**
 * Update settings
 * @param {Object} updates - Settings to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateSettings(updates, userId = null) {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Build update object
    const dbUpdates = {};

    if (updates.aiModel) {
      // Validate model exists
      const modelConfig = getModelConfig(updates.aiModel);
      if (!modelConfig) {
        return { success: false, error: 'Invalid model selection' };
      }
      dbUpdates.ai_model = updates.aiModel;
    }

    if (Object.keys(dbUpdates).length === 0) {
      return { success: false, error: 'No valid setting updates provided' };
    }

    if (userId) {
      const { data: existing, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      let updateError = null;
      if (existing?.id) {
        const { error } = await supabase
          .from('settings')
          .update(dbUpdates)
          .eq('id', existing.id);
        updateError = error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ ...dbUpdates, user_id: userId });
        updateError = error;
      }

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error } = await supabase
        .from('settings')
        .update(dbUpdates)
        .not('id', 'is', null); // Backward compatibility for unauthenticated mode.

      if (error) {
        throw error;
      }
    }

    // Clear cache so next read gets fresh data.
    cachedSettings.delete(getCacheKey(userId));

    console.log('[Settings] Updated:', dbUpdates);
    return { success: true };
  } catch (err) {
    console.error('[Settings] Update failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get the currently selected AI model config
 * @returns {Promise<Object>} Model configuration
 */
export async function getSelectedModelConfig(userId = null) {
  const settings = await getSettings(userId);
  return getModelConfig(settings.aiModel);
}

/**
 * Get default settings (used when Supabase not configured)
 */
function getDefaultSettings() {
  return {
    aiModel: DEFAULT_MODEL,
    updatedAt: null,
  };
}

/**
 * Get settings with available options for UI
 * @returns {Promise<Object>} Settings with options
 */
export async function getSettingsWithOptions(userId = null) {
  const settings = await getSettings(userId);
  const models = getAvailableModels();
  const currentModel = getModelConfig(settings.aiModel);

  return {
    current: {
      aiModel: settings.aiModel,
      aiModelName: currentModel.name,
    },
    options: {
      models,
    },
  };
}
