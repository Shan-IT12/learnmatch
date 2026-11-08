# LearnMatch final authenticated QA - 8 November 2026

**Readiness: PASS for local release-candidate review. Deployment remains on hold for review.** No unresolved application failure was reproduced after the fix below. No commit, push, deployment, DNS change, production data write, or real email send occurred.

## Results

| Area | Status | Evidence |
| --- | --- | --- |
| Student registration and login | PASS | Real local backend and MySQL: registration, captured verification message, invalid OTP rejection, activation, wrong-password rejection, login, session restoration and successful-login activity tracking. Browser registration/OTP/login also passed. |
| Assessments | PASS | All five Personal Factors; owned attempt/draft recovery; 30 Academic Skills answers with expected persisted score and duplicate-finalization rejection; 40 Personality answers and completed attempt. Full browser form flow passed, including immediate submission after the last answer. |
| WSM recommendations and AI assistance | PASS | Three unique saved recommendations, stable scores/ranks across reloads, existing cluster-weight calculations checked against stored results, including no-interest weight normalization. Controlled AI success and provider-failure paths preserve scores/ranks; identity and detailed Personal Factors are absent from captured explanation inputs. Actual external AI generation was not called. |
| Saved results and privacy | PASS | Latest results, assessment history/detail, browser reload, ownership checks, anonymous rejection, admin/student JWT audience separation and private noindex/canonical cleanup. |
| School Locator | PASS | Actual public course/verified offering APIs and browser navigation; map route loads without runtime errors. Results correctly disable the school action for courses without verified local offerings; a verified course was used to test the available route. |
| College Phase | PASS | Setup with confirmed dates, active status, pending check-in, computed alignment, saved result/history, ownership protection and pause/resume. Authenticated College dashboard and Settings render in the browser. |
| Notifications | PASS | In-app reminder generation, read state, preferences, ownership rejection and opening a pending check-in. Browser notification panel renders. Worker delivery was captured locally for synthetic recipients; repeated runs send no duplicate. |
| Admin course management | PASS | Actual admin login, course list/detail, inactive draft creation, duplicate-name rejection, edit/readback, draft activation rejection, incomplete publication rejection, legacy deactivate/reactivate and student-token rejection. Browser login, course-management route and Add Draft editor load without runtime errors. |
| MySQL deletion integration | PASS | Formerly skipped test executed in a new dedicated schema. Full server suite: **30 passed, 0 failed, 0 skipped**, including linked cleanup, signed receipts, concurrency, rollback recovery, password protection and ambiguous-COMMIT kill switch. |
| Final build, lint and artifact tests | PASS | Production-mode frontend build with the verified production backend origin; ESLint; **4 client tests passed**. Existing Vite future-native-config warning only. |
| Public accessibility/regression | PASS | Final production build: seven public views at desktop and 390px mobile; no axe WCAG A/AA or best-practice violations in tested views. Keyboard skip focus, footer destinations/fragments, no-JavaScript public HTML and overflow checks pass. |
| Changes/security review | PASS | All **39 original routes** retained. No server, shared scoring, assessment question content, prompts, migrations or package-lock changes. No dependencies added. Configured server secrets are absent from generated JS/CSS. QA scripts, mail captures and synthetic tokens remain ignored and excluded from deployment. `git diff --check` passes. |

The custom API suite has 10 passing workflow groups; authenticated browser QA has seven passing workflow groups plus a clean runtime/API-error check. Four additional service checks and two admin lifecycle/publication checks pass. These are distinct from the 34 Node tests above.

## Confirmed bug fixed during QA

The browser reproduced a pre-existing race: pressing View Results immediately after answering Personality question 40 could POST before the 250 ms draft autosave. The server then correctly rejected the incomplete saved draft. Academic Skills had the same unflushed-draft pattern and could allow a late autosave after finalization.

The two client submission handlers now await the existing serialized draft-save queue with the complete answer snapshot before POSTing. Debounced autosaves pause during submission and after a result is displayed. This preserves server validation, scoring, saved-result semantics and existing screens. The same full browser flow that exposed the failure passes after this change, without slowing down the final answer to hide the race.

## Production configuration - authorized reads only

Existing Railway credentials work outside the restricted sandbox. Vercel's cached official CLI refreshed its existing session; no access permissions were expanded. Read-only inspections verified:

- **Vercel:** correct LearnMatch project, `client` root, Vite framework, Node 24.x, default build/install/output settings with no custom build-command override, READY current production target, and production/preview `VITE_API_URL` configuration. The deployed public JS contains the expected Railway backend origin. No sensitive environment value was printed or written into the report.
- **Railway:** web service and both hourly UTC workers have successful deployments. Web starts `node server.js`; inactivity starts `npm run inactivity`; check-in reminders start `node scripts/runCheckinReminders.mjs`. Both workers resolve to the same database as the web service. Reminder email mode is live; web inactivity email mode is dry-run; dedicated inactivity warning mail mode is live.
- **Automatic deletion stays disabled:** dedicated worker `INACTIVITY_DELETION_MODE=disabled`, `INACTIVITY_DELIVERY_EVIDENCE_READY=false`, no configured approval. Web deletion settings use disabled defaults. A production MySQL read-only transaction confirmed `deletion_enabled=0`, no policy approval/expiry, zero per-account clearances and zero system-deletion audit rows. Missing signed webhook configuration remains consistent with evidence readiness being false. No deletion setting was enabled.
- **Backend HTTP/security:** public catalog statistics return 200; anonymous account/session access returns 401 with `Cache-Control: no-store`; expected frontend Origin receives the matching CORS header and an unrelated Origin receives none. HTTPS/HSTS are present.
- **Schema parity:** dedicated authenticated QA schema and production have identical column names, column types and nullability, with no local-only or production-only columns. Production tables use InnoDB. Schema inspection retrieved metadata, not student records.

