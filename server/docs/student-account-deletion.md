# Student self-service deletion (local implementation)

Implemented and verified on localhost, 24 October 2026. No migration, inactivity
scheduler, production change, commit, or deployment is included.

## Request and authorization

`DELETE /api/account` uses the existing student bearer-token middleware.
The JSON object must contain exactly `currentPassword` (nonempty string, at most
1024 characters) and `confirmation: "DELETE"`. Query parameters and extra body
fields, including account identifiers, are rejected. The target is exclusively
`req.user.userId`. Student/admin/reset JWT audiences remain separate; admin claims
are also rejected explicitly. Responses are `Cache-Control: no-store`.

The route checks configured browser origins, rejects unapproved origins and
unidentified cross-site requests, and requires JSON and an explicit bearer token.
There is no cookie authentication. A private bounded JSON parser sanitizes parse
errors without logging their potentially sensitive content.

Rate limits: 5 attempts per authenticated, live student account per 15 minutes.
Only the existing middleware's verified JWT identity is used, never headers,
client-supplied account IDs or the token string itself. New JWTs for the same
student use the same quota. Wrong-password and invalid-payload requests consume
that student's allowance; unauthenticated/admin requests do not consume it.
A separate fixed service budget of 300 DELETE requests per minute runs before
authentication to bound verification/database-lookup work and limit multi-account
abuse. It is intentionally shared capacity, not a per-client IP quota. A flood
can exhaust it and temporarily deny deletion availability; both 429 responses
include retry information. No IP addresses are used for deletion limiter keys.

No additional Railway variable, proxy CIDRs, trusted X-Real-IP setting or paid
service is required for deletion protection. Keep TRUSTED_PROXY_CIDRS absent on
the confirmed deployment. Public/private/TCP callers cannot rotate deletion
identity through forwarding headers. Other routes' existing IP limits are not
changed by this feature and may still aggregate clients behind Railway.
The owner confirmed one configured replica and `node server.js`; source review
finds one HTTP-serving process (document-parser children do not serve requests).
Memory counters reset on restart and independent old/new deployments have
independent counters. Accept that bounded temporary increase/reset operationally;
strict cross-deployment or multi-replica quotas require shared storage. No store
was provisioned. See `account-deletion-production-readiness.md` for current status;
earlier proxy-blocker findings in the Phase 2.1 report are historical.

## Atomic deletion and concurrency

One pooled MySQL connection begins one transaction, verifies FK enforcement,
locks the account, and verifies its active state and bcrypt password. It then
locks direct owned rows and checks both directions of the four cross-owner
relationships (attempt/personality, recommendation/personality, term/cycle,
check-in/term). Conflicts abort; records belonging to others are never deleted.

Deletion order:

1. Recommendation items; check-in answers and AI analyses, through owned parents.
2. Recommendations, assessment attempts, personality assessments.
3. Semester check-ins, college terms, college tracking cycles.
4. Personal career roadmaps, saved-course associations, feedback, interest and
   skill responses, profiles including legacy fields, and OTP verification rows.
5. Student account.

The implementation verifies all direct owned rows are gone and exactly one account
was removed. Enabled foreign keys prohibit surviving dependent grandchildren.
Shared courses, questions, schools, administrative and publication data are untouched.

The root lock blocks concurrent direct child inserts through their FKs. Locked
owned parent rows block late recommendation/check-in descendants. Existing
autosaves can finish first; writes against deleted parents fail. Password resets
must still find a live account and OTP. Competing transactions may deadlock;
deletion then rolls back and returns failure instead of retrying destructively.
No changes to unrelated write services or database constraints were necessary.

Before COMMIT, any error triggers rollback. Once COMMIT starts, a lost acknowledgement
produces `503 DELETION_OUTCOME_UNKNOWN`, destroys the connection, and never claims
success or rollback. It does not automatically retry. A normal response is
`200 { "deleted": true }` only after acknowledged commit.

The existing authentication middleware checks account existence on every protected
request, so all old student JWTs are rejected after commit. Removing OTP rows also
invalidates reset tokens. No refresh-token store exists. Already authorized
in-flight responses and offline browser contents cannot be recalled remotely.

Phase 2.1 profile saves use the same account-first lock order as deletion, verify
active account state and write results, and commit Personal Factors, attempt
snapshots and recommendation refresh together. Conflicts return 409; uncertain
COMMIT acknowledgement returns 503 `PROFILE_SAVE_OUTCOME_UNKNOWN` without retry.

## UI and privacy

Settings reuses the existing confirmation modal and success component. Current
password and an explicit checkbox are required; a synchronous pending ref prevents
double submission. Passwords stay in component memory and are cleared after each
request or cancellation. After confirmed success, the success message is shown,
existing student auth/draft cleanup runs, and navigation replaces Settings with
Login. Admin browser authentication is preserved.

A network timeout/lost or malformed response is not evidence of success. The UI
blocks further submission in that view, retains authentication, and directs the
student to the research team for verification. A later authentication failure
is not presented as proof of deletion.

Privacy Notice 1.2 describes removal from the active database and explicitly does
not promise immediate deletion from backups, exports, or external providers.
Retention schedules, institutional obligations, and backup/restore procedures
remain unresolved. No automatic inactivity deletion is enabled.

## Reproducible local database tests

From `server`, run in PowerShell:

```powershell
$env:ACCOUNT_DELETION_DB_TEST='1'
node --test tests/accountDeletion.integration.test.js
```

The helper rejects non-loopback DB hosts. It reads only table definitions and
aggregate counts from the configured source database. It creates a randomly named
`learnmatch_delete_test_<hex>` database, clones empty tables in FK order with
constraints enabled, and inserts only synthetic data. Existing auth controllers
are imported only after configuring their pool for the disposable database.
The exact disposable database is dropped afterward; source table counts are
checked unchanged. No existing student records are copied or deleted.

The integration test is intentionally opt-in and skipped by ordinary `npm test`.
It covers all 17 tables, schema-scope completeness, authentication/validation,
admin protection, rate limiting, CSRF-origin rejection, duplicate requests,
concurrent writes, password resets, rollback, cross-owner anomalies, unknown
commit outcomes, login/session invalidation, unrelated data preservation, and
all 44 FK orphan checks.

Frontend browser checks use localhost Vite and intercepted synthetic API responses:
`npx playwright test --config playwright.settings.config.js` from `client`.
They cover mobile/desktop navigation, the password/confirmation flow, pending state,
confirmed success and cleanup, server failures, and uncertain network outcomes.
