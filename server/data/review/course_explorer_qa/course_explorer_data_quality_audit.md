# LearnMatch Course Explorer Data-Quality Audit

Audit date: 2026-09-21  
Scope: read-only review of `learnmatch_courses_final_342_with_ids.json` and the public Course Explorer search/detail implementation.  
Method note: counts below are reproducible lexical QA classifications. “Needs rewrite” means the description begins with or is materially dominated by regulatory/provenance/indirect-source language; the broader “contains regulatory language” count also includes otherwise useful descriptions that merely cite a CMO/PSG.

## A. Executive Summary

- The canonical file has exactly 342 records, a complete unique `CRS001`–`CRS342` sequence, no exact duplicate names, and a non-empty `sources[]` array on every record.
- Veterinary Medicine, Dentistry/Dental Medicine, and Medicine/Doctor of Medicine are absent. Dermatology is also absent, appropriately so as a standalone undergraduate program; it is normally a medical specialty, and there is no Medicine program in this catalog to which it could be attached.
- Current search is an in-memory backend weighted substring search across code, abbreviation, name, cluster, skills, careers, and description. The public endpoint then filters against active database course codes.
- Substring matching is the principal search-quality defect. `vet` matches the substring in `Envet`; `IT` matches 340 of 342 records. Contaminated descriptions, skills, and careers also expand irrelevant matches.
- 113 descriptions need student-facing rewriting under the audit rule; 156 contain CMO/CHED/PSG or other regulatory language; 20 contain explicit provenance/research-note language; 39 describe a program indirectly through another program. No description is empty.
- Skills contain 224 suspicious entries across 117 courses (3,675 entries total). Careers contain 220 suspicious entries across 119 courses (3,615 entries total).
- The companion `course_explorer_contamination_audit.json` records every suspicious skill/career entry verbatim with its affected CRS code and canonical course name.
- There are no byte-for-byte or punctuation/case-only duplicate course names. There are, however, many strong same-program naming variants requiring academic-owner review before any merge. Nursing is one of these. The theology/religious-education records are related but not safely mergeable from this evidence alone.

## B. Search Implementation Findings

Implementation reviewed: `server/services/publicCourseService.js` and `server/routes/publicCourseRoutes.js`.

The service loads the canonical JSON and a separate year-level/career enrichment JSON into memory. It normalizes text by lowercasing, Unicode decomposition, replacing non-alphanumeric characters with spaces, and trimming. Queries are split into unique tokens longer than one character, excluding a small stop-word set.

Searched fields and weights are:

| Field | Weight |
|---|---:|
| course ID (`CRSxxx`) | 16 |
| abbreviation | 18 |
| course name | 12 |
| parent cluster | 5 |
| obtainable skills | 4 |
| career paths | 4 |
| description | 2 |

For every field, an exact phrase adds `5 × weight`, prefix adds `3 × weight`, substring adds `2 × weight`, and every query token found by `field.includes(token)` adds another weight. Results with positive scores are sorted by score and then course name. This is backend filtering/ranking, not SQL `LIKE` or frontend filtering. `GET /api/public/courses/search` additionally queries `COURSE` only for active `course_code` values and filters the in-memory result set; detail lookup also uses the JSON and active-code gate.

Why `vet` finds CRS196: normalized `Bachelor of Science in Environmental Engineering Technology major in Envet` contains the literal character sequence `vet` inside `envet`. There are no token-boundary or minimum-short-query rules.

Other consequences:

- `IT` is normalized to `it`; substring matching finds it inside common words such as “with,” “university,” and “political,” producing 340 results.
- Multi-token queries use additive matching rather than requiring all meaningful tokens. `information technology` returns 164 results because either token can contribute.
- Skills, careers, and descriptions are indexed even where they contain source commentary, so contamination directly affects discovery and ranking.
- CRS identifiers remain searchable internally. That behavior is separate from whether the UI displays them.

## C. Veterinary / Dentistry / Dermatology Findings

