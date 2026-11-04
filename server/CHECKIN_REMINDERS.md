# Semester check-in reminders

## Production rollout status — November 4, 2026

The user explicitly approved the production migration, Railway backend/worker deployment, live-email activation, and Vercel frontend deployment. The following supersedes the earlier local-only notes below:

- Production migration applied successfully to the verified `railway` database. Existing counts remained 60 accounts, 68 college terms and 81 check-ins before/after the additive migration.
- Backend `precious-renewal` deployed successfully: `2d898450-a630-401f-bec4-1b78ba1cfb81`. Notification API returns 401 without authentication; production frontend CORS preflight returns 204 with the correct allowed origin.
- Created `checkin-reminders`, service ID `a525d92f-3639-4991-b7ff-2b6fe8832f3d`, instance ID `f0f03bd6-8780-4074-b64f-c8a12bce39cd`. Deployment `81ef536c-2b93-425e-aa9b-5c47c8fd33c3` succeeded. Root `/server`, start `node scripts/runCheckinReminders.mjs`, cron `0 * * * *`, restart policy `NEVER`.
- Worker uses references to the backend's existing DB and Resend variables, with `LEARNMATCH_PUBLIC_URL=https://www.learnmatch.online`. No secret values were printed or copied into source.
- First manually triggered Railway execution completed at 14:34 Manila time: `mode=dry-run considered=4 sent=0 failed=0 review=0 dryRun=4`.
- Vercel frontend deployed successfully to `https://www.learnmatch.online`, deployment `dpl_8neRcRE5qnJhngEGpyAxzAVVi7oF`. Public notification/check-in routes return 200; the served bundle includes the notification UI/API paths and the verified Railway backend URL, with no localhost API URL.
- **Live emails are enabled.** Worker redeployment `ad784cb9-a2fd-4c71-9686-9c5b29a02b09` succeeded with `CHECKIN_REMINDER_EMAIL_MODE=live`. First triggered live execution at 14:43 Manila time: `considered=4 sent=4 failed=0 review=0 dryRun=0`. Read-only verification found four persisted `sent` records with four total attempts. This confirms Resend acceptance, not individual inbox delivery.
- Hourly cron remains `0 * * * *` (at the top of each hour in Manila as well as UTC). Production sender is `noreply@learnmatch.online`; no new Resend account or sender change was needed. Existing user email preferences are honored.
- Initial Railway and Vercel releases were uploaded directly from the reviewed local workspace. The user subsequently authorized committing and pushing this implementation. Future GitHub-based deployments must retain these changes to preserve the deployed reminder functionality.

One explicitly authorized, labeled template test was received in the user's Gmail inbox before activation. Automatic production processing is now enabled, and its first live run was accepted by Resend. Historical local QA and the original activation procedure are recorded below; use the rollout status above for current infrastructure state.

## Workflow

- The existing College dashboard has a notification bell, persistent read state and an email preference. All endpoints use the existing user JWT middleware and scope data to its user ID.
- Only the latest term in an active tracking cycle is eligible. Only the next sequential incomplete Early/Mid/End check-in is reminded; earlier phases excluded by the initial tracking phase are skipped.
- Existing tracking defines phases, not separate deadlines. The reminder target is the first whole calendar day of each phase: term start for Early, the day after 33% of the term for Mid, and the day after 66% for End. The thresholds are shared with existing tracking. This does not change check-in availability or scoring. The UI calls this a **target date**.
- Only exact, student-confirmed or institution-calendar dates qualify. Estimated, manual, phase-only, missing, invalid or reversed dates produce no reminders. Term length is taken from its recorded start/end, never assumed to be six months.
- Asia/Manila determines the calendar day. Upcoming starts seven days before the target; due starts on the target; final overdue email starts seven days after it. Between target and final email, the in-app message already describes the check-in as overdue.
- A missed execution catches up only the currently applicable stage, never a burst of older stages. The final stage can catch up after day seven but sends only once. Completing a phase immediately removes its reminder from API results; completing the term stops all its reminders. Paused/ended cycles and superseded terms are excluded.
- Notification/email links open the existing check-in page, preserving the reminder through login. The server validates ownership, current term, target and phase before starting/resuming the existing check-in. Old/completed links show an explanation and a dashboard action.

