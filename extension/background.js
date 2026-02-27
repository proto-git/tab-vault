// Tab Vault - Background Service Worker

// Configuration - Production backend URL (can be overridden via extension settings)
const DEFAULT_API_URL = 'https://backend-production-49f0.up.railway.app/api';
const DEFAULT_SUPABASE_URL = 'https://qxflrkojvsjovxiyceua.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_C6AscAuRnGmWPxdHVaZS-Q_M8SfWqmk';
const AUTH_STORAGE_KEY = 'supabaseSession';
const LEGACY_TOKEN_KEY = 'supabaseAccessToken';
const AUTH_REFRESH_BUFFER_SECONDS = 90;

let API_URL = DEFAULT_API_URL;
let cachedSupabaseConfig = null;

function getBackendBaseUrl() {
  return API_URL.replace(/\/api\/?$/, '');
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeSession(payload) {
  const expiresAt = payload.expires_at || (nowEpochSeconds() + (payload.expires_in || 3600));
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || 'bearer',
    expires_at: expiresAt,
    expires_in: payload.expires_in || Math.max(expiresAt - nowEpochSeconds(), 0),
    user: payload.user ? { id: payload.user.id, email: payload.user.email } : null,
  };
}

function isSessionExpiring(session) {
  if (!session?.expires_at) {
    return false;
  }
  return session.expires_at <= nowEpochSeconds() + AUTH_REFRESH_BUFFER_SECONDS;
}

async function getStoredSession() {
  const data = await chrome.storage.local.get([AUTH_STORAGE_KEY]);
  return data[AUTH_STORAGE_KEY] || null;
}

async function saveSession(session) {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session });
  await chrome.storage.sync.remove([LEGACY_TOKEN_KEY]);
}

async function clearSession() {
  await chrome.storage.local.remove([AUTH_STORAGE_KEY]);
  await chrome.storage.sync.remove([LEGACY_TOKEN_KEY]);
}

