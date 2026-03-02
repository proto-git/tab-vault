# Production Dashboard Checklist - Phase 1

## Required Panels
- Auth failures by `error_code` (5m, 1h, 24h)
- Endpoint errors by route + status code
- RLS-denied events by route
- Rate-limit events by route/user
- Background processing failures by error code

## Alert Thresholds
- Auth failure rate > 10% for 10 minutes
- Endpoint error rate > 5% for 10 minutes
- `RLS_DENIED` on happy-path endpoints > baseline + 3x
- Background processor failure rate > 5% for 15 minutes

## On-Call Runbook Links
- Rollback + recovery plan
- Policy test matrix
- Migration script and validation SQL

## Daily Checks (During Rollout Week)
- Review top `error_code` values
- Verify no unexpected cross-user query attempts succeed
- Verify capture/search/settings success rates remain stable
