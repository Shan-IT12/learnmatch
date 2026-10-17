# Manage Courses: Phase 1 drafts

## Scope and behavior

New courses have an allocated stable `course_code`, an independent auto-increment
numeric `course_id`, `is_draft = 1` and `is_active = 0`. Both flags are immutable
through course save payloads. Activation rejects drafts, even with complete
profiles. Existing student readers already require active courses; this phase
does not convert public catalog readers, change school offerings, or publish drafts.

The editor supports name, abbreviation, cluster,
description, obtainable skills, duration, year-level labels/overviews, and explicit
skill/RIASEC weights with evidence. Duration is restricted to the existing whole
one-to-five-year structure. Program type and PSCED group are hidden from the
editor and omitted from its save payloads, preserving existing values on edits.
New drafts store NULL for both fields, consistent with canonical catalog imports;
existing records are not backfilled. Blank profile weights are never converted to zero.
At least one recognized skill domain and all six RIASEC dimensions are required
for creation. Existing readiness validation is reused; the existing all-zero
RIASEC behavior is retained. WSM formulas, weights, and cluster inheritance are
unchanged. No weights are inferred from descriptions, skills or year levels.

Legacy rows retain their IDs, codes, status and profiles. Legacy canonical
duration/year levels are shown as fallback data, without backfilling them on a
description-only save. Unchanged duration and profile groups are omitted by the
editor. The API preserves omitted groups and omitted legacy program metadata.
Explicit profile edits use scoped upserts, retaining existing domain row IDs;
only deliberately removed domains for that course are deleted. Omitted evidence
is preserved on an existing profile row. No write targets recommendations,
tracking cycles, terms, check-ins or other courses.

Duplicate checking uses the complete name, Unicode NFKC normalization, collapsed
whitespace and case folding. A conflicting new/renamed record returns 409 with
existing IDs/codes/names. Abbreviations and similar names alone do not trigger a
merge or conflict. Full specialization names remain distinct. Unchanged legacy
names can still be edited when legacy duplicate names already exist. A valid
update of a missing numeric ID returns 404.

## Migration (manual; applied locally during verification)

The local schema was inspected read-only on October 16, 2026 using `SHOW CREATE
TABLE` against a loopback connection. Confirmed MySQL/InnoDB structure:

- `COURSE.course_id`: INT AUTO_INCREMENT primary key.
- `COURSE.course_code`: nullable VARCHAR(10), unique `uq_course_code`.
- Profile tables: unique course/domain and course/RIASEC keys, INT course foreign
  keys, integer weights, TEXT evidence, auto-increment profile IDs.

Before enabling the new server code, an operator should:

1. Back up the intended database and confirm those table/index definitions match.
2. Stop concurrent course writers/imports for the migration window.
3. Run `server/migrations/20261016_add_course_drafts.sql` once with an explicitly
   selected database, using the normal database migration process. It adds only
   draft/duration/year-level columns, an inactive-draft check constraint, and a
   singleton allocator table. It does not alter existing codes, profiles or
   student records. Existing rows default to non-draft with nullable new metadata.
4. Confirm the allocator contains one row (ID 1), seeded above existing numeric
   CRS codes, and the unique stable-code index is present. Start the updated app.

MySQL DDL is not transactionally reversible; this migration is intentionally not
an automatic startup action or an idempotent import. Do not run the old catalog
or profile import scripts as part of this phase: their fixed-catalog assumptions
need separate revision before future catalog imports.

Every application create/update locks the singleton allocator row inside an
InnoDB transaction before duplicate checks or allocation. Concurrent requests
therefore cannot allocate the same code or pass the same normalized-name check.
Occupied codes are skipped and the existing unique code index is the final
constraint. Failed writes roll back the course, duration, profiles and allocator
advance together. Codes retain the CRS prefix and at least three digits, up to
the existing VARCHAR(10) capacity. Drafts are not passed to student consumers with
older three-digit-code assumptions. Independent SQL writers do not participate
in application name validation; no new name uniqueness constraint is imposed on
the legacy catalog.

## Checks and limits

Run the focused tests from the repository root:

```powershell
node --test server/tests/courseDraftService.test.js server/tests/adminCourseStatus.test.js server/tests/requestValidationService.test.js server/tests/recommendationEngine.test.js client/src/utils/courseDraftForm.test.js
```

The transaction/concurrency tests use a serialized in-memory database adapter.
No live database writes, migration execution, imports or backfills are part of
these unit tests. The explicit local integration workflow below is separate.

Frontend checks (from `client`):

```powershell
npm.cmd exec eslint src/pages/admin/ManageCourses.jsx src/components/admin/CourseDraftFields.jsx src/utils/courseDraftForm.js
npm.cmd run build
```

## Local backup and integration verification, October 16, 2026

The configured target was confirmed as `localhost:3306 / learnmatch_db`, MySQL
8.0.46. No remote connection or production change was made.

