# LearnMatch Canonical Course Data Cleanup — Review Report

Review date: 2026-09-21  
Scope: canonical course metadata review copy only. No canonical source, database, enrichment dataset, page, API, or production system was changed.

## 1. Cleanup summary

| Measure | Result |
|---|---:|
| Canonical courses retained | 342 |
| Unique CRS IDs retained | 342 |
| Courses with any proposed change | 172 |
| Descriptions rewritten | 157 |
| Courses with skills cleaned or safely backfilled | 118 |
| Contaminated skill entries removed | 224 |
| Conservative skill entries added where cleanup left no skills | 64 |
| Courses with career paths cleaned/reworded/backfilled | 134 |
| Contaminated career entries removed | 223 |
| Conservative career entries added where cleanup left no careers | 45 |
| Courses with provenance added to `sources[]` | 55 |
| Provenance entries preserved from contaminated arrays | 72 |
| Safe title fixes proposed in review copy | 4 |
| Title concerns needing manual review | 9 |
| Duplicate-sensitive title concerns | 5 |

The review copy is `learnmatch_courses_342_cleaned_review.json`. `course_data_cleanup_changes.json` records every changed course and only the fields changed.

## 2. Cleanup approach

### Descriptions

Descriptions containing CMO/CHED/PSG references, source commentary, research caveats, URLs, indirect-program justification, or “no reliable…” language were replaced with two- or three-sentence student-facing descriptions. Rewrites use the existing course title plus cleaned skills and career fields. Where direct evidence was limited, wording stays general rather than introducing accreditation, licensure, or detailed curriculum claims.

### Obtainable skills

Entries containing `SOURCE BASIS`, CMO/CHED/PSG citations, URLs, source names, research notes, or provenance statements were removed. If this left a course with no skills, the review copy adds conservative transferable or cluster-relevant skills. These additions are separately recorded in the change ledger.

### Canonical career paths

This cleanup applies only to canonical `career_paths[]`. It removes provenance, regulatory citations, research caveats, and qualification disclaimers; it also shortens a limited set of narrative entries into career or field labels. If no career remained, conservative entry-level paths were added and recorded.

The separate `learnmatch_342_year_levels_and_careers_final.json` enrichment data, salary estimates, year levels, and `CAREER_OPPORTUNITY` database records were not modified.

### Sources

Every original `sources[]` element remains in the same order. When a removed skill/career value contained provenance not textually represented in the existing source object, the review copy appended that exact value as a provenance note with `url: null`; no URL or citation was fabricated.

## 3. Title concerns

### `SAFE_TITLE_FIX` — 4

| CRS | Current title | Proposed review-copy title | Reason |
|---|---|---|---|
| CRS114 | Bs in Accounting Information System (Information Technology Related) | Bachelor of Science in Accounting Information Systems | Corrects casing, recognized plural form, and removes taxonomy commentary. |
| CRS149 | Bachelor in Arts in English | Bachelor of Arts in English | Corrects malformed degree wording without changing discipline. |
| CRS173 | Bachelor of Science in Geiodetic Engineering | Bachelor of Science in Geodetic Engineering | Obvious spelling correction. |
| CRS278 | Bachelor of Na major in Political Science | Bachelor of Arts major in Political Science | Replaces the `Na` placeholder using the BA Political Science title supported by the existing source. |

### `NEEDS_MANUAL_REVIEW` — 9

| CRS | Preserved title | Concern |
|---|---|---|
| CRS043 | Bachelor of Science in Family Economics major in Foods and Food Management | Current/recognized status and intended scope need direct evidence. |
| CRS059 | Bachelor of Science in Industrial Management Engineering Minor in Information Technology | Composite degree/minor lacks direct program-specific evidence. |
| CRS060 | Bachelor of Science in Industrial Management Engineering Minor in Service Management | Composite degree/minor lacks direct evidence and overlaps Service Management records. |
| CRS127 | Bachelor of Arts major in Biology | Unusual degree/major combination needs recognized-program evidence. |
| CRS180 | Bachelor of Science in Aviation Engineering Technology major in Aviation Engineering Technology | Degree and major repeat; direct evidence is limited. |
| CRS196 | Bachelor of Science in Environmental Engineering Technology major in Envet | `Envet` is opaque and course-specific evidence was not located. |
| CRS232 | Bachelor of Science in Applied Economics major in Industrial Economics and Bachelor of Science in Accountancy | Appears to concatenate two separate bachelor degrees. |
| CRS245 | Bachelor of Science in Marine Engineering and Electro Technology | Combined program identity needs direct evidence. |
| CRS322 | Bachelor of Arts in Behavioral Sciences major in Organizational and Social Systems Development and Bachelor of Science in Advertising Management Bachelor of Science in Advertising Management | Multiple programs are concatenated and Advertising Management repeats. |

### `DUPLICATE_CONCERN` — 5

| CRS | Preserved title | Concern |
|---|---|---|
| CRS020 | Bachelor of Science in Civil Engineering Major in Civil | Removing the redundant major would duplicate CRS021. |
| CRS033 | Bachelor of Science in Electronic Engineering major in Electronic Engineering | Self-major overlaps other Electronics Engineering records. |
| CRS057 | Bachelor of Science in Industrial Engineering Minor in Service Management | Overlaps CRS058/CRS060; minor versus specialization may be material. |
| CRS206 | Bachelor of Industrial Technology (E-TEEAP) major in Garments, Fashion and Design Technology | E-TEEAP is a delivery pathway; remaining title overlaps fashion Industrial Technology records. |
| CRS276 | Bachelor in Physical Therapy (Foreign Student) 1St Year | Removing the cohort/year label exposes likely duplication with CRS091. |

