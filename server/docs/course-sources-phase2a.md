# Draft course sources and manual admin review (Phase 2A)

Implemented only for inactive drafts. Save a draft first, then use Add Source to
save title, HTTP(S) URL, one or more supported information types, and optional
notes. Sources have their own Save Source action. Open Source opens a browser
tab; the server does not fetch or inspect its content. A confirmation requires
an explicit checkbox and a separate Record Admin Confirmation action against
saved information. Unsaved course/source edits disable confirmation. Saved
information is shown alongside the source, independently of the course form.

Confirmation means the administrator says the source supports the selected
information. It never approves matching weights or publication. Drafts remain
inactive; Phase 1 activation protection and all student eligibility/filtering
remain unchanged. No automatic-checking result labels or functionality are added.

## Schema and migration

Read-only inspection on October 16, 2026 confirmed local MySQL 8/InnoDB with the
Phase 1 COURSE columns/check constraint, signed INT COURSE/ADMIN primary keys,
and unique course/domain and course/RIASEC profile keys. There were no Phase 2
draft source tables. No database writes were performed for this implementation.

New migration: `server/migrations/20261016_add_draft_source_reviews.sql`.
It creates only these initially empty tables:

- COURSE_DRAFT_SOURCE: saved references, source revision, soft-removal marker.
- COURSE_DRAFT_SOURCE_REVIEW: append-only confirmations, authenticated admin ID,
  username snapshot, database-generated timestamp, saved source/claim snapshots,
  relevant field revisions and server-computed context token.
- COURSE_DRAFT_FIELD_REVISION: per-draft, per-information revisions; absent entries
  mean initial revision 1. Rows are created lazily on relevant draft edits.

The migration was applied locally after backup/restore verification; see the local
verification record. For another environment, use the
normal backed-up migration process, verify Phase 1 is already applied, and apply
only this new file once. Do not modify or rerun the Phase 1 migration. No backfill,
source import, implicit verification, existing-row update, or automatic startup
migration is included. Bundled catalog sources remain untouched.

## Review consistency

Every source operation locks its parent draft inside a transaction. Course
saves already lock that row; relevant revision increments run within the same
save transaction. Thus a review either records the saved information it saw or
returns 409 after concurrent relevant edits. Source edit/removal requires its
current source revision and also returns 409 for stale writes. IDs are scoped
to their parent course. Existing/active catalog rows cannot acquire draft sources.

Revision groups are:

| Supported information | Changes that require another confirmation |
| --- | --- |
| Course name | Name or abbreviation; this identity group is included in every source review |
| Description | Description |
| Obtainable skills | Obtainable-skills text |
| Duration | Duration years or year-level labels/overviews |
| Matching-profile evidence | Cluster, skill/RIASEC domains, weights or evidence |

Only actual saved changes increment revisions. Reordering identical profile rows
or no-op saves preserves confirmations; unrelated field edits preserve unaffected
confirmations. A change followed by a revert still increments revisions, preventing
an old confirmation from becoming valid again. Title/URL/selected fields/notes
changes increment the source revision. Context tokens also hash the specific
source/course IDs, saved source and current supported information, so stale or
cross-source confirmation tokens are rejected. Direct out-of-band changes are
detected by content hashes when their resulting content differs; application
revision tracking is required to detect out-of-band change-and-revert sequences.

Review history is never overwritten or deleted. Removal archives the source and
retains its confirmations and snapshots. Current/previous confirmation status is
derived from the saved revisions/context. The browser shows the server-recorded
reviewer and date; client reviewer/date properties are ignored. Server attribution
comes exclusively from the authenticated admin JWT and the current ADMIN row.

Endpoints under `/api/admin/courses/:courseId/sources` all use the existing real
admin middleware: GET/POST root; PUT/DELETE `/:sourceId`; POST
`/:sourceId/reviews`. Review input is `{ confirmed: true, expected_token }`.
The timestamp is omitted from INSERT parameters so the database sets it.

## Validation and checks

Shared client/server validation requires a nonblank title (255 max), a full HTTP
or HTTPS URL (2048 max, no embedded credentials/control characters/spaces), at
least one of five allowed information types without duplicates, and optional
notes (5000 max). Unsafe link schemes are rejected. Links use noopener/noreferrer;
all user text is rendered through React text nodes. No URL fetching, PDF parsing,
AI, DNS resolution, or external source-check requests occur in this phase.

Focused tests use in-memory transactional query adapters and real Express routes
with real JWT admin middleware; only the admin lookup is stubbed. They do not
contact or modify MySQL. Coverage includes source persistence/edit/removal,
history, attribution, authorization, stale revisions/tokens, source identity,
per-field invalidation, change/revert protection, rollback, frontend validation
and confirmation gating, legacy record preservation, and draft exclusion.

From the root:

```powershell
node --test server/tests/draftSourceService.test.js server/tests/courseDraftService.test.js server/tests/adminCourseStatus.test.js client/src/utils/courseDraftForm.test.js client/src/utils/courseSourceFields.test.js
```

Frontend targeted ESLint and the production build are also checked. Actual MySQL
persistence/concurrency checks await a separately authorized application of the
new migration. No full test suite, import or backfill is needed for this change.

## Remaining phases

Add Draft source checking is documented in course-sources-phase2b.md. Publication,
separate eligibility policies and public catalog conversion remain out of scope.
School offering verification remains independent. Review of source support is
not a workflow for approving or deriving WSM weights.
