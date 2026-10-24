# Student deletion: final operational procedure and release checks

Prepared 24 October 2026. Documentation only: no production access, changes,
deletions, backups, exports, restoration, deployment or secrets disclosure.
This document completes the operational follow-up to
`account-deletion-production-readiness.md` and supersedes its statement that no
practical retention/restore procedure has been documented.

## Current status and scope

- Owner confirms production contains test accounts only and no recoverable backup
  is available. These are owner-supplied facts, not independently inspected facts.
- The owner has accepted the documented no-backup risks for test-only accounts.
  That acceptance does not verify production schema/configuration or authorize
  restoring historical account data, deleting production records or deployment.
- Production configuration: **NOT VERIFIED**. Earlier authorized read-only CLI
  access returned Unauthorized. Do not repeat that failed access attempt, log in,
  change credentials or infer a production PASS from local tests.
- Retention procedure: **READY for the stated test-only, no-recovery operation**.
  This means the procedure is documented and actionable; it is not evidence of
  production execution, legal approval, provider erasure or a tested recovery plan.
- Deployment recommendation: **NO-GO pending the manual production configuration
  checks below**. No additional application defect was identified by this follow-up.

## Responsibilities and practical procedure

The LearnMatch Research Team is the contact named in Privacy Notice 1.2. The
project owner must designate an authorized operator within that team to execute
and record these steps. Support requests use learnmatch1@gmail.com, as already
published. This document does not assert that a staffed support rota exists.

### Normal self-service deletion

1. Explain that correct-password, confirmed deletion removes eligible owned
   records from the active database and is irreversible. With no recoverable
   backup, neither mistakes nor database loss can be repaired through restoration.
   Do not describe the current service as backed up or recoverable. Acknowledge
   that a fresh account is not recovery of the deleted account or its history.
2. Students use Settings, their current password and explicit confirmation. The
   backend alone determines the target from the verified student session. The
   operator must not ask for passwords/JWTs or use support email as authority to
   delete an account. Exceptional requests require separately approved identity
   verification and action; this procedure authorizes no production deletion.
3. Treat only the backend's acknowledged successful commit as confirmed deletion.
   The UI clears student authentication and redirects only then. Existing tokens
   fail new protected requests; already authorized in-flight responses and
   downloaded/offline content cannot be recalled.
4. A 429 is a retry-after condition, not deletion. A known pre-commit failure
   rolls back. An unknown outcome, lost response, or later login rejection alone
   proves neither deletion nor its completeness. Do not retry automatically.

### Unknown outcomes and support

1. Ask the student not to resubmit and collect only the approximate request time
   and minimum account reference needed for authorized verification. Never request
   passwords, tokens, assessment answers or a full database dump. Restrict ticket
   access to the designated operator; avoid copying personal information into logs.
2. After independent identity verification and separate authorization for any
   production read access, check the active account and applicable owned-record
   counts against the documented 17-table scope, including grandchildren through
   their owned parents. Use a read-only connection and bounded queries, not broad
   row exports. Record the result category/time, not credentials or student data.
3. An account absent with no eligible records remaining supports confirmed active
   database removal. An account still present means deletion is not confirmed;
   determine the failure before advising a later deliberate retry. Unexpected
   partial/orphaned data is an incident: stop and seek separate approval for repair.
   If the necessary account reference/evidence is unavailable, report that the
   outcome remains unverified rather than guessing or recreating records.

### Retention, copies and current no-backup operation

- The deletion transaction removes the eligible student graph in the active
  database. Shared courses/questions/schools, admin accounts and unrelated
  students remain. No automatic inactivity deletion is active.
- No recoverable backup is currently available according to the owner. This is
  a recovery limitation, not proof that every infrastructure snapshot, log,
  provider copy, prior export or developer download is absent or erased.
- Inventory existing operator-held exports/downloads and relevant provider-held
  copies before claiming that any particular copy has been removed. Record the
  holder/purpose/access and how deletion requests are routed. Do not create an
  export or backup merely to perform this documentation task.
- Handle known retained copies through their authorized custodians/providers and
  applicable institutional requirements. Record confirmed action or an unresolved
  limitation accurately. This task defines no legal retention period, fixed
  erasure deadline, provider guarantee or authority to destroy institutional data.
- Retain support evidence only for its documented operational purpose under an
  approved institutional retention decision. Access-restrict it in the meantime;
  do not invent a numeric period. The support channel is not an automatic erasure
  mechanism for external copies.
- Test-only operation without recovery can proceed after configuration checks if
  the project owner accepts permanent loss of test data. Do not silently extend
  that scope to real students: reassess recovery/availability risk, custody and
  retention responsibilities before real student onboarding. A paid service or
  backup purchase is not mandated by this procedure.

### Restoration gate: prevent historical accounts from reappearing

**Current default: no restoration of historical account-bearing datasets into a
serving production database.** There is no verified recovery dataset or complete
deletion-reconciliation record. This restriction is an operational release rule,
not an automatic enforcement feature or claim about Railway controls.

If an old backup/export is discovered or backups are introduced later:

1. Do not import it into the serving database. Restore only into an isolated,
   non-serving environment with no public/private application traffic, outbound
   email/AI jobs or scheduled writers. Restoration itself needs separate approval.
2. Establish complete deletion evidence covering the snapshot through restoration,
   including deletions with lost acknowledgements. A future deletion register must
   be outside the restored snapshot, access-controlled and able to distinguish
   account generations; never rely on reused IDs, JWT rotation or email alone.
   No such register has been implemented or retroactively assumed here.