| Subject | Canonical finding | Search finding | Interpretation |
|---|---|---|---|
| Veterinary Medicine | No record name, abbreviation, description, skill, career, or source contains `veter...` | `veterinary` and `veterinarian`: 0 | Missing canonical program/data, not merely a synonym problem. |
| `vet` | No veterinary record | 1 result: CRS196, “…major in Envet” | Pure substring false positive. |
| Dentistry / Dental Medicine | No course name corresponding to Dentistry, Dental Medicine, or Doctor of Dental Medicine | `dentistry` and `dentist`: 0 | Missing canonical program/data. A naive broad `dent` scan is invalid because it occurs inside “student.” |
| Medicine / Doctor of Medicine | No Medicine/Doctor of Medicine program | Searches were not expected to infer it from allied-health programs | Missing canonical program/data. Medical Technology, Public Health, Biology, etc. are not substitutes. |
| Dermatology | No undergraduate degree/program and no dermatology content | `dermatology` and `dermatologist`: 0 | Not evidence of a missing undergraduate degree. Dermatology is a post-medical specialization/career; it should only be surfaced through an appropriately modeled Medicine pathway, which is absent. |
| Nursing | CRS083 BS Nursing (BSN) and CRS267 Bachelor of Nursing | Both found | Strong likely duplicate/naming variant; CRS267 explicitly says it is closely related to BSN and shares its curriculum. Do not merge without owner approval. |

## D. Duplicate and Near-Duplicate Course Findings

Normalization was used for comparison only (case, punctuation, whitespace, parenthetical abbreviations, bachelor-degree wording, and conservative specialization wording). No canonical value was changed.

### A. Exact duplicate

None. There are zero identical names after case/punctuation/whitespace normalization.

### B. Likely duplicate / same-program naming variant

The following are high-priority review groups. They normalize to the same core program or differ only by an obvious naming variant:

- CRS024/CRS025 — Computer Engineering
- CRS035/CRS036 — Elementary Education
- CRS046/CRS165 — Fine Arts
- CRS054/CRS219 — Human Services
- CRS055/CRS222 — Industrial Design
- CRS057/CRS060 — Industrial (Management) Engineering, Service Management minor
- CRS072/CRS248 — Marine Transportation
- CRS075/CRS256 — Mechanical Engineering
- CRS076/CRS077 — Medical Technology / Medical Laboratory Science, with the two names reversed
- CRS083/CRS267 — Nursing / BS Nursing
- CRS090/CRS275 — Physical Education
- CRS094/CRS281 — Psychology
- CRS096/CRS282 — Public Administration
- CRS098/CRS284 — Radiologic Technology
- CRS102/CRS290/CRS292 — Secondary Education, English
- CRS103/CRS293 — Industrial Security Management
- CRS107/CRS300 — Special Needs Education
- CRS123/CRS197 — Apparel/Fashion Design wording
- CRS133/CRS326 — Civil Engineering Technology
- CRS144/CRS191 — Electronics and Communication(s) Engineering
- CRS146/CRS240 — Engineering Management / Management Engineering (semantic confirmation required)
- CRS150/CRS151 — English Education
- CRS153/CRS157 — Environmental and Sanitary Engineering word order
- CRS163/CRS164 — Filipino Education
- CRS170/CRS171 — Garments/Fashion/Design Industrial Technology
- CRS175/CRS211 — Civil Engineering, Geotechnical
- CRS200/CRS201 — Industrial Technology, Foods/Foods Technology
- CRS253/CRS254 — Mathematics Education
- CRS258/CRS259 — Mechanical Engineering Technology, Automotive specialization wording
- CRS302/CRS304 — Sports Science
- CRS312/CRS314 — Theology degree-title variant (requires academic confirmation)
- CRS315/CRS316 — Civil Engineering, Transportation
- CRS328/CRS329 — Industrial Technology, Computer/Computer Technology
- CRS337/CRS338 — Industrial Technology, Electronics
- CRS340/CRS341 — Industrial Technology, Electronics and Communications Technology

### C. Possibly related but distinct

- CRS112/CRS216/CRS306/CRS309 — Home Economics / Technology and Livelihood Education variants; degree types and teacher-training scope may differ.
- CRS133/CRS138/CRS194/CRS326/CRS327/CRS330 — civil/construction engineering technology; majors and construction-management scope may be material.
- CRS134/CRS266/CRS286 — environmental resource-management majors; coastal/natural/general resource scope differs.
- CRS137/CRS330 — Construction Engineering and Management versus Construction Engineering Technology and Management.
- CRS184/CRS317/CRS318 — Civil Engineering water-resource wording; singular/plural and specialization structure require confirmation.
- CRS187/CRS231 — Instrumentation and Control Engineering Technology versus Engineering.
- CRS223/CRS234 — Industrial Design Technology versus Interior Design Technology.
- CRS257/CRS258/CRS259/CRS260 — general Mechanical Engineering Technology versus automotive specializations; keep the general program distinct and review only equivalent automotive wording.
- CRS312/CRS313/CRS314 — BS Theology, BA Theology, and Bachelor of Theology may encode different degree structures despite shared subject matter.
- CRS334 — Religious Education is pedagogical and not the same name/scope as Theology.

