import { logEvent, setErrorCode } from '../services/telemetry.js';

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const requestBuckets = new Map();

function getClientKey(req) {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return `ip:${forwardedFor.split(',')[0].trim()}`;
  }

  return `ip:${req.ip || 'unknown'}`;
}

function pruneExpired(timestamps, now) {
  while (timestamps.length > 0 && now - timestamps[0] > WINDOW_MS) {
    timestamps.shift();
  }
}

export function apiRateLimit(req, res, next) {
  const now = Date.now();
  const clientKey = getClientKey(req);
  const timestamps = requestBuckets.get(clientKey) || [];

  pruneExpired(timestamps, now);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterMs = Math.max(WINDOW_MS - (now - timestamps[0]), 1000);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    setErrorCode(res, 'RATE_LIMITED');
    logEvent('rate_limit_event', {
      request_id: req.requestId || null,
      user_id: req.user?.id || null,
      route: req.originalUrl || req.path,
      status_code: 429,
      latency_ms: null,
      error_code: 'RATE_LIMITED',
      limit_window_ms: WINDOW_MS,
      limit_max_requests: MAX_REQUESTS,
      client_key: clientKey,
    });

    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please retry shortly.',
      retryAfterSeconds,
    });
  }

  timestamps.push(now);
  requestBuckets.set(clientKey, timestamps);
  return next();
}

// Best-effort in-memory cleanup to avoid unbounded map growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestBuckets.entries()) {
    pruneExpired(timestamps, now);
    if (timestamps.length === 0) {
      requestBuckets.delete(key);
    }
  }
}, WINDOW_MS).unref();
