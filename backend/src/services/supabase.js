import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const requestSupabaseContext = new AsyncLocalStorage();

function createSupabaseClient(accessToken = null) {
  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(supabaseUrl, supabaseKey, options);
}

const baseSupabaseClient = supabaseUrl && supabaseKey
  ? createSupabaseClient()
  : null;

if (baseSupabaseClient) {
  console.log('[Supabase] Connected to:', supabaseUrl);
} else {
  console.log('[Supabase] Not configured - running in dev mode');
  console.log('[Supabase] Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable');
}

function getClientForToken(token) {
  if (!baseSupabaseClient || !token) {
    return baseSupabaseClient;
  }
  return createSupabaseClient(token);
}

export function getSupabaseContext() {
  return requestSupabaseContext.getStore() || null;
}

export function getSupabaseClient() {
  const scopedClient = getSupabaseContext()?.client;
  return scopedClient || baseSupabaseClient;
}

export function withSupabaseAuthContext({
  authToken = null,
  requestId = null,
  userId = null,
} = {}, callback) {
  if (!isConfigured()) {
    return callback();
  }

  return requestSupabaseContext.run({
    requestId,
    userId,
    authTokenPresent: Boolean(authToken),
    client: getClientForToken(authToken),
  }, callback);
}

export function withSupabaseRequestContext(req, callback) {
  return withSupabaseAuthContext({
    authToken: req.authToken || null,
    requestId: req.requestId || null,
    userId: req.user?.id || null,
  }, callback);
}

// Helper to check if Supabase is configured
export function isConfigured() {
  return baseSupabaseClient !== null;
}

const supabaseProxy = new Proxy({}, {
  get(_target, property) {
    const client = getSupabaseClient();
    if (!client) {
      return undefined;
    }

    const value = client[property];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Export client proxy (request-scoped when auth context exists).
export { supabaseProxy as supabase };

// Export a function to test connection
export async function testConnection() {
  if (!isConfigured()) {
    return { success: false, error: 'Not configured' };
  }

  try {
    const { error } = await getSupabaseClient()
      .from('captures')
      .select('count')
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: 'Connected successfully' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