### D. Clearly distinct

Representative controls: CRS094 BS Psychology versus CRS095 BA Psychology; CRS030 BS Economics versus CRS031 BA Economics; CRS312–CRS314 Theology versus CRS334 Religious Education. Shared discipline alone is not a duplicate criterion. Majors and genuine specializations must be preserved.

## E. Description Quality Findings

| Measure | Courses |
|---|---:|
| Total | 342 |
| Clean/usable student-facing under the audit rule | 229 |
| Needing rewrite | 113 |
| Containing CMO/regulatory/source-authority language | 156 |
| Containing explicit provenance/research-note language | 20 |
| Indirectly describing one program through another | 39 |
| Missing/empty | 0 |

Counts overlap except clean versus needs-rewrite. The 113-course rewrite set is: CRS059, CRS060, CRS125, CRS180, CRS196, CRS202, CRS203, CRS210, CRS212, CRS220, CRS224, CRS225, CRS227, CRS236, CRS237, and CRS243–CRS342 except CRS246 and CRS249. This set is driven by descriptions beginning with CMO/source commentary, “no reliable…” notes, source-based synthesis, or “closely related/shares substantial curriculum” proxy text.

Representative findings:

- CRS247 Marine Science begins with a CMO for Marine Biology, says the submitted program is “closely related,” and labels the text a source-based synthesis.
- CRS250 Materials Science and Engineering uses the Materials Engineering CMO as a proxy and emphasizes shared curriculum.
- CRS267 Bachelor of Nursing relies on the BSN PSG and explicitly says it is closely related to BSN—useful duplicate evidence, but poor student copy.
- CRS059/060/125/180/202/203/210/212/220/224/225/227/236/237 contain “no reliable…” or “no course-specific…” research conclusions rather than course explanations.
- Many CRS013–CRS242 descriptions mention an official CMO/CHED PSG but then provide meaningful plain-language study and career information; these are counted in the 156 regulatory-language hits, but are not automatically in the 113 rewrite set.

## F. `obtainable_skills` Contamination Findings

- Total entries: **3,675**
- Suspicious/non-skill entries: **224**
- Affected courses: **117**
- Empty skills arrays: **1** — CRS072, Bachelor of Science in Marine Transportation (BSMT)

Affected courses are CRS059, CRS060, CRS125, CRS130, CRS180, CRS196, CRS202, CRS203, CRS210, CRS212, CRS220, CRS224, CRS225, CRS227, CRS232, CRS236, CRS237, and CRS243–CRS342.

Exact suspicious values fall into these observed families (punctuation retained):

- `SOURCE BASIS:` (CRS243–CRS342)
- Standalone CMO lists such as `CMO No. 86, Series of 2017`, and semicolon-joined variants containing CMO Nos. 5, 6, 7, 12, 13, 14, 15, 17, 19, 23, 25, 30, 31, 34, 35, 39, 40, 43, 44, 46, 48, 51, 52, 55, 67, 74, 75, 77, 78, 79, 80, 81, 86, 87, 88, 92, 95, 96, 97, and 101, with the exact `Series of YYYY` notation stored on the affected record.
- Source-name variants: `Philippine Qualifications Register`, `Bulacan State University CSER`, and references to CHED/PSG.
- Exact research-note values: `No reliable course-specific skill set could be verified for the exact submitted program.`, `No reliable course-specific skills could be established for the exact submitted program.`, `No reliable information was found in the provided sources for this specific course.`, `(General Engineering Technology competencies only; no verified course-specific PSG found.)`, `No reliable information was found in the provided sources for this specific course title.`, `No reliable program-specific skills were found for this exact course title in the provided official source.`, `No course-specific skills could be reliably established from the provided CHED source for this exact degree title.`, `No course-specific skills could be reliably established from the provided CHED source for this exact degree.`, `No course-specific skills can be reliably extracted from the submitted CMO for the exact program title.`, `No course-specific skills can be reliably extracted from the supplied CMO.`, `No course-specific skills can be reliably established from the supplied source.`, `No course-specific skills can be reliably extracted from the supplied CHED source.`, `(PSG is CMO No. 27, s. 2017)`, `No reliable course-specific skill set verified.`, and `No reliable course-specific skills verified for the exact submitted title.`
- Regulatory pseudo-skills include `Communication and teamwork skills as required by the engineering technology PSG`, `Ability to function effectively in multidisciplinary teams as prescribed by CMO No. 86`, `Marine engineering knowledge and competencies as prescribed by the BSMarE PSG`, `Application of outcomes-based education principles as prescribed by CHED`, `Marine transportation knowledge and competencies as prescribed by the BSMT PSG`, `Communication and teamwork skills as required by the engineering PSG`, and `Nursing knowledge and competencies as prescribed by the BSN PSG`.