No title was merged or deleted.

## 4. LearnMatch Feature Impact

Cleaning must ultimately be integrated once at the canonical/database layer. No page-specific sanitizer is recommended.

| Feature/page | Source/API | Canonical fields displayed or used | Would approved canonical/database cleanup fix it? | Duplicated/hardcoded metadata to synchronize later |
|---|---|---|---|---|
| Landing course suggestions | `GET /api/public/courses/search` | `course_name`; all four fields influence backend search scoring | Canonical JSON integration fixes search payload/index after service restart | None found in page; active-code gate comes from `COURSE` |
| Course Explorer (`CourseSearch`) | `GET /api/public/courses/search` | `course_name`, `description`; skills/careers affect search ranking | Yes for static canonical service; title changes also require DB name sync for consistency | No page-local course metadata found |
| Public Course Details | `GET /api/public/courses/:courseCode` | `course_name`, `description`, `obtainable_skills`, canonical `career_paths` | Yes after canonical review copy is approved and integrated | Year levels and `career_opportunities` come from the separate enrichment JSON and remain unchanged |
| Recommendation Results | recommendation endpoints backed by `COURSE` and persisted recommendations | `course_name` | Requires later `COURSE.course_name` synchronization; JSON-only replacement is insufficient | Persisted recommendation rows/response snapshots may retain historical names |
| Summary Dashboard | recommendations plus `GET /api/public/courses/:courseCode` | recommendation `course_name`; canonical `description` and `obtainable_skills` | Description/skills: canonical integration. Name: DB/persisted recommendation sync | Career Opportunities shown here are enrichment careers with salaries, not canonical `career_paths[]` |
| Career Path / Roadmap | `GET /api/public/courses/:courseCode` plus enrichment | `course_name`, `description`, `obtainable_skills`; then separate year levels and career opportunities | Canonical fields update from approved JSON; DB-backed recommendation names also need sync | `CourseEnrichmentSections` uses separate `career_opportunities`; do not replace it with canonical `career_paths[]` |
| School Locator | `GET /api/public/courses/:courseCode/schools` backed by `COURSE`/`SCHOOL_COURSE` | `course_name` | Requires later database title synchronization | Mapping identities remain CRS/course IDs and must not change |
| College Setup | `/api/recommendations/latest`, college course search | `course_name` | Requires database/persisted recommendation synchronization | No description/skills/canonical career paths displayed here |
| College Dashboard | college tracking endpoints plus public course detail for roadmap | DB-backed `course_name`; enrichment year levels | Title requires DB sync; cleaned description/skills/career paths are not currently shown in the inspected dashboard section | Roadmap/year-level enrichment is separate and unchanged |
| Admin Manage Courses | `/api/admin/courses` and `/api/admin/courses/:id` backed by `COURSE`; `CAREER_OPPORTUNITY` separately | `course_name`, DB `description`, DB `obtainable_skills` | Requires an approved database synchronization; canonical JSON alone does not update admin | Admin careers are `CAREER_OPPORTUNITY`, not canonical `career_paths[]` |
| Recommendation/search backend | `recommendationService`, `publicCourseService` | recommendations use DB course identity/name; public search indexes all four canonical fields | Requires coordinated canonical + DB sync according to each service’s source | Matching profiles and recommendation scores remain separate and were not changed |
| Future API/UI consumers | canonical JSON or synchronized `COURSE` | potentially all four fields | Data-level cleanup provides one consistent source after integration | Consumers reading copied or persisted metadata must be inventoried during integration |

Important data-flow distinction: the public course service reads descriptions, skills, and canonical career paths directly from the canonical JSON, while several recommendation, admin, college, and locator flows read course names and metadata from MySQL. An eventual approved rollout therefore needs both canonical replacement and a controlled database synchronization. It must not copy canonical `career_paths[]` into the separate career-opportunity/salary model.

## 5. Validation results

- Exactly 342 courses remain.
- Exactly 342 unique CRS IDs remain, in the original order.
- Every CRS ID matches the corresponding original record.
- No course was added, removed, merged, or renumbered.
- All unrelated fields are byte-equivalent after JSON value comparison.
- Every original `sources[]` entry is preserved; additional provenance notes are append-only.
- Zero cleaned descriptions contain detected `SOURCE BASIS`, CMO/CHED/PSG, URL, source-commentary, or “no reliable…” patterns.
- Zero cleaned skill entries contain detected provenance/regulatory patterns.
- Zero cleaned canonical career entries contain detected provenance/regulatory patterns.
- No skills or career arrays are empty after conservative review backfills.
- All rewritten descriptions contain two or three sentences.
- All 18 title concerns are classified: 4 safe fixes, 9 manual reviews, 5 duplicate concerns.
- The canonical source hash remained unchanged during validation.

This validation establishes structural and lexical cleanliness. Manual editorial review is still required before approval, especially for generic backfills and courses whose underlying title/evidence is questionable.

## 6. Safety confirmation

| Item | Result |
|---|---|
| Canonical 342-course JSON modified | NO |
| Database/MySQL modified | NO |
| Production accessed or modified | NO |
| Courses added/removed/merged | NO |
| CRS IDs changed | NO |
| Cluster assignments changed | NO |
| Matching profiles or recommendation logic changed | NO |
| Career enrichment/salary/year-level dataset changed | NO |
| School Locator changed | NO |
| Frontend/backend application code changed | NO |
| Migrations/imports run | NO |
| Commit/push performed | NO |