async function loadSupabaseConfig() {
  if (cachedSupabaseConfig) {
    return cachedSupabaseConfig;
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/auth/config`);
    if (response.ok) {
      const config = await response.json();
      if (config?.supabaseUrl && config?.supabaseAnonKey) {
        cachedSupabaseConfig = {
          supabaseUrl: config.supabaseUrl,
          supabaseAnonKey: config.supabaseAnonKey,
        };
        return cachedSupabaseConfig;
      }
    }
  } catch (error) {
    console.log('[Tab Vault] Could not fetch auth config from backend:', error.message);
  }

  const stored = await chrome.storage.sync.get(['supabaseUrl', 'supabaseAnonKey']);
  if (stored.supabaseUrl && stored.supabaseAnonKey) {
    cachedSupabaseConfig = {
      supabaseUrl: stored.supabaseUrl,
      supabaseAnonKey: stored.supabaseAnonKey,
    };
    return cachedSupabaseConfig;
  }

  cachedSupabaseConfig = {
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
  };
  return cachedSupabaseConfig;

}

function supabaseHeaders(anonKey) {
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
  };
}

async function refreshSession(force = false) {
  const currentSession = await getStoredSession();
  if (!currentSession?.refresh_token) {
    return { success: false, error: 'No refresh token available' };
  }

  if (!force && !isSessionExpiring(currentSession)) {
    return { success: true, session: currentSession };
  }

  const config = await loadSupabaseConfig();
  if (!config) {
    return { success: false, error: 'Supabase auth config not available' };
  }

  try {
    const response = await fetch(
      `${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: supabaseHeaders(config.supabaseAnonKey),
        body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      await clearSession();
      return {
        success: false,
        error: payload.error_description || payload.msg || payload.error || 'Failed to refresh session',
      };
    }

    const nextSession = normalizeSession(payload);
    await saveSession(nextSession);
    return { success: true, session: nextSession };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function signInWithPassword(email, password) {
  const config = await loadSupabaseConfig();
  if (!config) {
    return { success: false, error: 'Supabase auth config not available' };
  }

  try {
    const response = await fetch(
      `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: supabaseHeaders(config.supabaseAnonKey),
        body: JSON.stringify({ email, password }),
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      return {
        success: false,
        error: payload.error_description || payload.msg || payload.error || 'Sign-in failed',
      };
    }

    const session = normalizeSession(payload);
    await saveSession(session);

    return {
      success: true,
      user: session.user,
      expiresAt: session.expires_at,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getLegacyToken() {
  const data = await chrome.storage.sync.get([LEGACY_TOKEN_KEY]);
  return data[LEGACY_TOKEN_KEY] || null;
}

async function ensureValidAccessToken() {
  const session = await getStoredSession();
  if (session?.access_token) {
    if (isSessionExpiring(session)) {
      const refreshed = await refreshSession(true);
      if (refreshed.success && refreshed.session?.access_token) {
        return refreshed.session.access_token;
      }
      return null;
    }
    return session.access_token;
  }

  return getLegacyToken();
}

async function getAuthState() {
  const session = await getStoredSession();
  if (session?.access_token) {
    if (isSessionExpiring(session)) {
      const refreshed = await refreshSession(true);
      if (refreshed.success) {
        return {
          success: true,
          authenticated: true,
          user: refreshed.session.user,
          expiresAt: refreshed.session.expires_at,
        };
      }
      return { success: true, authenticated: false };
    }

    return {
      success: true,
      authenticated: true,
      user: session.user,
      expiresAt: session.expires_at,
    };
  }

  const legacy = await getLegacyToken();
  if (legacy) {
    return {
      success: true,
      authenticated: true,
      legacy: true,
      user: null,
      expiresAt: null,
    };
  }

  return { success: true, authenticated: false };
}

async function apiFetch(path, options = {}, retryOnUnauthorized = true) {
  const headers = {
    ...(options.headers || {}),
  };

  const token = await ensureValidAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshSession(true);
    if (refreshed.success && refreshed.session?.access_token) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${refreshed.session.access_token}`,
      };
      return fetch(`${API_URL}${path}`, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return response;
}

// Load custom API URL from storage on startup
chrome.storage.sync.get(['apiUrl'], (result) => {
  if (result.apiUrl) {
    API_URL = result.apiUrl;
    console.log('[Tab Vault] Using custom API URL:', API_URL);
  } else {
    console.log('[Tab Vault] Using default API URL:', API_URL);
  }
});

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-tab') {
    await captureCurrentTab();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authSignIn') {
    signInWithPassword(request.email, request.password).then(sendResponse);
    return true;
  }
  if (request.action === 'authSignOut') {
    clearSession().then(() => sendResponse({ success: true }));
    return true;
  }
  if (request.action === 'authGetState') {
    getAuthState().then(sendResponse);
    return true;
  }

  if (request.action === 'capture') {
    captureCurrentTab().then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.action === 'search') {
    searchCaptures(request.query).then(sendResponse);
    return true;
  }
  if (request.action === 'getRecent') {
    getRecentCaptures().then(sendResponse);
    return true;
  }
  if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  if (request.action === 'updateSettings') {
    updateSettings(request.settings).then(sendResponse);
    return true;
  }
  if (request.action === 'getUsage') {
    getUsage().then(sendResponse);
    return true;
  }
  if (request.action === 'getCategories') {
    getCategories().then(sendResponse);
    return true;
  }
  if (request.action === 'addCategory') {
    addCategory(request.category).then(sendResponse);
    return true;
  }
  if (request.action === 'deleteCategory') {
    deleteCategory(request.id).then(sendResponse);
    return true;
  }
  if (request.action === 'getTags') {
    getTags().then(sendResponse);
    return true;
  }
  if (request.action === 'deleteTag') {
    deleteTag(request.name).then(sendResponse);
    return true;
  }
  if (request.action === 'mergeTags') {
    mergeTags(request.source, request.target).then(sendResponse);
    return true;
  }
});

function getResponseError(response) {
  if (response.status === 401) {
    return 'Authentication required. Sign in from Settings -> Account Sign In.';
  }
  return `Server error: ${response.status}`;
}

// Capture the current tab
async function captureCurrentTab() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }

    // Get selected text if any
    let selectedText = '';
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      selectedText = result?.result || '';
    } catch (e) {
      // Some pages don't allow script injection (chrome://, etc.)
      console.log('Could not get selected text:', e.message);
    }

    // Send to backend
    const response = await apiFetch('/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title,
        selectedText: selectedText,
        favIconUrl: tab.favIconUrl
      })
    });

    if (!response.ok) {
      throw new Error(getResponseError(response));
    }

    const data = await response.json();

    // Show notification
    showNotification('Captured!', data.summary || 'Saved to Tab Vault');

    return { success: true, data };
  } catch (error) {
    console.error('Capture failed:', error);
    showNotification('Capture failed', error.message);
    return { success: false, error: error.message };
  }
}

