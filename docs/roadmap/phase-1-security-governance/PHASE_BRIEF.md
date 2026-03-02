# Phase Brief - Phase 1 Security + Data Governance Hardening

## Goals
- Enforce database-level data isolation for all user-owned entities.
- Preserve authenticated happy-path behavior for capture/search/sync flows.
- Add low-overhead telemetry for auth failures, rate-limits, endpoint errors, and background processing failures.
- Add CI checks that fail builds when permissive SQL policies are reintroduced.

## Scope
- Strict RLS for `captures`, `usage`, `settings`, `categories`.
- Request-scoped Supabase client context so DB calls execute with request JWT.
- Auth + API telemetry and basic in-memory rate limiting.
- Security regression checks in CI.
- Phase-level artifacts for gate review.

## Non-Goals
- Major frontend redesign.
- New AI product features.
- Mobile implementation.

## Risks
- Existing legacy rows without `user_id` can fail strict RLS rollout.
- Background processing can fail if request auth context is not propagated.
- Categories uniqueness constraints can block multi-user expansion if left global.

## Mitigations
- Migration backfills user ownership with safety guardrails.
- Processor now supports token-aware execution context in background pipeline.
- Category uniqueness moved to `(user_id, name)`.

## Exit Gate (Must Pass)
- Cross-user read/write blocked at DB layer.
- Authenticated happy path remains functional.
- RLS/auth incident response runbook documented.
- CI blocks permissive policy regressions.
