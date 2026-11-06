# Account inactivity operations

Automatic deletion is deliberately absent from this job. `inactivity_eligible_at`
is a review signal, not authorization to delete. Self-service password-confirmed
deletion continues through `deleteStudentAccount`; the email ledger cascades on
account removal. No password check has been bypassed or weakened.

## Production status

Stage 1 completed on 7 November 2026: the production backup was restore-verified,
the migration was applied once, and the backend and frontend were deployed.
Existing account records were preserved and received a rollout-time UTC tracking
baseline. Privacy Notice v1.6 is public at <https://www.learnmatch.online/privacy>.

`LEARNMATCH_PUBLIC_URL=https://www.learnmatch.online` and
`INACTIVITY_EMAIL_MODE=dry-run` are configured on the web service. Production
authentication, login cancellation, settings, secure deletion, and a manual
inactivity dry run passed without sending emails. Local regression tests and
MySQL integration checks also passed. No inactivity scheduler is active.

Private backup and verification evidence remain in ignored
`.local-backups/inactivity-production/`; local backup evidence is in
`.local-backups/inactivity/`. Keep these out of Git and deployment archives.

Before Stage 2, review the existing `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
proxy/rate-limit warning, verify the actual ingress boundary, and approve provider
sandbox testing, sender/idempotency/bounce checks, and job alerts. Live warning
emails and activation of the hourly scheduler require separate approval. Do not
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
   config file `/server/railway.inactivity.json`, using the same DB and email
   variables. The supplied config runs `npm run inactivity` hourly in UTC with
   bounded failure retries. Only attach this config to the dedicated job service.
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

## Before any future automatic deletion implementation

- Obtain verified retention policy and deletion scope, including legal holds,
  backups, exports, external providers, administrator exclusions, and evidence of
  delivered notices. Verify migration against a production-equivalent schema.
- Exercise delivery retries, process crashes, scheduler overlap, and concurrent
  login/deletion against real MySQL and the mail sandbox; check cascade integrity.
- Review the existing secure deletion service's child-table inventory and
  ownership checks. Extract its transactional cleanup for a separately authorized
  system workflow, keeping self-service password verification mandatory. Recheck
  eligibility, generation, login timestamp, and holds under the account row lock.
- Add explicit production enablement, bounded batches, audit/alerts, a kill switch,
  and a staged reviewed rollout. Do not call self-service deletion with fabricated
  credentials, or delete directly from USER_ACCOUNT.

There is no environment flag that can enable automatic deletion in this release.

## Validation

Run `npm test` from `server` for inactivity and authentication regression tests.
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