## Isolation and retained evidence

Two fresh local schemas were created on loopback MySQL 8.0.46:

- `learnmatch_inactivity_qa_1794140656850` for the destructive integration suite.
- `learnmatch_release_qa_1794140656850` for authenticated application QA.

Only structure and catalog/question data were copied. No student accounts, assessment answers, feedback, credentials or personal histories were copied from another database. Accounts, admin credentials, answers and mail recipients were synthetic. Production was accessed only with read-only configuration requests, public HTTP requests and a database read-only transaction. Test-only delivery adapters captured mail locally; they were never added to application source or production settings. The application QA backend is stopped after testing; schemas are retained for review, with deletion switches off.

Detailed scripts and sanitized reports are retained in ignored `.local-backups/release-qa-20261108/`, including `authenticated-results.json`, `browser-results.json`, `service-results.json`, `admin-extra-results.json`, final build/server/public-accessibility logs, production configuration checks, schema comparison and secret-scan results. Browser fixtures and outbox files contain synthetic test tokens/OTPs; keep that directory ignored.

## SKIPPED and remaining release conditions

- **SKIPPED:** real Resend delivery/inbox authentication, real paid AI generation, live GPS/directions and a fresh positive source-review/publication workflow. Captured transport/provider adapters verify application behavior, not external provider quality or delivery. Existing source, mapping and notification rules were preserved; no source review was fabricated to force publication.
- **SKIPPED by instruction:** production registration/login/assessment submissions and CRUD. Successful login itself writes activity data, so authenticated production mutations would violate the requested read-only production inspection. Equivalent flows ran against the real backend in isolated local MySQL instead.
- **Release condition:** review the pending changes, then separately authorize a preview/deployment smoke check of Vercel's new prerender rewrites, crawl-file content types, metadata, CSP and client takeover. Those pending hosting changes cannot be verified on the currently deployed older frontend without deploying them. No deployment was attempted.
- Existing DNS review items from the [initial audit verification](audit-2026-11-08.md) remain unchanged. They are not new application test failures. No DNS writes were made.

No remaining local code blocker is known. This report supersedes the initial audit report's production-access and skipped-MySQL limitations.

## Final human-review checkpoint

**GO for human review; NO-GO for push/release until explicit approval.** All 23 pending files were reviewed, including the 10 new files that ordinary `git diff` omits. The set contains application/build changes, the WebP derivative, four artifact tests and two review documents. No accidental QA scripts, captures, credentials, backups, dependency additions or lockfile changes were found. The original PNG remains an editable source asset; it is not emitted in the new production build. All 39 original routes remain present.

The assessment autosave change was reviewed against the existing serialized save queue: final answers wait for earlier writes and the complete draft save before submission; a failed save prevents the final POST; debounced timers stop during submission and after results. Scoring, questions and server validation remain unchanged. Its immediate-submit regression passed in the authenticated browser run. That browser harness is retained locally in the ignored evidence directory; the checked-in client test command covers build artifacts, not the entire authenticated workflow.

Fresh confirmation: production-mode build, lint, four client tests and 30 server tests all passed; no Node tests were skipped. Configured server-secret values and common credential patterns were absent from all pending text files and built frontend JS. Production read-only checks reconfirmed worker deletion disabled, evidence readiness false, database deletion switch off, no policy approval and no per-account clearances. No settings were changed.

### What a push to main would do

| Target | Current configuration | Expected effect of pushing main |
| --- | --- | --- |
| Vercel frontend | GitHub `Shan-IT12/learnmatch`, production branch `main`, `gitProviderOptions.createDeployments=enabled`, automatic production-domain assignment enabled. Pending configuration does not disable Git deployments. | Automatically build a production deployment; a successful eligible build can become live on the production domains. |
| Railway web (`precious-renewal`) | Auto-deploy status **enabled**; GitHub repository trigger explicitly targets `main` in production. Root `/server`, empty watch-path list, `checkSuites=false` (no wait for CI). | Automatically redeploy the web service, including for this client/docs change set because no watch-path filter is configured. |
| Railway inactivity/reminder workers | Auto-deploy **disabled**, reason `NO_REPO`; no Git repository triggers. | No Git-triggered redeployment. Existing hourly schedules continue running their current deployed code. |
| Railway MySQL | Image-based service; no repository trigger. | No Git-triggered redeployment. |

These results come from current authorized Vercel project API reads and Railway's `serviceInstanceAutoDeployStatus`, `serviceInstance` and repository-trigger queries, not merely from historical deployment metadata. Provider behavior is documented in [Vercel Git deployments](https://vercel.com/docs/git) and [Railway GitHub autodeploys](https://github.com/railwayapp/docs/blob/main/content/docs/deployments/github-autodeploys.md). Normal webhook delivery, repository permissions and successful builds still apply. No test push or configuration change was made.

**A push to main must be approved as a production deployment action.** A local commit can be reviewed without triggering these services; no commit has been created. The existing release conditions and externally skipped checks above remain visible for approval.

Proposed commit subject:

```text
fix: improve public SEO, accessibility, and assessment autosave
```

Human-review receipts, file hashes, secret-scan results and deployment-trigger settings are retained in ignored `.local-backups/human-review-20261108/`. No source code changed during this final review.