The affected-course ranges plus the exact value families above preserve traceability without treating each repeated `SOURCE BASIS:`/CMO pairing as a separate defect type.

For the complete, exact row-level mapping of all 224 values to affected CRS code and course name, see `course_explorer_contamination_audit.json` in this directory.

## G. `career_paths` Contamination Findings

- Total entries: **3,615**
- Suspicious/non-career entries: **220**
- Affected courses: **119**
- Empty career arrays: **4** — CRS059 Industrial Management Engineering/IT minor; CRS060 Industrial Management Engineering/Service Management minor; CRS210 Geological Science and Engineering; CRS220 Humanities.

Affected courses are CRS125, CRS130, CRS180, CRS202, CRS203, CRS207, CRS208, CRS211, CRS212, CRS213, CRS219, CRS222, CRS224, CRS225, CRS227, CRS229, CRS232, CRS236, CRS237, and CRS243–CRS342.

Exact suspicious values include `SOURCE BASIS:` and standalone CMO/source lists for CRS243–CRS342, including `MARINA`, `Current Issues in BSESS`, and the same CMO-series forms described above. The non-repeated exact research/preface values are:

- `No reliable information was found in the provided sources for this specific course.`
- `No reliable information was found in the provided sources for this specific course title.`
- `No reliable official career opportunities were found for this exact course title in the provided official source.`
- `Based on CMO No. 74, s. 2017:`
- `Based on CMO No. 89, s. 2017:`
- `Based on CMO No. 92, s. 2017 and the scope of Civil Engineering practice:`
- `No course-specific career opportunities can be reliably assigned to this exact CHED degree title.`
- `Based on the Fine Arts and Design PSG (CMO No. 43, s. 2017):`
- `Based on CMO No. 33, s. 2017 :`
- `No course-specific career list can be reliably attributed to the supplied CMO.`
- `No course-specific career opportunities can be reliably established from the supplied source.`
- `No course-specific career opportunities can be reliably established from the supplied CMO.`
- `Based on CMO No. 25, s. 2015 and the BSIS program goals:`
- `Based on CMO No. 32, s. 2017:`
- `(PSG is CMO No. 27, s. 2017)`
- `No course-specific career outcomes could be reliably established.`
- `No course-specific career opportunities could be reliably established from the supplied source.`
- `CMO No. 86, Series of 2017 (program outcomes and career/occupation provisions)`

These are citations, caveats, or headings—not occupations.

For the complete, exact row-level mapping of all 220 values to affected CRS code and course name, see `course_explorer_contamination_audit.json` in this directory.

## H. Search Query Test Matrix

The matrix exercises the current pure search core against all 342 canonical records. The production endpoint can only remove inactive codes; it cannot repair these relevance failures.

