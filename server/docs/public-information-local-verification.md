# Public information and registration agreement

Local review: 25 October 2026 (Asia/Singapore). No production access, migration,
deployment, commits, pushes, paid service, dependency installation, or changes to
existing student records.

## Completed behavior

- Public `/about`, `/help`, `/terms`, and `/privacy` share one information-page
  layout, navigation, brand and footer. Help uses native keyboard-accessible
  disclosure elements. Support is a mailto link to learnmatch1@gmail.com.
- Landing footer uses the existing warm background, orange borders/gradient,
  wordmark and typography, with Explore, Legal and Support groups. Its How It
  Works link targets the existing journey section, now given an anchor ID.
- Registration requires an initially unchecked agreement. Frontend and API both
  enforce it; the API requires boolean true and exact current document versions.
  Both document links open in the same tab while the form remains mounted.
  Related information-page links preserve the form, and the return button restores
  focus to the original document link. Passwords are not newly persisted to storage.
- Terms 1.0 and Privacy Notice 1.3 use shared version constants. New account insertion
  stores `terms_version`, `terms_accepted_at` (database UTC time), and
  `privacy_notice_version` in the same INSERT. Client timestamps are ignored.
  The acknowledgment time is the same registration agreement event. OTP, recovery,
  existing login, and optional Personal Factors remain separate.

## Privacy source and relocation

The latest implemented notice was **1.2**, reviewed 24 October, superseding the older
1.0/1.1 references. It was preserved and revised to **1.3**, dated 25 October.

Project background now lives in About. Step-by-step account deletion instructions
live in Help. Privacy retains the complete deletion scope and copy limitations,
unknown-outcome guidance, historical/retired fields, optional sensitive factors,
browser/server drafts, administrator access, aggregate research, WSM/AI payloads,
Resend, OpenAI, OpenRouteService and OpenStreetMap disclosures, rights and contact.
It adds agreement-record collection and an explicit unfinalized general retention
schedule. No 12-month deletion or 30-day warning is presented as operational.

Deletion is implemented and previously tested locally. Production availability and
configuration remain unverified in the existing deletion operations/readiness
documents. All new deletion copy states that distinction and provides support as
the alternative. This task did not access production to verify it.

## Migration and local safety

`server/migrations/20261025_add_registration_agreement.sql` adds three nullable
columns to USER_ACCOUNT. It has no UPDATE, backfill, new foreign key, or new table.
Existing accounts keep NULL acceptance values; login does not require invented
historical acceptance. Account deletion removes the acceptance columns with the
account row through the existing deletion implementation.

The migration was initially tested in a random disposable localhost MySQL schema.
The integration helper clones empty table definitions, copies no existing student
records, checks source table counts before/after, checks foreign-key integrity,
and removes the disposable schema. On 25 October, after a manual registration
reported an unknown `terms_version` column, the same migration was applied to the
verified localhost development database. All three nullable columns were verified;
existing account counts were unchanged and no acceptance values were backfilled.
Do not rerun the one-time SQL on that database. Any later production application needs separate
authorization and owner review; none is performed here.

## QA

- Backend focused suite: 40 passing results, including six registration-agreement
  integration results, OTP protection, password reset, student/admin login and
  email limits, username validation and shared deployment packaging.
- Integration exercises actual loopback HTTP routes and MySQL: rejected missing,
  false, string/numeric and stale agreement values; NULL legacy acceptance;
  accepted versions and server time; bcrypt; wrong/correct OTP; new and legacy
  login; email-failure cleanup; source-data count preservation and FK integrity.
  Email delivery is intercepted; no real verification email is sent.
- Frontend focused suites: 18 unique passing results across PrivacyTransparency,
  PublicHeader, UXValidation, formValidation and userAuth. Repeated results are
  counted once.
