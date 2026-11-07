# Account inactivity operations

System deletion is implemented separately from password-confirmed self-service
deletion, but production execution remains disabled. `inactivity_eligible_at` is
a review signal, never sufficient authorization to delete. The system workflow
requires current policy approval, account clearance, and signed delivery evidence.

## Production status

Stage 1 completed on 7 November 2026: the production backup was restore-verified,
the migration was applied once, and the backend and frontend were deployed.
Existing account records were preserved and received a rollout-time UTC tracking
baseline. Privacy Notice v1.6 is public at <https://www.learnmatch.online/privacy>.

`LEARNMATCH_PUBLIC_URL=https://www.learnmatch.online` and
`INACTIVITY_EMAIL_MODE=dry-run` are configured on the web service. Production
authentication, login cancellation, settings, secure deletion, and a manual
inactivity dry run passed without sending emails. Local regression tests and
MySQL integration checks also passed. The dedicated `account-inactivity` Railway
service has approved live email mode, using the web service's database and email
variable references. It runs `npm run inactivity` from `/server` hourly in UTC
(`0 * * * *`). A scheduled dry run completed on 7 November 2026 at 15:35:59 UTC
with zero failures and an exited container. Its temporary five-minute test
schedule was restored to hourly execution.

Controlled Stage 2 sends used only Resend's labeled `delivered@resend.dev` and
`bounced@resend.dev` test recipients with session-local MySQL fixtures. The
operator confirmed both notices delivered and the bounce event. The lost-receipt
retry returned the same provider ID. Duplicate prevention, grace periods, login
cancellation, overlap locking, retry exhaustion, sanitized failure logging, and
targeted regression tests passed. The operator confirmed Railway failure
notifications are enabled. Structured worker logs and nonzero failure exits are
available. Live mode is enabled only on the dedicated worker; the web service
remains in dry-run mode. The existing sending-only Resend key is preserved.

The additive `20261107_add_inactivity_deletion_safeguards.sql` migration adds
disabled global approval, per-generation clearances, signed delivery evidence,
and a pseudonymous deletion audit. It does not modify existing account data.
Production has `INACTIVITY_DELETION_MODE=disabled`,
`INACTIVITY_DELIVERY_EVIDENCE_READY=false`, and the database deletion switch off.
No retention policy has been formally approved. The operator deferred production
Resend webhook setup, so provider acceptance cannot authorize system deletion.
The deployed worker completed a scheduled live-mode run at 16:10:53 UTC on
7 November 2026: no candidates, sends, failures, or deletions; deletion reported
disabled and the container exited. Its temporary five-minute verification
schedule was restored to hourly. The consolidated targeted QA passed 25 tests,
including isolated real-MySQL cleanup, both login/deletion lock orderings,
webhook verification/replays, post-selection holds, rollback recovery, and a
lost-COMMIT acknowledgement that triggers the database kill switch. No production
accounts were used for destructive tests.

Private backup and verification evidence remain in ignored
`.local-backups/inactivity-production/`; local backup evidence is in
`.local-backups/inactivity/`. Keep these out of Git and deployment archives.

The existing `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warning reflects deliberately
untrusted forwarded headers. Spoofed forwarding headers did not bypass the IP
limiter in targeted testing; proxy clients may share a quota. No proxy trust was
enabled. A verified ingress trust boundary is still required before changing
this configuration. Live warning emails have explicit approval. Do not
globally trust forwarded headers or silence validation without a security review.

## Setup for another environment

1. Review and apply `migrations/20261107_add_account_inactivity.sql` once to the
   intended database **before** deploying the application. Check InnoDB and
   foreign-key enforcement. Existing accounts receive rollout time as their
   observation baseline, not an invented historical login. Newly registered
   accounts receive a server-generated baseline; initial OTP authentication also
   records a successful login. Unverified accounts are excluded.
2. Deploy the application. Run `npm run inactivity` from `server` with
   `INACTIVITY_EMAIL_MODE=dry-run` (the default). Dry run reports candidates and
   does not change accounts or email delivery state.
3. Verify the public Privacy Notice, Resend sender, and HTTPS
   `LEARNMATCH_PUBLIC_URL`, then set `INACTIVITY_EMAIL_MODE=live` with the existing
   `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to enable warnings only.