The first restore error was `ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN` for
`college_term.legacy_user_id`. The schema scan also found generated
`college_tracking_cycle.active_user_id`. The backup tool now detects STORED and
VIRTUAL generated columns, preserves their complete CREATE TABLE definitions,
excludes them from INSERT column lists, and retains their computed values in the
snapshot for full-data verification. Ordinary DEFAULT_GENERATED columns remain
in the INSERT data. No original table was altered to bypass generated behavior.

Fresh backup: `.local-backups/course-drafts-2026-10-16T08-16-41-932Z` (ignored by
Git). It contains `restore.sql`, `snapshot.json`, SHA-256 `manifest.json`, a
successful `restore-check.json`, and the actual-MySQL `draft-verification.json`.
The older failed backup remains clearly marked and was not used for migration.

Restoration into a uniquely named temporary local database passed exact
CREATE TABLE hashes and full-row hashes (including generated values) for all 25
tables and 5,065 rows, plus 33 foreign-key checks. In the temporary database,
transactional edits exercised both branches of each generated expression and
verified recalculation; rollback restored all original hashes. The temporary
database was then removed.

Only after that successful restore check, the pending migration was applied once
to the original local database. The allocator was initialized at 361. Actual
authenticated loopback HTTP requests and MySQL transactions verified complete
draft creation/edit/reload, explicit profiles, duplicate 409, missing-update 404,
invalid-profile 400, rollback after a genuine MySQL error, eight concurrent unique
allocations, and a four-request duplicate race producing one creation and three
conflicts. Activation returned 422; the database CHECK independently rejected
activation. Public catalog/search/details, College search/setup, locator, and the
actual WSM candidate query excluded drafts. Read-only WSM output was unchanged.

An initial integration assertion incorrectly expected fuzzy public search to
return zero results. It was corrected to assert fixture exclusion, including the
full public catalog; the complete integration run then passed. Both runs cleaned
up their own ten synthetic fixtures. After cleanup, full-row hashes of every
original table matched the pre-migration backup, including existing course IDs,
profiles, recommendations and College tracking. Allocation counters were left
advanced (next stable code 381), rather than reusing verification codes or
resetting auto-increment sequences. No imports, backfills or commits were run.

The guarded tools are opt-in, from `server`:

```powershell
node scripts/localCourseDraftVerification.mjs inspect
node scripts/localCourseDraftVerification.mjs backup
node scripts/localCourseDraftVerification.mjs restore-check '<fresh-backup-directory>'
node scripts/localCourseDraftVerification.mjs migrate '<fresh-backup-directory>'
node scripts/localCourseDraftVerification.mjs verify-original '<fresh-backup-directory>'
```

These tools refuse a non-loopback configured host. Migration requires a matching
successful restore certificate and unchanged original data. A partially applied
migration stops for review. The one-off Phase 1 database fixture harness was retired
during repository cleanup; the results above are historical, not rerun instructions.
Current mocked regression coverage remains in `tests/courseDraftService.test.js`.

## Phase 2

Add multiple structured sources, safe deterministic webpage/text-PDF checking,
manual verification with reviewer/date and revision invalidation, publication
and separate recommendation/College eligibility, and database-backed public
catalog content/duration. Decide published-edit behavior and supported future
code/duration formats before exposing new courses. School offering verification
remains independent. No Phase 2 checker, publication or review workflow is
implemented here.
# Saved draft viewing and manual career opportunities

New-workflow drafts now open in a read-only view after a successful save/reload and when
opened from the course list. **Edit Draft** enables editing; **Save Draft Changes** reloads
the normalized saved record and returns to viewing. Draft save never activates a course.
The separate **Review & Publish → Publish Course** flow retains all existing source/profile
confirmations, revision checks and eligibility blockers. Published new records remain read-only.

Career opportunities are optional, manually entered title/salary-reference/description rows
(at most 20). The local loopback schema was inspected read-only: `CAREER_OPPORTUNITY` already
has `opportunity_id`, `course_id`, `job_title VARCHAR(150)`, `salary_range VARCHAR(100)` and
`description TEXT`. The input caps are 150/100/3000 respectively. No migration or backfill is
needed or applied. Empty optional rows are ignored by the form. No job, salary, license claim
or matching weight is generated or inferred.

Draft career inserts/updates/removals share the existing course/profile/source transaction.
Omitted careers preserve existing rows; included existing IDs must belong to that course;
unchanged IDs are retained. Standalone legacy career endpoints cannot mutate new drafts or
published records, preventing a bypass of draft saving/publication immutability. Legacy catalog
careers/enrichment remain unchanged. Published new courses expose only their saved career rows.
Career changes bind publication-review tokens but do not change scoring weights or automatically
approve a matching review. Publication snapshots include the reviewed careers. No actual course
rows, sources, reviews or publications were created/changed during implementation verification.
