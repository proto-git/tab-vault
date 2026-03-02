# Rollback + Recovery Plan - Phase 1

## Rollback Triggers
- Sustained 4xx/5xx spike after migration deploy.
- Authenticated happy path blocked for capture/search/settings.
- Unexpected RLS denials for valid user operations.

## Immediate Actions (0-15 minutes)
1. Freeze deploys.
2. Set `AUTH_ENFORCE=false` only if emergency access is needed.
3. Capture failing request IDs and event logs (`auth_failure`, `endpoint_error`).

## SQL Rollback Strategy
1. Re-enable temporary permissive policies for affected table(s) only.
2. Restore prior RPC grants if a critical route is blocked.
3. Keep migration script and rollback SQL paired in release notes.

## Recovery Strategy
1. Identify ownership mismatches (`user_id IS NULL` / incorrect mapping).
2. Backfill correct `user_id` values.
3. Re-apply strict policies and validate policy matrix.
4. Re-enable `AUTH_ENFORCE=true` once smoke tests pass.

## Smoke Validation After Recovery
- Auth login + token acquisition.
- Capture create + process.
- Search + recent + settings + categories.
- Notion sync route for owned captures.
