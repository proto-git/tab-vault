# Devil's-Advocate Memo - Phase 1

## Security Skeptic
### Concern
- App-layer checks can be bypassed if DB policies are permissive.
- Anon role access to tables/functions can leak data with weak filtering.

### Challenge Test
- Attempt cross-user reads/writes through API and direct SQL as authenticated user.
- Attempt unauthenticated RPC execution.

### Response
- Replaced permissive policies with `auth.uid() = user_id` policies on all core tables.
- Revoked anon table access and anon execute on core helper RPCs.
- Hardened RPCs to also enforce `auth.uid()` in function predicates.

## Data-Model Skeptic
### Concern
- Legacy rows with null `user_id` may become inaccessible after strict RLS.
- Global uniqueness on categories prevents multi-user-safe data model.

### Challenge Test
- Run migration with mixed legacy/null ownership rows.
- Validate category create/update flows for multiple users.

### Response
- Migration includes ownership backfill and explicit safety stop when ambiguous ownership exists.
- Categories uniqueness changed to `(user_id, name)` and defaults are per-user bootstrapped.
- Settings deduped to one active row per user.

## UX Skeptic
### Concern
- Security hardening can degrade user flows via silent failures.
- Rate limiting might feel random without clear feedback.

### Challenge Test
- Verify auth error clarity in extension/web flows.
- Confirm rate-limit responses are explicit and recoverable.

### Response
- Standardized auth error codes and telemetry events.
- Added request IDs and structured endpoint error events for quicker debugging.
- Rate limiting returns explicit `429` + `Retry-After` header and JSON guidance.

## Decision
- Proceed with strict DB isolation now; defer UX polish to Phase 2 while preserving operational visibility in Phase 1.
