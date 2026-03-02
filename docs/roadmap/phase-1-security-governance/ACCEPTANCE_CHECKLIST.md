# Acceptance Checklist - Phase 1

## Functional Security
- [ ] User A cannot read User B captures (API + direct DB check).
- [ ] User A cannot update/delete User B records.
- [ ] Unauthenticated requests to protected API endpoints fail.
- [ ] RLS-denied operations return safe API errors.

## Functional Runtime
- [ ] Capture create succeeds for authenticated user.
- [ ] Search + semantic search return owned records only.
- [ ] Settings, categories, usage endpoints work under strict RLS.
- [ ] Background processing succeeds with auth context.

## Observability
- [ ] Request ID attached to every API response.
- [ ] `auth_failure` events are emitted with required telemetry fields.
- [ ] `endpoint_error` events include normalized error codes.
- [ ] `rate_limit_event` emits on throttle.

## CI + Release Quality
- [ ] CI syntax checks pass.
- [ ] Security regression checks pass.
- [ ] Migration dry run completed in staging/dev project.
- [ ] Rollback SQL tested before production rollout.
