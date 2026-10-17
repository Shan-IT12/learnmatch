# New draft publication

Implemented October 17, 2026. No migration or real-data write was performed.

Implementation-time statement above is historical. The publication migration was
subsequently applied and verified on the local database only; see
[local verification results](course-publication-local-verification.md). No production
migration or data change was performed.

## Local API troubleshooting

If Review & Publish reports HTML instead of JSON, inspect the request before changing
proxy settings. On October 17, 2026 the served UI correctly requested
`GET http://localhost:5000/api/admin/courses/1464/publication`, but the running Node
process predated the publication route. It returned 404 `text/html`, no redirects,
and an Express `Cannot GET` document. The route was already mounted correctly in
`server.js`; restarting only that stale local backend fixed it. The authenticated
request then returned 200 `application/json` with the current publication blockers.

Vite has no API proxy here. Port 5173 returns the SPA HTML fallback for `/api/...`;
it is not the publication API. Keep `VITE_API_URL` pointed at the intended backend.
Restart the local backend after adding server routes when running plain `node server.js`.
The publication panel now reports method, endpoint, status, content type and redirect
destination for non-JSON responses without displaying returned HTML or URL secrets.
This troubleshooting did not publish, edit or delete the draft; hashes for 12 affected
course/review/recommendation/College tables matched before and after the GET checks.

## Review and publication

Save the new draft, complete manual source confirmations, then use **Review & Publish**.
The review panel shows the saved details, year roadmap, profiles, evidence, source
confirmations, field-level blockers, and matching-review history. A separate checkbox
and action records matching-profile review; another explicit checkbox/action publishes.
These record an authenticated administrator's review, not expert validation.

Publication requires a name, abbreviation, description, obtainable skills, an eligible
stable CRS code, existing LearnMatch cluster, supported 1–5-year duration and consecutive
year labels with nonempty overviews. Selected skills retain weights 1–3; all six RIASEC
dimensions retain weights 0–3. Every assigned weight needs nonempty evidence, including
the basis for a zero. Existing draft/profile validation is reused; weights are never
generated or copied. Program Type and PSCED remain optional and unchanged.

One to three active sources must each have a current manual confirmation. Together their
supported-information selections must cover name, description, obtainable skills,
duration and matching-profile evidence. This coverage is an admin attestation, not a
claim that software assessed the truth of the evidence. Automated checks are optional;
Needs Review, scanned PDFs and failed checks do not block manual confirmation. Manual
confirmation does not change the automated result or approve matching weights.
Source URLs must now match the explicitly maintained approved publisher hosts for
saving, checking, confirming and publication. Empty configuration fails closed. An
approved-host scanned PDF may still be manually reviewed; an unapproved origin or
known unapproved redirect may not bypass this restriction through manual confirmation.
Saved new drafts also enforce the three-link cap when appending sources. An older
draft with more than three saved sources must remove optional sources before it can
publish. Removal retains history; no existing sources are deleted automatically.

Source review tokens remain unchanged. Matching review snapshots include saved course
facts, profiles, cluster, stable code and monotonically increasing field revisions:
relevant edits (including change/revert) require another matching review. Publication
tokens additionally bind saved sources and current source/matching-review identities.
Source changes or new confirmations require reloading publication review. Unsaved
course edits disable review actions; the server always checks the saved revision.
All mutations share the COURSE row lock with existing draft/source saves. Audit insertion
and setting `is_draft = 0, is_active = 1` occur in one transaction. The publication table's
course primary key prevents repeat publication; duplicate/stale requests return 409.
Errors return `fieldErrors` with 422 for incomplete publication requirements.

## Student paths and preservation

- Search/details supplement the bundled canonical catalog with active, explicitly
  published database records. Bundled names, skills, careers, roadmaps and identity
  redirects remain authoritative for existing canonical codes. No enrichment is
  invented for newly published courses; unavailable careers are empty arrays.
- WSM still uses database candidates, current identity/cluster eligibility and the same
  formulas, weights, cluster inheritance and profile validation. Explicit draft exclusion
  is added to candidate/profile queries. Historical snapshots are untouched; adding an
  eligible candidate can legitimately change a future ranking/top three.
- College search returns saved duration for published new courses. Setup, Change Program
  and next-term progression fall back to published database roadmaps when no canonical
  roadmap exists. Existing term/cycle/check-in records are not rewritten.
- Numeric course IDs remain distinct from stable `CRS` codes. The allocator already
  supports 3–7 digits within VARCHAR(10); School Locator's code parser was widened from
  exactly three digits to that range. No school offering is created; only separately
  stored SCHOOL_COURSE associations can produce offerings.
- Inactive drafts remain excluded from search, details (including numeric direct access),
  recommendation candidates, College selection and locator access. Published new courses
  are disabled in the editor and server-rejected on update. Existing legacy activation
  and edit behavior remains in place. This phase has no published-course edit workflow.

## Migration, not applied

Read-only loopback MySQL inspection confirmed COURSE, ADMIN and source-review/revision
schemas, signed INT foreign-key targets, the draft/inactive check constraint and unique
VARCHAR(10) course codes. No COURSE_PUBLICATION table exists locally.

Pending file: `server/migrations/20261017_add_course_publication.sql`. It creates only
COURSE_MATCHING_REVIEW (append-only review history) and COURSE_PUBLICATION (one immutable
publication record per new course). Dates default to server CURRENT_TIMESTAMP(6);
reviewer/publisher IDs and labels come exclusively from authenticated ADMIN records.
There is no backfill or modification of earlier migration files.

Before enabling this code, inspect migration state, create and restore-verify a guarded
local backup, then apply this file once after the three existing draft/source migrations.
Do not rerun earlier migrations. If either new table is already present without the
other, or its schema differs, stop for review rather than rerunning partial DDL. This
implementation references both tables and requires the migration before runtime use.

## Verification and remaining manual checks

Focused fixture tests cover publication blockers, admin JWTs, server attribution,
explicit confirmations, stale/change-revert revisions, history, atomic rollback,
concurrent/duplicate publish, read-only saves, draft exclusion, database-backed Search,
College setup/duration and WSM candidate integration. Canonical/profile/scoring,
recommendation-persistence and College regressions run separately from expectations
for new candidates. No tests connect to a real database.

Results: 51 publication/draft/catalog tests, 131 targeted historical/eligibility/College
regressions and 18 frontend tests passed. Targeted ESLint, backend syntax checks and
the frontend production build passed; the existing large-bundle build warning remains.

After an authorized migration, verify MySQL foreign keys/default timestamps, lock
serialization, rollback and concurrent HTTP publication against controlled fixtures.
In a browser, verify Save → source confirmation → matching review → publication,
field errors, stale-review reload, preserved form values, mobile layout and published
read-only display. Neither actual-MySQL publication nor browser checks are claimed here.