3. Reconcile and remove deleted accounts and owned data, retain unrelated/shared
   data, then verify foreign keys, deleted-account absence and authentication
   rejection before separately approving any traffic. Old credentials/JWTs must
   not become usable as a side effect of recovery. Rotating a secret alone does
   not prevent password login to a resurrected account.
4. If complete reconciliation evidence cannot be established, **do not publish
   that restored dataset**. Keep it isolated; use an explicitly approved empty
   rebuild/new-account process instead. Never call that recovery of old accounts.

With no permitted historical restore, the documented workflow does not reintroduce
deleted accounts. It cannot prevent an operator bypassing the gate, recall copies,
or guarantee that external parties follow it. A successful restore drill is not
claimed and is not possible with the stated lack of a recoverable backup.

## Exact manual production checks (read-only)

An authorized operator should record service/environment, timestamp and
PASS/FAIL evidence for each item. Record booleans or redacted metadata only;
never paste variable exports, connection strings, JWTs or secret values into the
report. These checks do not authorize changing configuration or deploying code.

1. **Deployment/process:** verify the intended backend project/environment;
   confirm one configured replica, start command `node server.js`, one serving
   Node process, no cluster/process-manager HTTP workers or unexpected NODE_OPTIONS
   preloads. Inspect active/old deployments for overlap. Document acceptance of
   restart resets and independent counters during overlap, or require a shared
   store if strict persistent/global quotas are required. Identify the running
   version separately from the reviewed, still-local release candidate; do not
   claim local changes are deployed.
2. **HTTPS and frontend API:** inspect every used public/custom domain for a valid
   certificate and HTTPS. Use read-only HTTP GET/HEAD to check redirects and
   security headers. Confirm the built frontend's VITE_API_URL is the intended
   HTTPS backend, with no mixed content, and that deployed CSP connect-src permits
   that origin (a custom backend domain may need a separately approved CSP change).
   Never send credentials or a DELETE request over HTTP or during this check.
3. **Environment/CORS:** verify NODE_ENV=production. Inspect FRONTEND_URL and
   CORS_ALLOWED_ORIGINS for exact approved HTTPS frontend origins; exclude unused
   localhost/preview/untrusted origins. Use OPTIONS /api/account with Origin set
   to the approved frontend, Access-Control-Request-Method: DELETE and requested
   headers authorization,content-type. Expect the exact allowed origin, DELETE
   and those allowed headers. Repeat OPTIONS with an unapproved origin and verify
   it is not granted CORS access. OPTIONS is not account deletion and needs no JWT.
4. **JWT:** in the authorized dashboard/session, verify JWT_SECRET is present,
   cryptographically generated (at least 256 bits of entropy) and not a sample or
   reused development credential; report only compliance/presence. Verify signers
   and verifiers agree on issuer and distinct student/admin/reset audiences:
   defaults are learnmatch-api, learnmatch-web, learnmatch-admin and
   learnmatch-password-reset respectively. Overrides must remain distinct and
   match existing deployment intent. HS256 only; student/admin/reset expiration
   configuration remains 7 days/2 hours/10 minutes. Verify no token/secret logging.
   Do not log in or mint production credentials merely to complete this checklist.
5. **Authentication/headers:** a read-only GET /api/dashboard/status without
   Authorization should return 401 and Cache-Control: no-store, not student data.
   If already-authorized test sessions are available, inspect existing read-only
   student/admin requests to verify role/audience isolation and live-account
   checks. Do not create/delete accounts, reset passwords or deliberately exhaust
   production rate limits. Confirm Helmet/frontend security headers and absence
   of sensitive error output through ordinary read-only responses.
6. **Proxy and limiter intent:** leave TRUSTED_PROXY_CIDRS absent. No X-Real-IP
   trust switch or new Railway variable is required. Verify the release candidate
   contains account-based deletion protection and the 300/minute service budget;
   production flood testing is unnecessary. Existing login/OTP IP aggregation is
   a known separate availability limitation, not a deletion identity bypass.
7. **Database boundary/schema:** inspect private database connectivity and least
   privilege for the intended schema without printing credentials. Current client
   config does not enable MySQL TLS; if the DB path is public, verify supported
   transport protection before release rather than assume it. With existing
   authorized read-only DB access, check @@foreign_key_checks=1, the 17-table
   deletion scope, InnoDB engines and FK compatibility using schema metadata only.
   Do not read existing student rows or run deletion/migration statements.
8. **Operations/privacy:** designate the operator, confirm test-only scope and
   accepted irreversible-loss risk, record the known-copy inventory/limitations,
   confirm Privacy Notice 1.2 is the intended release wording, and acknowledge the
   no-historical-restore gate above. An absent backup must never be represented as
   an available recovery method.

## Consolidated outcome

The procedure and manual checklist resolve the remaining documentation work.
Production configuration and database integrity remain unverified because access
is unavailable, not because proxy CIDRs or a paid limiter are required. The owner
has accepted test-only no-backup risk; execution of the remaining manual checks
is still required and is not claimed by that acceptance.
Real-student operation remains outside the confirmed test-only scope.

No code changed, so no new QA was necessary. Reuse the completed full local QA
(776 passed) and subsequent targeted QA (31 passed). Those are separate historical
runs, not a newly executed 807-test suite. No new production guarantees follow
from them. Stop here; no next development phase is started.
