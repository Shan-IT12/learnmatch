# Local publication verification — October 17, 2026 (Asia/Singapore)

Verified only loopback `localhost:3306`, `learnmatch_db`, MySQL 8.0.46 on
`PC-NI-BEAGLE`. No remote database, production, backfill, import or deployment.

## Backup and migration

Fresh private backup (UTC-named directory):
`.local-backups/course-drafts-2026-10-16T16-19-44-834Z`.
Keep this ignored directory private; it contains the recoverable full local backup.

Restore verification recreated all 30 tables and 5,066 rows in a separately named
temporary local database. Exact schema hashes and full row-multiset hashes matched;
39 foreign keys had no orphans. Generated values were excluded from INSERT data,
while schema definitions were retained. Both `college_term.legacy_user_id` and
`college_tracking_cycle.active_user_id` were exercised in rolled-back transactions,
then row integrity was checked again. The temporary database was removed.

Before DDL, Phase 1 and both source migrations were already applied; both publication
tables were absent. Only `20261017_add_course_publication.sql` was applied, after the
successful restore certificate. Both new tables' columns, primary keys, foreign keys,
InnoDB engine and server timestamp defaults were verified. No earlier migration was
rerun or edited. The guarded tool now supports `migrate-publication` and stops on
partial/mismatched publication schema.

## Actual MySQL and authenticated HTTP results

The one-off publication verification harness exercised the then-current backend on an ephemeral
loopback HTTP port, using real admin/user JWT middleware and clearly marked synthetic
course/student fixtures. It did not alter an existing student's enrollment or assessment.

That one-off database-writing harness and the obsolete loopback-source browser fixture
were retired during repository cleanup. This document preserves the historical results,
not current rerun instructions. Current mocked regression coverage remains in
`tests/coursePublication.test.js`; the guarded backup/restore tool is retained.

- Field-level publication blockers passed. Source confirmation alone did not authorize
  weights/publication. Explicit matching confirmation and publication were separately
  required. Requests without authentication or with student credentials were rejected.
- Manual confirmation and publication worked without an automated check. Actual reviewer
  and publisher IDs/labels came from the authenticated admin; forged identities/dates
  were ignored. Server timestamps were recorded. Relevant detail/profile edits
  invalidated reviews; stale source/publication tokens returned 409 and earlier review
  history remained intact.
- A fault-only local router reused the production publication service and actual backend
  pool. A genuine MySQL missing-table error injected after the publication INSERT caused
  HTTP 500 and rolled back both the publication row and course activation. The saved
  draft, reviews and revision token remained intact. No trigger/schema fault was added.
- Five simultaneous HTTP publication requests returned one 200 and four 409 responses.
  A later duplicate returned 409. The course kept its numeric ID and stable code.
  Published course updates and further source/profile confirmations were rejected;
  publication review returned read-only state.
- Drafts were absent from public catalog/search, stable-code and numeric direct details,
  actual WSM candidate queries, College search/setup and locator details. After publishing,
  Search/details returned saved database content and the exact saved year roadmap.
- College search supplied the saved two-year duration and numeric ID. Third-year setup
  was rejected with no term inserted; second-year setup succeeded for the synthetic user.
  No school association or career enrichment was created; the locator returned no schools.
- The published fixture entered the existing engine's eligible top-cluster WSM candidate
  set, but **did not enter the Top 3**. This is expected: eligibility is not a placement
  guarantee. All 35 original eligible candidate scores were identical. A separate
  historical comparison excluding only the new fixture returned the identical original
  Top 3. Scoring/config file hashes also remained unchanged. No recommendation was saved
  or recalculated into an existing snapshot.

The first rollback-harness attempt stopped because its verification pool used
`dateStrings`, while the backend review-token context used Date objects. It rejected
the token before fault injection. The harness was corrected to use the backend pool;
the complete retry passed. This was a harness mismatch, not a failed backend rollback.

## Cleanup and preservation

Both attempts' synthetic courses, student accounts, source/evidence/review rows and
College fixture records were removed using exact owned IDs and a random verification
prefix. No preexisting record was removed. Full row hashes for all 30 original tables
matched the fresh backup after cleanup, except the deliberately preserved allocator:
`next_number` advanced from 425 to 427. No allocation or auto-increment counter was reset.
The two new publication tables are empty after fixture cleanup.

Preserved original data include 360 catalog courses, 1,185 skill profile rows, 2,160
RIASEC profile rows, 18 saved recommendations / 54 items, 18 College terms, 12 tracking
cycles and 18 semester check-ins. The guarded `verify-original` mode independently
confirmed original row hashes, applied earlier migrations and zero temporary restore
databases. Detailed private results are in `publication-verification.json` beside the
backup. Nine focused fixture publication tests also passed; no full suite was run.

No browser/app surface was available (`apps: [], browsers: []`). Manual browser
verification of Add → Review → Publish → Search/details → College selection remains
pending. The HTTP flow and actual local MySQL behavior above were verified.
