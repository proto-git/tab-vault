function sanitizeErrorCode(value) {
  if (!value) return null;
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .slice(0, 64);
}

function nowIso() {
  return new Date().toISOString();
}

export function logEvent(eventName, payload = {}) {
  const event = {
    timestamp: nowIso(),
    event_name: eventName,
    ...payload,
  };

  // Log as single-line JSON for cheap ingestion in hosted logs.
  console.log(JSON.stringify(event));
}

export function logRequestLifecycle(req, res, startedAtMs) {
  const latencyMs = Date.now() - startedAtMs;
  const route = req.route?.path
    ? `${req.baseUrl || ''}${req.route.path}`
    : req.originalUrl || req.path;

  logEvent('http_request_completed', {
    request_id: req.requestId || null,
    user_id: req.user?.id || null,
    method: req.method,
    route,
    status_code: res.statusCode,
    latency_ms: latencyMs,
    error_code: sanitizeErrorCode(res.locals?.errorCode),
  });
}

export function setErrorCode(res, errorCode) {
  if (!res?.locals) return;
  res.locals.errorCode = sanitizeErrorCode(errorCode);
}
