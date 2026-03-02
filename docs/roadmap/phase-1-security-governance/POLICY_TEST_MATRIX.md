# Policy Test Matrix - Phase 1

| Table | Operation | Actor | Expected |
|---|---|---|---|
| captures | SELECT own row | authenticated owner | ALLOW |
| captures | SELECT other user's row | authenticated non-owner | DENY |
| captures | INSERT row with own user_id | authenticated owner | ALLOW |
| captures | INSERT row with different user_id | authenticated user | DENY |
| captures | UPDATE own row | authenticated owner | ALLOW |
| captures | UPDATE other user's row | authenticated non-owner | DENY |
| captures | DELETE own row | authenticated owner | ALLOW |
| captures | DELETE other user's row | authenticated non-owner | DENY |
| usage | SELECT own rows | authenticated owner | ALLOW |
| usage | SELECT other user's rows | authenticated non-owner | DENY |
| settings | SELECT own row | authenticated owner | ALLOW |
| settings | UPDATE own row | authenticated owner | ALLOW |
| settings | UPDATE other user's row | authenticated non-owner | DENY |
| categories | SELECT own rows | authenticated owner | ALLOW |
| categories | INSERT own row | authenticated owner | ALLOW |
| categories | UPDATE/DELETE other user's row | authenticated non-owner | DENY |
| RPC `search_captures` | Query with own filter or null | authenticated owner | OWN ROWS ONLY |
| RPC `search_captures` | Query with another user's filter | authenticated user | NO DATA / DENY |
| RPC `get_related_captures` | Related query for own capture | authenticated owner | ALLOW |
| RPC `get_daily_usage` | Usage summary | authenticated owner | OWN ROWS ONLY |
| Core tables | Any operation | unauthenticated/anon | DENY |
