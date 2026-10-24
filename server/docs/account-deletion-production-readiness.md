# Student deletion: final account-based protection

Local changes and targeted QA, 24 October 2026. This document supersedes earlier
deletion-specific IP/proxy release blockers; Phase 2/2.1 transaction and UI audits
remain valid. No production access, configuration changes, commits or deployment.

**Final operational follow-up:** `account-deletion-operations.md` now documents
the owner-confirmed test-only/no-recoverable-backup situation, a practical support
and retention procedure, a no-historical-restore gate, and exact manual production
checks. It supersedes the unresolved-procedure statements below. Production
configuration is still NOT VERIFIED; there were no repeated access attempts.

## Minimal no-additional-cost solution

`DELETE /api/account` now applies:

1. A fixed service-wide budget: 300 DELETE requests per minute, before JWT
   verification or account lookup. Its constant key has bounded storage and
   cannot be rotated by headers, network paths, claimed IDs or invalid tokens.
2. Existing student JWT verification and live-account authentication, then an
   explicit student/positive-safe-integer identity check. Admin identities fail.
3. Five attempts per verified student account per 15 minutes, keyed by numeric
   account identity, not raw token, IP, body or query string. Rotating signed
   tokens for one account does not reset the allowance. Invalid passwords and
   malformed deletion payloads consume it; unauthenticated callers cannot select
   a student's quota. The parser remains bounded at 8 KB and errors sanitized.
4. Unchanged current-password bcrypt verification, exact explicit confirmation,
   account/ownership locks, child-first transaction, rollback/unknown-COMMIT
   safeguards and confirmed-success-only UI/logout flow.

No deletion quota reads `req.ip`, X-Real-IP, X-Forwarded-For, Forwarded, Host,
X-Railway-* or a client-supplied target. Private-network/TCP/direct bypasses cannot
spoof the authenticated quota identity. There is no claim of per-end-user IP
protection. The old 20-per-socket quota has been removed so unrelated students
behind Railway's edge do not share that low threshold.

No new Railway variable or paid service is needed. Leave TRUSTED_PROXY_CIDRS
absent. Express proxy trust remains false by default for the rest of the app;
existing login/OTP IP limiters are unchanged and may aggregate users behind a
proxy. Their existing normalized-identity protection is also unchanged. These
unrelated routes were not refactored or retested in this focused change.

## Process and availability limits

Owner-confirmed configuration is one replica with start command `node server.js`.
Source review finds one HTTP listener and no clustered HTTP launcher. Isolated
document-parser children do not run the HTTP application. No shared limiter store
is needed for this single serving process.

Memory counters reset on process restart. Rolling old/new deployments can have
independent allowances, as can future replicas/workers. These are best-effort
process-local abuse limits, not durable global lockouts. Strict restart-persistent
or multi-instance quotas would require a shared atomic store; none is provisioned
or claimed here. Operators must account for this behavior when releasing/scaling.

The global budget intentionally favors bounded server work over deletion
availability during a flood. At 300 requests/minute it bounds account verification
and subsequent work to an average five admitted requests/sec, with a possible
300-request burst; the per-account cap further bounds password attempts. It is
not a concurrency limiter or comprehensive DDoS solution. Many synthetic accounts
or unauthenticated callers can temporarily exhaust it for everyone. Both limiter
responses return 429 with Retry-After and the appropriate wait message; students
remain signed in and no deletion success is displayed. No circuit breaker can
guarantee availability under arbitrary traffic on a shared budget.

## Privacy guarantees and operations

Privacy Notice 1.2 states exactly what confirmed deletion removes from the active
database and that existing student tokens no longer authorize new protected
requests. It distinguishes backups, exported records, external providers,
downloaded content and already authorized in-flight responses. It promises no
unverified retention deadline or immediate external/backup erasure. Unknown
outcomes require verification, not an assumption of success/failure or blind
resubmission. Automatic inactivity deletion remains disabled.

This wording does not establish a legal retention schedule or repair a backup
restore process. Before production release the operator must identify retained
copies/provider policies, approve retention obligations and procedures, and
ensure that restored backups are isolated until deletions have been reconciled
and removed before reopening traffic. No verified deletion-reconciliation record
or exercised restore procedure was supplied; do not claim restored backups cannot
reactivate deleted accounts. Operator/support verification of uncertain outcomes
also needs a designated process. These remain operational release prerequisites.

Live HTTPS/CORS/secrets/schema configuration verification from the previous review
is still outstanding; localhost checks cannot certify it. The prior read-only
Railway CLI returned Unauthorized. No production check was attempted in this
localhost-only task. The lack of stable proxy CIDRs is **no longer a blocker for
the deletion endpoint** because protection no longer depends on that boundary.

## Targeted QA

- Backend proxy/account-route HTTP tests: 8 passed. Real loopback proxy and direct
  requests; synthetic signed JWTs; 25 students with independent quotas; token,
  socket and header rotation; admin/invalid identity rejection; unauthenticated
  quota isolation; service-wide flood protection before authentication.
- Disposable local MySQL deletion integration: 15 results passed, including its
  runner. Full authentication/bcrypt and endpoint behavior; 25 live students on
  one socket; deletion, invalid password/confirmation/JWT, admin protection,
  duplicate requests, rollback, unknown commit, concurrent writes, preservation,
  session/login rejection and all 44 FK integrity relationships. Source table
  counts unchanged; disposable schema removed. No existing records changed.
- Privacy Notice rendering/navigation/content regressions: 6 passed.
- Two new Settings browser cases: account and service 429 display the correct
  wait, preserve auth, clear password/confirmation, disable premature resubmission
  and never show success. These UI-only tests use intercepted synthetic responses;
  backend/integration checks above exercise actual HTTP endpoints.
- Total: **31 passed, 0 failed, 0 skipped**. Changed frontend files pass ESLint;
  git diff whitespace checks pass. Existing Vite module-format warning remains.

The previous complete 776 passing QA results are reused as historical coverage
for unchanged Profile/top-bar/assessment/recommendation/admin/responsive behavior.
No unrelated full regression or production build rerun was necessary.

## Files changed in this follow-up

- server/routes/accountRoutes.js
- server/tests/accountProxyTrust.test.js
- server/tests/accountDeletion.integration.test.js
- client/src/pages/PrivacyNotice.jsx
- client/src/pages/PrivacyTransparency.test.js
- client/src/pages/StudentSettings.browser.spec.js
- server/docs/student-account-deletion.md
- server/docs/account-deletion-phase21.md (superseded-findings pointer)
- server/docs/account-deletion-production-readiness.md (this file)

Local feature/security changes: PASS. Production deployment: NO-GO until the
remaining production configuration and retention/restore operational checks above
are completed. No further deletion/ingress code change is currently required.
