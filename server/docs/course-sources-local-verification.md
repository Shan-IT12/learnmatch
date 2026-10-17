# Phase 2A / 2B local verification ? October 16, 2026

Target: loopback localhost:3306, learnmatch_db, PC-NI-BEAGLE, MySQL 8.0.46.
No remote database connections, imports, backfills, commits, pushes or deployments.

## Backup and migrations

Fresh recoverable backup: `.local-backups/course-drafts-2026-10-16T09-51-12-689Z`.
Keep this ignored directory private: it contains full local database data.
The guarded restore check recreated 26 tables / 5,066 rows in a separate temporary
local database, compared exact schema hashes and full row multiset hashes, checked
33 foreign keys, and exercised both generated columns inside a rolled-back
transaction. Generated values were excluded from INSERTs; definitions were retained.
The temporary database was removed after verification.

Both source migrations were fully pending before writes. After the successful
restore certificate, only these files were applied, in this order:

1. `20261016_add_draft_source_reviews.sql`
2. `20261016_add_source_check_evidence.sql`

Phase 1 was already applied and was neither changed nor rerun. The guarded tool now
checks both source migration states, stops on partial application, captures their
hashes in the fresh backup manifest, and supports `migrate-sources <backup-dir>`.
MySQL DDL is not transactional; any interrupted migration requires manual review.

## Preservation record

The earlier local verification confirmed original catalog IDs/codes, 360 courses,
1,185 skill profiles, 2,160 RIASEC profiles, recommendations and College tracking
were preserved. Its controlled fixtures and temporary restore database were removed;
the allocator was retained at 425 rather than reset. This is a historical backup and
migration record, not a request to rerun migrations or modify a database.

Current Add source detection behavior and focused checks are documented in
[course-sources-phase2b.md](course-sources-phase2b.md). The older extraction-specific
verification harness was retired with that workflow. Stored evidence and review
history remain intact; no migration is rolled back by the simplification.
