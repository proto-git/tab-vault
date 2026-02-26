import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const authEnforce = (process.env.AUTH_ENFORCE || 'false').toLowerCase() === 'true';

const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

export function isAuthEnforced() {
  return authEnforce;
}

export async function authGate(req, res, next) {
  req.user = null;

  if (!authClient) {
    if (authEnforce) {
      return res.status(503).json({
        success: false,
        error: 'Auth enforcement enabled, but Supabase is not configured',
      });
    }
    return next();
  }

  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    if (authEnforce) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    return next();
  }

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
      if (authEnforce) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired authentication token',
        });
      }
      return next();
    }

    req.user = data.user;
    return next();
  } catch (error) {
    if (authEnforce) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
      });
    }
    return next();
  }
}
