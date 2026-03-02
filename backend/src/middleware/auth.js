import { createClient } from '@supabase/supabase-js';
import { logEvent, setErrorCode } from '../services/telemetry.js';

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

function authFailure(req, res, statusCode, message, errorCode) {
  setErrorCode(res, errorCode);
  logEvent('auth_failure', {
    request_id: req.requestId || null,
    user_id: req.user?.id || null,
    route: req.originalUrl || req.path,
    status_code: statusCode,
    latency_ms: null,
    error_code: errorCode,
  });
  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export async function authGate(req, res, next) {
  req.user = null;
  req.authToken = null;

  if (!authClient) {
    if (authEnforce) {
      return authFailure(
        req,
        res,
        503,
        'Auth enforcement enabled, but Supabase is not configured',
        'AUTH_SERVICE_UNAVAILABLE'
      );
    }
    return next();
  }

  const token = extractBearerToken(req.headers.authorization);
  req.authToken = token;

  if (!token) {
    if (authEnforce) {
      return authFailure(req, res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }
    return next();
  }

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
      if (authEnforce) {
        return authFailure(
          req,
          res,
          401,
          'Invalid or expired authentication token',
          'AUTH_INVALID_TOKEN'
        );
      }
      req.authToken = null;
      return next();
    }

    req.user = data.user;
    return next();
  } catch (error) {
    if (authEnforce) {
      return authFailure(req, res, 401, 'Authentication failed', 'AUTH_FAILURE');
    }
    req.authToken = null;
    return next();
  }
}