| Query | Results / relevant records found | Irrelevant matches | Existing relevant records missed | Issue |
|---|---|---|---|---|
| veterinary | 0 | 0 | None exists | DATA |
| veterinarian | 0 | 0 | None exists | DATA |
| vet | CRS196 Envet | CRS196 | No veterinary record exists | BOTH |
| dentistry | 0 | 0 | None exists | DATA |
| dentist | 0 | 0 | None exists | DATA |
| dermatology | 0 | 0 | None exists | DATA/modeling; not an undergraduate-degree expectation |
| dermatologist | 0 | 0 | None exists | DATA/modeling |
| nursing | 2: CRS267, CRS083 | 0 by topic; likely duplicate variant | 0 | DATA (duplication), search succeeds |
| theology | 4: CRS313, CRS312, CRS314, CRS334 | CRS334 is related religious education, not Theology proper | 0 | SEARCH LOGIC plus taxonomy |
| information technology | 164; CRS062 and CRS230 rank first/second | 162 include broad “information” or “technology” matches | 0 obvious | SEARCH LOGIC and contaminated indexed fields |
| IT | 340; CRS230 and CRS062 rank first/second | 338 | 0 obvious | SEARCH LOGIC (short substring catastrophe) |
| psychology | 11; CRS095, CRS281, CRS094 are top three | 8 sports/social-science/values-education records | 0 obvious | SEARCH LOGIC (skills/careers/descriptions broaden results) |
| engineering | 138; many genuine engineering programs | Mixed engineering-technology and incidental textual matches; relevance is too broad for precise discovery | No obvious name-level engineering record missed | SEARCH LOGIC/taxonomy |

## I. Canonical Dataset Integrity Findings

- Record count: 342.
- ID range: complete and ordered from CRS001 through CRS342.
- Duplicate IDs: 0; missing IDs: 0.
- Exact duplicate course names: 0.
- Missing names: 0; missing descriptions: 0.
- Missing skill lists: 1; missing career lists: 4.
- `sources[]`: present and non-empty on all 342 records (342 total source entries, currently one per course).
- Provenance that leaked into descriptions, skills, and careers can remain in `sources[]` without losing the data model’s provenance channel. Before removal, any citation text that contains information not already represented in the relevant `sources[]` value should be consolidated there and verified; the existence of the field does not prove each current source entry is complete.
- No production database comparison was necessary for this audit. Course Explorer search/detail content is read from the canonical JSON; the database is consulted only for active `course_code` gating. Avoiding a database connection also preserved the required read-only boundary.
- Notable non-duplicate integrity concerns for later review include malformed/awkward canonical names such as CRS278 `Bachelor of Na major in Political Science` and CRS322’s repeated `Bachelor of Science in Advertising Management`, but no correction is authorized here.

## J. Recommended Fix Plan

### Phase 1 — Safe presentation/search fixes

1. Apply token-boundary matching, especially for short queries; require exact abbreviation matching for two-character terms such as `IT`.
2. Require or strongly favor all meaningful query tokens for multi-token searches; rank name and abbreviation matches ahead of auxiliary text.
3. Stop indexing source/provenance entries as skills or careers at presentation/search time, using a narrow display filter only after regression tests and approval.
4. Add explicit search tests for every query in section H, including negative assertions for Envet and short-substring noise.
5. Clarify empty-state wording for genuinely absent programs; do not imply that Dermatology is normally an undergraduate course.

### Phase 2 — Canonical data cleanup requiring approval

1. Review and rewrite the 113 flagged descriptions into plain language: what students study, skills developed, and preparation/outcomes.
2. Move verified provenance exclusively to `sources[]`; remove the 224 non-skill and 220 non-career entries only after preserving any unique citation detail.
3. Resolve the 1 empty skills list and 4 empty career lists using authoritative evidence or leave them explicitly unavailable rather than inventing content.
4. Conduct academic-owner adjudication of every category-B duplicate group, with particular attention to CRS083/CRS267 Nursing and swapped CRS076/CRS077 names.
5. Keep Theology degree types and Religious Education separate unless authoritative program definitions prove equivalence.
6. Decide through governed catalog policy whether Dentistry/Dental Medicine, Veterinary Medicine, and Medicine belong in scope. Do not add Dermatology as an undergraduate degree merely to satisfy a query.
7. Correct malformed canonical names only through an approved, ID-preserving change set.

### Phase 3 — Database synchronization if canonical data is approved

1. Produce an explicit canonical-to-database diff keyed only by stable `CRSxxx` identifiers.
2. Back up and validate the target, apply changes transactionally, and verify row counts, active flags, IDs, and dependent mappings.
3. Re-run search/detail integration tests and confirm School Locator and recommendations remain unchanged unless separately approved.

## Final Safety Check

| Check | Result |
|---|---|
| Canonical JSON modified | NO |
| Course names modified | NO |
| CRS IDs modified | NO |
| Matching profiles modified | NO |
| Database modified | NO |
| Search logic modified | NO |
| School Locator modified | NO |
| Recommendation engine modified | NO |
| Commit/push performed | NO |