// Search captures - tries semantic search first, falls back to keyword
async function searchCaptures(query) {
  try {
    // Try semantic search first (finds conceptually similar content)
    const semanticResponse = await apiFetch(`/semantic-search?q=${encodeURIComponent(query)}`);

    if (semanticResponse.ok) {
      const semanticData = await semanticResponse.json();
      if (semanticData.success && semanticData.results?.length > 0) {
        console.log('[Tab Vault] Semantic search:', semanticData.count, 'results');
        return semanticData;
      }
    }

    // Fall back to keyword search
    console.log('[Tab Vault] Falling back to keyword search');
    const response = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Search failed:', error);
    return { success: false, error: error.message, results: [] };
  }
}

// Get recent captures
async function getRecentCaptures() {
  try {
    const response = await apiFetch('/recent');
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get recent:', error);
    return { success: false, error: error.message, results: [] };
  }
}

// Get settings
async function getSettings() {
  try {
    const response = await apiFetch('/settings');
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get settings:', error);
    return { success: false, error: error.message };
  }
}

// Update settings
async function updateSettings(settings) {
  try {
    const response = await apiFetch('/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to update settings:', error);
    return { success: false, error: error.message };
  }
}

// Get usage stats
async function getUsage() {
  try {
    const response = await apiFetch('/usage');
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get usage:', error);
    return { success: false, error: error.message };
  }
}

// Get categories
async function getCategories() {
  try {
    const response = await apiFetch('/categories');
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get categories:', error);
    return { success: false, error: error.message };
  }
}

// Add category
async function addCategory(category) {
  try {
    const response = await apiFetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    });
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to add category:', error);
    return { success: false, error: error.message };
  }
}

// Delete category
async function deleteCategory(id) {
  try {
    const response = await apiFetch(`/categories/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to delete category:', error);
    return { success: false, error: error.message };
  }
}

// Get tags
async function getTags() {
  try {
    const response = await apiFetch('/tags');
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get tags:', error);
    return { success: false, error: error.message };
  }
}

// Delete tag
async function deleteTag(name) {
  try {
    const response = await apiFetch(`/tags/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to delete tag:', error);
    return { success: false, error: error.message };
  }
}

// Merge tags
async function mergeTags(source, target) {
  try {
    const response = await apiFetch('/tags/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target })
    });
    if (!response.ok) {
      throw new Error(getResponseError(response));
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to merge tags:', error);
    return { success: false, error: error.message };
  }
}

// Show browser notification
function showNotification(title, message) {
  // Use chrome.notifications if you want system notifications
  // For now, we'll rely on the popup UI feedback
  console.log(`[Tab Vault] ${title}: ${message}`);
}

// Listen for storage changes to update API URL dynamically
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.apiUrl) {
      API_URL = changes.apiUrl.newValue || DEFAULT_API_URL;
      cachedSupabaseConfig = null;
      console.log('[Tab Vault] API URL updated:', API_URL);
    }
    if (changes.supabaseUrl || changes.supabaseAnonKey) {
      cachedSupabaseConfig = null;
    }
  }
});
