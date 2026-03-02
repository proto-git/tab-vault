# Implementation Spec - Phase 1

## Backend Runtime Changes
- Added request-scoped Supabase context:
  - `backend/src/services/supabase.js`
  - Uses `AsyncLocalStorage` + token-scoped Supabase clients.
  - Existing imports of `supabase` now resolve to request-context client automatically.
- Added auth and telemetry hardening:
  - `backend/src/middleware/auth.js`
  - Standardized auth errors and telemetry events (`auth_failure`, `auth_success`).
- Added API rate limiting:
  - `backend/src/middleware/rateLimit.js`
  - In-memory windowed limiter with telemetry + `Retry-After`.
- Added structured request lifecycle logging:
  - `backend/src/services/telemetry.js`
  - `backend/src/index.js` request IDs, lifecycle logging, error normalization.
- Propagated auth context to background processor:
  - `backend/src/services/processor.js`
  - `backend/src/routes/capture.js`

## Database Changes
- New migration: `database/migrations/012_phase1_rls_hardening.sql`
- Key actions:
  - Remove permissive policies on core tables.
  - Create strict per-user policies on `captures`, `usage`, `settings`, `categories`.
  - Revoke anon table/RPC access for core data helpers.
  - Harden helper RPCs with `auth.uid()` ownership checks.
  - Add safety ownership normalization for legacy rows.
  - Move category uniqueness from global `name` to `(user_id, name)`.

## CI Changes
- Added SQL security regression check script:
  - `scripts/check-security.mjs`
- Wired into CI workflow:
  - `.github/workflows/ci.yml`

## Telemetry Schema
- Required event fields:
  - `event_name`
  - `user_id`
  - `request_id`
  - `route`
  - `status_code`
  - `latency_ms`
  - `error_code`

## Compatibility Notes
- Strict RLS assumes authenticated API usage with JWT propagation.
- Background processing now accepts auth context to keep RLS-compliant writes.
- Category defaults are now created per-user when absent.