## Migration and Railway configuration

1. Obtain explicit production approval before applying `migrations/20261104_add_checkin_reminders.sql`. Apply and test on a disposable/staging database first. It creates only `CHECKIN_REMINDER` and `CHECKIN_REMINDER_PREFERENCE`; it does not rewrite existing data. Cascading foreign keys preserve account-deletion behavior.
2. Deploy the backend and client through the normal approved process after migration. The reminder UI reports temporary unavailability if the migration is missing; existing college routes remain independent.
3. Create a separate Railway cron service using the same repository and `server` root directory. Start command: `npm run reminders`. Schedule: `0 * * * *` (hourly, UTC). Leave the web service start command unchanged. The worker closes the database pool and exits. There is no web-server timer or publicly callable email-trigger endpoint.
4. Set the cron service variables below. Reuse Railway variable references for the existing database and Resend configuration; never paste secrets into source files.

| Variable | Value/purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Existing MySQL connection settings, shared with backend |
| `CHECKIN_REMINDER_EMAIL_MODE` | `dry-run` by default; explicitly set `live` only after staging delivery verification |
| `LEARNMATCH_PUBLIC_URL` | Canonical HTTPS frontend origin, e.g. `https://your-learnmatch-domain` |
| `RESEND_API_KEY` | Existing Resend transactional email key, required only in live mode |
| `RESEND_FROM_EMAIL` | Sender on a verified Resend domain, required only in live mode |

Resend is already configured in the authentication code, so no new provider or dependency is introduced. The reminder integration uses the same credentials with separate dry-run gating, timeouts and idempotency. Existing OTP behavior is unchanged. The repository has no checked-in Railway deployment manifest; dashboard service settings must be verified during activation.