4. Configure a dedicated Railway cron service with root directory `/server` and
   settings from `/server/railway.inactivity.json`, using the same DB and email
   variables. Railway rejected attaching the legacy JSON config as deprecated,
   so its settings were imported through the service API. Railway enforces a
   `NEVER` restart policy for cron services despite the JSON's `ON_FAILURE`
   setting; failed email work is retried on subsequent hourly runs under the
   ledger's retry limits. Only apply these settings to the dedicated job service.
   It follows [Railway's config reference](https://docs.railway.com/config-as-code/reference)
   and [cron lifecycle](https://docs.railway.com/cron-jobs). Do not use browser timers
   or web-process intervals. Enable failed-run alerts and monitor structured job
   output, last successful execution, and `review` counts. Retry failed runs;
   MySQL GET_LOCK serializes overlapping scheduler invocations across replicas.
   The process exits after closing its connection pool.

The 365-day threshold uses only successful interactive authentication. Session
validation, password recovery, and background API calls never update it. Warning
acceptance starts 30 days; final acceptance guarantees at least another seven
days. Delayed jobs cannot shorten these periods. Login atomically increments the
generation and clears all pending state, invalidating old email work. Account row
locks serialize login, delivery, eligibility, and existing deletion operations.

An immutable payload, unique `(user_id, generation, stage)` ledger entry, and
Resend idempotency key allow retry after crashes or ambiguous responses. Retries
wait five minutes, stop after eight attempts or 23 hours from first attempt, and
then require operator review instead of risking a duplicate outside the provider
deduplication window. Investigate provider receipts before resolving review rows;
never blindly reset their retry identity. Confirm provider idempotency behavior
and duration before live rollout. Provider acceptance is not proof of inbox
delivery; bounced/undeliverable notices need review before any future deletion.

## System deletion activation gates

Do not enable deletion until the policy owner approves retention, active-database
scope, backup recovery/retention, exports, provider-held data, exclusions, legal
holds, audit retention, and revised Privacy Notice/notice content. Do not invent
retention periods. Obtain explicit final production authorization separately.

- Configure `/api/webhooks/resend/inactivity` on the backend for Resend's
  `email.delivered`, `email.bounced`, `email.failed`, `email.complained`,
  `email.suppressed`, and `email.delivery_delayed` events. Set its signing secret
  as `RESEND_INACTIVITY_WEBHOOK_SECRET` on the web service. The endpoint rejects
  unverified requests and requests retries when provider receipt persistence lags.
  Verify the real signed delivery pipeline before marking evidence ready.
- `ACCOUNT_INACTIVITY_CONTROL` must contain an enabled, unexpired approval with
  policy/scope versions, approval and backup-review references, and the reviewed
  FK scope digest from `studentDeletionScope`. Changed scope or nontransactional
  cleanup dependencies block deletion. Approval references must not contain PII.
- Every account needs a current `ACCOUNT_INACTIVITY_CLEARANCE` for its exact
  generation: verified student, excluded=false, legal_hold=false,
  retention_hold=false, matching versions, review reference, and future expiry.
  No row or an unknown hold means no deletion. Matching ADMIN usernames are also
  excluded. Policy owners must identify administrator-linked student accounts.
- Required notice payloads must carry the approved `inactivity_policy` and
  `inactivity_scope` tags, configured through `INACTIVITY_NOTICE_POLICY_VERSION`
  and `INACTIVITY_NOTICE_SCOPE_VERSION` (letters, digits, underscores, hyphens).
  Older unversioned notices do not qualify. Both notices need signed delivery
  records; any failure, bounce, suppression, complaint or delay blocks deletion.
  The system also waits 30 days from initial delivery and seven from final
  delivery, so delayed delivery cannot shorten notice periods.
- Final enablement requires worker `INACTIVITY_DELETION_MODE=enabled`,
  `INACTIVITY_DELIVERY_EVIDENCE_READY=true`, `INACTIVITY_DELETION_APPROVAL` matching
  the database approval, and a secret `INACTIVITY_AUDIT_KEY` of at least 32 bytes.
  Batch size defaults to 10 and is bounded to 1–100 accounts per run.

The database kill switch is `ACCOUNT_INACTIVITY_CONTROL.deletion_enabled=0`;
it gates every account and takes effect after any already-authorized transaction.
Setting worker `INACTIVITY_DELETION_MODE=disabled` stops deletion on subsequent
invocations. An ambiguous COMMIT destroys its connection, stops the run, and
attempts to turn off the database switch for operator review. Never blindly
retry an unknown outcome. Success receipts are atomic with cleanup and contain
an HMAC account token, policy/review references, and evidence digest, not raw
account IDs, addresses, names, or email bodies. Their retention still needs approval.

## Validation

Run `npm test` from `server` for inactivity and authentication regression tests.
New system-deletion, signature, and real-MySQL tests are in `server/test`.
Real-MySQL tests require `INACTIVITY_TEST_SCHEMA=learnmatch_inactivity_qa_<digits>`
on loopback MySQL with the production schema and new migration. They reset only
that isolated, controlled fixture schema; never point them at a user-data copy.
Run `npm run build` from `client` to verify frontend integration. For a configured
database, `npm run inactivity` defaults to dry-run and reports aggregate counts.

Before migrating another database, verify its identity, InnoDB engines, enforced
foreign keys, and column compatibility, and restore-verify a complete backup.
Apply the SQL only when every migration component is absent. Validate an existing
migration without reapplying it; stop for review if it is partial. Confirm the
account columns, activity index, unique delivery key, cascading FK, UTC baselines,
and preservation of existing records.

Use only an isolated database and a loopback mail sink or explicitly approved
provider sandbox for delivery, retry, overlap, and deletion tests. Keep backups
private and subject to approved backup retention.
