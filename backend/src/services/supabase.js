import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Create client only if configured
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Supabase] Connected to:', supabaseUrl);
} else {
  console.log('[Supabase] Not configured - running in dev mode');
  console.log('[Supabase] Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable');
}

// Helper to check if Supabase is configured
export function isConfigured() {
  return supabase !== null;
}

// Export client (may be null in dev mode)
export { supabase };

// Export a function to test connection
export async function testConnection() {
  if (!isConfigured()) {
    return { success: false, error: 'Not configured' };
  }

  try {
    const { data, error } = await supabase
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