- Six Edge/Playwright cases cover direct public routes and refresh, footer links
  and hash scrolling, agreement validation/request payload, same-tab form and
  focus preservation across documents, resend/error UI, native FAQ keyboard
  operation, Settings navigation, and 360/768/1440px layouts.
  Browser API responses are synthetic; real API/DB behavior is covered separately
  by the integration test. Local production-build preview is used for browser QA.
- Mobile and desktop footer/Help/registration screenshots are generated in
  `.local-backups/public-test-results` for visual review. Reduced motion is used
  for screenshots so the unchanged landing intro does not obscure the page.
- Changed frontend modules pass ESLint; production build and whitespace checks
  pass. Existing Vite shared-module-format/chunk-size warnings remain. An existing
  SSR test HMR port warning did not fail its checks.
- The initial browser run collided with concurrent SSR dependency optimization;
  preview avoids that cache conflict. Registration checks use keyboard submission
  after resend to avoid the existing hover-lift stability loop, and target the
  inline OTP error because the existing UI repeats it in an alert banner.
- Existing deletion, assessment, matching and admin QA documented in the repository
  is reused for unchanged functionality; no unrelated full regression was run.

Reproduce from `server`: `node --test tests/registrationAgreement.integration.test.js`.
From `client`: `npm run build`, then
`npx playwright test --config playwright.public.config.js`.
On this Windows runner, a separately running local preview on port 5181 allows
Playwright to reuse it and avoids slow owned-server shutdown.

## Owner review before publication

Terms 1.0 visibly flags its substantive review items: student/minor eligibility,
institutional responsibility, content permissions, access restrictions and
termination, service limitations, and material-change communication/renewed
agreement. No court, governing law, waiver, institutional affiliation, legal
approval, research accuracy claim, or service guarantee was invented.

Existing privacy follow-ups remain: controller identity, justified retention and
rights procedures, provider arrangements, and live deletion/configuration checks.
This local implementation does not resolve or certify those matters.

## Subsequent local refinements

- Removed the footer capstone tagline and bottom email link at the owner's request.
  The Help Center and footer Contact Support navigation remain available.
- Registration document titles are clickable within the agreement label. Its brief
  description now reads: "Terms explain usage rules; Privacy explains how your data
  is handled." Detailed optional-data disclosures remain in the documents.
- Successful OTP verification shows a check mark and "Account successfully created!"
  for 1.2 seconds before saving the verified session and navigating to the dashboard.
  Saving auth occurs after the confirmation because the student session boundary
  remounts the application on auth changes. A new Edge case verifies the visible
  success state, delayed navigation and final stored session. It passed; existing
  registration agreement/error behavior also passed. Build and changed-file lint pass.
- Delete Account's current-password field now has a keyboard-accessible eye toggle,
  hidden by default and reset when closing the dialog or finishing a request.
  Local Edge checks passed for show/hide, keyboard toggling, preserved input value,
  and an empty, hidden field on reopening. These checks made no account writes.

## Files changed

- client/src/App.jsx
- client/src/index.css
- client/src/components/PublicInformationLayout.jsx (new)
- client/src/components/PublicFooter.jsx
- client/src/components/PrivacyNoticeLink.jsx
- client/src/pages/About.jsx (new)
- client/src/pages/Help.jsx (new)
- client/src/pages/Terms.jsx (new)
- client/src/pages/PrivacyNotice.jsx
- client/src/pages/Landing.jsx
- client/src/pages/Register.jsx
- client/src/pages/StudentSettings.jsx
- client/src/pages/PrivacyTransparency.test.js
- client/src/pages/PublicInformation.browser.spec.js (new)
- client/playwright.public.config.js (new)
- server/controllers/authController.js
- server/shared/legalDocuments.js (new)
- shared/legalDocuments.js (new frontend re-export)
- server/migrations/20261025_add_registration_agreement.sql (new)
- server/tests/registrationAgreement.integration.test.js (new)
- server/docs/public-information-local-verification.md (this file)
