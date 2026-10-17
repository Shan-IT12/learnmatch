# Catalog references and dated official-reference updates

Manage Courses displays a maximum of three references for each existing catalog record. The authenticated admin detail response exposes `catalogReferences`; no database records, profiles, reviews or publication state are changed.

## Original provenance

Original per-course source arrays remain intact in:

- `server/data/learnmatch_courses_final_342_with_ids.json`
- `server/data/learnmatch_course_matching_profiles_final_342_with_ids.json`
- `server/data/learnmatch_342_year_levels_and_careers_final.json`

Exact stable course codes determine attribution. Similar titles, numeric database IDs and successor/duplicate identities are never substituted. Repeated URLs retain each original purpose, title and JSON location. The historical-only baseline audit is `catalog-source-reference-audit.csv`: 360 records have references, 38 originally had no usable URL. Those original files/audit were not rewritten by the reference refresh.

## Official-reference lookup: 2026-10-18

`server/data/learnmatch_catalog_reference_updates.json` records 31 explicit document/listing mappings across 82 course codes. Each includes the official URL, order year, research date, lookup method, locator and a scope limitation. This is research metadata, not an authenticated admin confirmation or expert review. New mappings precede historical provenance; no blind date sorting is used. The refreshed per-course result is `catalog-source-refresh-audit.csv`, including uncovered records and omissions from the three-reference display cap.

Examples:

- Manufacturing Engineering: [CHED's 2025 index](https://legacy.ched.gov.ph/2025-ched-memorandum-orders/) lists CMO 16 for AY 2026-2027. Its direct PDF returned HTTP 403 during research, so the displayed source opens the official index. This order is not assigned to Manufacturing Engineering Technology.
- BET: the same official index lists CMO 20 s.2025. It is shown as a parent framework, never proof of a specific major or curriculum.
- Industrial Technology: [CHED's 2023 index](https://legacy.ched.gov.ph/2023-ched-memorandum-orders/) lists CMO 13. BS/Bachelor-in variants and exact majors are explicitly left for identity/specialization review.
- Agriculture: [CMO 23 s.2021](https://legacy.ched.gov.ph/wp-content/uploads/CMO-23-s.-2021.pdf) supplies a later BS Agriculture framework for agriculture-major records that still cite older documents. It does not establish each major.
- Agricultural Technology: [CHED Regional XI Memo 001 s.2022](https://ro11.ched.gov.ph/wp-content/uploads/2022/10/MRD-NO.-001-S.-2022.pdf), page 1, discusses gradual phase-out of BAT/DAT-BAT and applications for BS Agriculture. BAT is not silently renamed or treated as equivalent to Agriculture. The old 1996 reference remains visible; the Agriculture order is labeled related/transition context only. No eligibility decision is made.
- Maritime: [Joint Circular 01 s.2023](https://legacy.ched.gov.ph/wp-content/uploads/JCMMC-1-S.-2023-PSG.pdf), page 1, covers BSMT and BSMarE. [MARINA Advisory 2025-39](https://marina.gov.ph/wp-content/uploads/2025/10/MA-No.-2025-39.pdf), item 1.1, discusses continued use until new PSGs are issued. Neither is applied to Naval Architecture, a combined degree, or an unestablished specialization.
- BA Philosophy: [CHED's 2017 index](https://legacy.ched.gov.ph/2017-ched-memorandum-orders/) lists CMO 26, a more specific later reference than general HSC 1997. It is not automatically assigned to BS Philosophy.

Official indices from 2015 and 2017-2026 were consulted. Direct readable PDF sections were used where available; listing-only and scanned/unavailable-document checks are explicitly distinguished. Individual course facts, specializations, year overviews and numeric weights were not revalidated or altered. No newer replacement was established for computing/library references dated 2015; a newer date on an unrelated issuance is not a replacement PSG.

## Limits and unchanged behavior

This is **not an exhaustive certification of the latest applicable PSG for every course**. The legacy CHED 2026 index was incomplete, and the newer e.gov page was not text-readable. Records outside the explicit mappings state that latest applicability has not been confirmed. Related frameworks/transition notices do not establish equivalent degrees or substantiate every existing claim. Older dates alone do not prove repeal. Original `used_for` wording remains visibly historical rather than being presented as a new finding.

No URLs are fabricated. Historical file references and unlinked titles remain preserved. Display-only links do not authorize source checking/saving/review on additional hosts: the Add Draft approved-host policy, fetch protections, manual review and three-link cap are unchanged. No runtime fetching, OCR, AI requests, weight generation, automatic source confirmation or publication is introduced. Published new courses continue to use publication snapshots; drafts retain their existing review workflow.

Restart the local backend, reopen a catalog course, and expand Sources. Frontend tests use fixtures and mocked rendering; live browser verification remains separate. No migration, import or backfill is needed.
