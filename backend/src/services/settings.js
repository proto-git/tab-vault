// Settings Service
// Manages user preferences stored in Supabase

import { supabase, isConfigured } from './supabase.js';
import { DEFAULT_MODEL, getModelConfig, getAvailableModels } from '../config/models.js';

// Cache settings in memory (refreshed on update)
let cachedSettings = null;

/**
 * Get current settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  if (!isConfigured()) {
    return getDefaultSettings();
  }

  // Return cached if available
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('[Settings] Failed to fetch:', error.message);
      return getDefaultSettings();
    }

    cachedSettings = {
      aiModel: data.ai_model || DEFAULT_MODEL,
      updatedAt: data.updated_at,
    };

    return cachedSettings;
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
export async function updateSettings(updates) {
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

    const { error } = await supabase
      .from('settings')
      .update(dbUpdates)
      .not('id', 'is', null); // Update all rows (should be just one)

    if (error) {
      throw error;
    }

    // Clear cache so next read gets fresh data
    cachedSettings = null;

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
export async function getSelectedModelConfig() {
  const settings = await getSettings();
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
export async function getSettingsWithOptions() {
  const settings = await getSettings();
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