Railway cron schedules use UTC and jobs must exit: [Railway cron documentation](https://docs.railway.com/cron-jobs). Resend keeps idempotency keys for 24 hours: [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Delivery safety and operations

- Dry-run persists in-app reminders and reports aggregate eligible counts, but never contacts Resend or consumes delivery attempts. Do not run it against production without approval for those writes.
- `USER_ACCOUNT.is_active = 1` is the existing email-verification/active-account gate set by OTP verification. Missing/malformed addresses and opted-out accounts are skipped. Emails use the profile name with username fallback; no scores, assessments, passwords or authentication tokens are included.
- A unique key covers owner, term, phase, stage and target date. Changed schedules get a new target identity; old reminders remain audit records and are no longer pending. Read state is not reset by repeated runs. Already sent email cannot be recalled after a schedule edit.
- A MySQL advisory lock serializes concurrent workers. A durable claim is written before contacting Resend. Delivery locks serialize against check-in completion and tracking/account edits, with a final eligibility check before sending. An email already accepted by Resend before completion cannot be recalled.
- Each delivery keeps its exact payload and stable idempotency key. Failed/ambiguous attempts retry after at least five minutes, at most eight attempts, and only within 23 hours of the first attempt. Older ambiguous attempts move to `review`, never blind resend. Inspect provider records using `checkin-reminder-<reminder_id>` and `provider_id` before any manual correction. Do not reset claims or sent status without reconciliation.
- Provider acceptance is recorded as `sent`; this is not proof of inbox delivery. Check Resend delivery/bounce records during activation. Worker output contains aggregate counts only. Failed sends, review transitions and fatal failures return a nonzero exit code; monitor Railway run failures and inspect existing `review` rows regularly.
- Email preferences are available in the notification panel and linked from each email. Turning off emails leaves in-app reminders available. Preference writes are authenticated and accept booleans only.

## Local QA and remaining activation checks

Run from `server`: `npm run test:reminders`. Tests use synthetic users, a stateful database double and mocked HTTP email delivery. They cover Manila day boundaries, short/variable terms, all reminder stages, missing/invalid/estimated dates, sequential completion, schedule changes, opted-out/inactive/missing-email accounts, repeat runs, retry identity/expiry, read persistence, authenticated owner scoping and existing college timing/alignment smoke checks. No pre-existing tracked College regression suite was present.

Run from `client`: `npm run build` and targeted ESLint on the four changed client files. The panel uses a viewport-bounded mobile layout and an anchored desktop layout, semantic controls, Escape/outside dismissal and error/retry feedback.

Local automated checks passed. Additional MySQL integration QA is available in `tests/checkinReminders.mysql.mjs`. Run from `server` with the same environment file as the local backend, for example `node --env-file=C:\dev\learnmatch-docker.local.env tests/checkinReminders.mysql.mjs`. It rejects non-local database hosts and production mode, uses connection-local temporary tables with synthetic users, and mocks delivery. It does not modify real student records or send emails. The 22 checks passed on local Docker MySQL: HTTP preference/read persistence, owner isolation, opt-out suppression, dry-run, repeated-run deduplication, persisted delivery receipts, cross-connection advisory lock exclusion, retry payload/key identity, completion suppression and stale-link rejection. Temporary copies preserve actual reminder columns/indexes but omit foreign keys, so this suite does not verify FK cascades or recovery across a real process restart.

User screenshots also confirmed desktop notification rendering, receipt of the single labeled email test, and login redirect back to the notification URL. Automatic panel opening was not confirmed; the user opened it using the bell. Mobile browser QA remains unverified. Before production activation, use a disposable/staging database to interrupt a worker around provider acknowledgement, submit a check-in during processing, verify account deletion cascades and schedule edits, and verify navigation/read persistence/opt-out at mobile and desktop widths. Use only test accounts and mocked delivery for these checks.

Actual process-restart QA is now available in `tests/checkinReminders.restart.mjs`: `node --env-file=C:\dev\learnmatch-docker.local.env tests/checkinReminders.restart.mjs`. This opt-in local-only test creates a uniquely named `learnmatch_reminder_qa_<12 hex characters>` database with synthetic records and applies the real migration there. It retains the database for inspection and performs no destructive cleanup. No application/student rows are modified. Real provider credentials are blanked in child processes; delivery uses a loopback mock provider only.

The 16 restart assertions passed: the actual cron entrypoint runs in dry-run mode and exits, a separate worker process terminates immediately after mock-provider acceptance, its durable claim survives, a fresh process retries the same key and byte-identical payload, and only one mock delivery is accepted. A third process does not resend; completion also suppresses work in another fresh process. This test found MySQL JSON key reordering, so reminder payloads are now canonicalized before sending to preserve the same serialized request after restart. Successful run retained `learnmatch_reminder_qa_9a585308dca7`; earlier failed test runs may also have isolated QA databases retained. This local process test does not establish Railway scheduling or real Resend retry behavior.

Railway read-only inspection on November 4, 2026 confirmed project `humorous-gentleness` (`2f68950e-b267-4ace-8f96-ef0dd23f848c`) has only the `production` environment. Its services are `precious-renewal` (backend, `/server`, `node server.js`) and `MySQL`. Neither has a cron schedule. The backend's active deployment predates these local reminder changes. No staging environment or reminder worker is configured. Inspection required execution outside the sandbox to access the user's authenticated CLI session; no Railway settings were changed.

Proposed next step, requiring explicit authorization before creating or deploying Railway resources: an isolated `staging` environment with its own MySQL database and synthetic test data, a backend using the reviewed source, and a separate reminder worker using `npm run reminders`, hourly cron `0 * * * *`, and `CHECKIN_REMINDER_EMAIL_MODE=dry-run`. Do not connect staging to production MySQL or duplicate real student data. Verify environment variable references before the first run. Configure a staging frontend origin for end-to-end navigation before any controlled live-email test. Keep production services unchanged. Additional staging resources may incur Railway usage charges; no new services, migrations or deployments have been authorized by the login/inspection step alone.

The received template test used local dashboard links and bypassed the scheduled worker; it does not prove scheduled delivery or the production check-in deep link. Verify that end-to-end flow with a controlled staging account before activation. Production activation requires explicit migration approval, approved deployment, Railway cron setup, a canonical HTTPS `LEARNMATCH_PUBLIC_URL`, and an explicit switch to `live` after verification. Production email delivery is **not verified**.
