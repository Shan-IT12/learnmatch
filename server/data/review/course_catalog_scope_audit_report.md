# LearnMatch Bachelor-Only Catalog Scope Audit

Audit date: 2026-09-21  
Scope: read-only re-audit of CRS001–CRS342 under the corrected rule that LearnMatch catalogs **undergraduate bachelor’s degrees only**.

## Executive summary

- Total canonical records audited: **342**
- `IN_SCOPE_BACHELOR`: **342**
- `REVIEW_PROGRAM_LEVEL`: **0**
- `OUT_OF_SCOPE`: **0**
- In-scope records retaining separate title/program-validity concerns: **18**
- Missing-program candidates reviewed: **20**
- `VALID_MISSING_BACHELOR`: **14**
- `ALREADY_REPRESENTED`: **2**
- `OUT_OF_SCOPE_PROGRAM_LEVEL`: **4**
- `POSSIBLE_DUPLICATE_OR_ALIAS`: **0** as a final missing-candidate disposition
- `INSUFFICIENT_EVIDENCE`: **0**; five valid candidates retain medium or medium-high prevalence/title caveats

The program-level result is intentionally separate from catalog validity. Every current canonical name explicitly begins with `Bachelor` or `BS`; none is named as a master’s, doctorate, associate, diploma, certificate, or short course. Some records remain malformed, unsupported, or duplicative, but those defects do not turn an explicitly bachelor-level record into a postgraduate program.

No canonical record was changed.

## 1. Complete CRS001–CRS342 scope audit

The machine-readable `course_catalog_scope_audit.json` contains all 342 records with course ID, exact canonical name, cluster, classification, detected level, reason, action, confidence, and existing source evidence.

### Classification rule

- `IN_SCOPE_BACHELOR`: title explicitly declares a Bachelor/BS program and contains no contrary level indicator.
- `REVIEW_PROGRAM_LEVEL`: level cannot be confidently determined.
- `OUT_OF_SCOPE`: clearly master’s, doctoral/professional, associate, certificate, diploma, short-course, or TVET program.

### Exact program-level results

`REVIEW_PROGRAM_LEVEL` entries: **none**.

`OUT_OF_SCOPE` entries currently inside CRS001–CRS342: **none**.

All 342 entries are therefore classified `IN_SCOPE_BACHELOR` for **program level only**.

### In-scope titles still requiring other review

The prior audit’s 18 questionable records remain questionable for title/program identity—not level:

- CRS020 — Bachelor of Science in Civil Engineering Major in Civil
- CRS033 — Bachelor of Science in Electronic Engineering major in Electronic Engineering
- CRS043 — Bachelor of Science in Family Economics major in Foods and Food Management
- CRS057 — Bachelor of Science in Industrial Engineering Minor in Service Management
- CRS059 — Bachelor of Science in Industrial Management Engineering Minor in Information Technology
- CRS060 — Bachelor of Science in Industrial Management Engineering Minor in Service Management
- CRS114 — Bs in Accounting Information System (Information Technology Related)
- CRS127 — Bachelor of Arts major in Biology
- CRS149 — Bachelor in Arts in English
- CRS173 — Bachelor of Science in Geiodetic Engineering
- CRS180 — Bachelor of Science in Aviation Engineering Technology major in Aviation Engineering Technology
- CRS196 — Bachelor of Science in Environmental Engineering Technology major in Envet
- CRS206 — Bachelor of Industrial Technology (E-TEEAP) major in Garments, Fashion and Design Technology
- CRS232 — Bachelor of Science in Applied Economics major in Industrial Economics and Bachelor of Science in Accountancy
- CRS245 — Bachelor of Science in Marine Engineering and Electro Technology
- CRS276 — Bachelor in Physical Therapy (Foreign Student) 1St Year
- CRS278 — Bachelor of Na major in Political Science
- CRS322 — Bachelor of Arts in Behavioral Sciences major in Organizational and Social Systems Development and Bachelor of Science in Advertising Management Bachelor of Science in Advertising Management

These remain in the 342 in-scope count until a separately approved title/validity/duplicate decision is made.

## 2. Corrected missing-bachelor review

### `VALID_MISSING_BACHELOR` — 14

1. **Bachelor of Science in Accountancy (BSA)** — Business; high confidence. No standalone BSA exists. CRS232’s concatenated double-degree title is not an adequate substitute. [CHED Accountancy PSG](https://ched.gov.ph/wp-content/uploads/2017/10/CMO-27-s-2017.pdf)
2. **Bachelor of Science in Data Science and Analytics** — Engineering/STEM; high confidence. Existing CS, IT, Statistics, and Mathematics programs are related but not equivalent. [CHED priority program codes](https://ched.gov.ph/wp-content/uploads/CMO-No.-14-S.-2025-Revised-Estatistikolar-guidelines.pdf)
3. **Bachelor of Science in Actuarial Science** — Science & Mathematics; high confidence. [CHED priority program codes](https://ched.gov.ph/wp-content/uploads/CMO-No.-14-S.-2025-Revised-Estatistikolar-guidelines.pdf)
4. **Bachelor of Science in Biochemistry** — Science & Mathematics; high confidence. Biology and Chemistry are not duplicates of this degree. [CHED priority programs](https://ched.gov.ph/wp-content/uploads/20230913-JMC-No-01-S-2023-Implementing-Guidelines-of-the-Scholarship-Program-for-Coconut-Farmers-and-their-Families-CoScho.pdf)
5. **Bachelor of Science in Legal Management** — Legal & Public Service; high confidence. Political Science and Public Administration are not equivalent, and Legal Management must not be presented as a law degree. [CHEDRO XI recognized programs](https://ro11.ched.gov.ph/programs-per-hei/)
6. **Bachelor of Science in Aircraft Maintenance Technology** — Aviation & Maritime; high confidence. Aviation Engineering Technology and avionics majors are related but not equivalent. [CHEDRO XI program inventory](https://ro11.ched.gov.ph/programs-inventory/)
7. **Bachelor of Science in Aviation Electronics Technology** — Aviation & Maritime; high confidence. [CHEDRO XI program inventory](https://ro11.ched.gov.ph/programs-inventory/)
8. **Bachelor of Science in Business Administration major in Marketing Management** — Business; high confidence, conditional on retaining major-level catalog granularity. [CHEDRO XI accredited programs](https://ro11.ched.gov.ph/heis-with-accredited-programs/)
9. **Bachelor of Science in Business Administration major in Operations Management** — Business; high confidence, conditional on retaining major-level granularity. [CHEDRO II recognized programs](https://region2.ched.gov.ph/index.php/recognized-programs-of-private-higher-education-institutions-pheis-in-region-ii/)
10. **Bachelor of Science in Microbiology** — Science & Mathematics; medium-high confidence. Confirm national prevalence/current standard title before approval. [CHED official program reference](https://mimaropa.ched.gov.ph/wp-content/uploads/2023/03/CMO-No.-10-s.-2021.pdf)
11. **Bachelor of Science in Agricultural Biotechnology** — Agriculture & Environmental; medium-high confidence. [CHED priority programs](https://ched.gov.ph/wp-content/uploads/20230913-JMC-No-01-S-2023-Implementing-Guidelines-of-the-Scholarship-Program-for-Coconut-Farmers-and-their-Families-CoScho.pdf)
12. **Bachelor of Science in Demography** — Science & Mathematics; medium confidence; prevalence review required. [CHED priority program codes](https://ched.gov.ph/wp-content/uploads/CMO-No.-14-S.-2025-Revised-Estatistikolar-guidelines.pdf)
13. **Bachelor of Arts in International Studies** — Humanities & Social Science; medium confidence; stronger national prevalence evidence is desirable. [CHEDRO XI recognized programs](https://ro11.ched.gov.ph/programs-per-hei/)
14. **Bachelor of Science in Aviation Management** — Aviation & Maritime; medium confidence; verify the preferred national/current title. [CHEDRO XI recognized programs](https://ro11.ched.gov.ph/programs-per-hei/)

`VALID_MISSING_BACHELOR` means eligible for manual consideration, not approved for addition. Any approved addition must receive a new stable identifier beginning after CRS342 and must not shift existing IDs.

### `ALREADY_REPRESENTED` — 2

- **Bachelor of Science in Computer Science (BSCS)** — already represented by CRS026 `Bachelor of Computer Science`. CHED’s standardized title supports a possible rename review, not a duplicate addition. [CHED computing PSG](https://legacy.ched.gov.ph/wp-content/uploads/2017/10/CMO-no.-25-s.-2015.pdf)
- **Bachelor of Science in Hotel and Restaurant Management** — the family is already represented by CRS053 Hospitality Management and CRS217 Hotel, Restaurant and Tourism Management. Resolve naming overlap before considering another record.

### Rejected previous candidates: `OUT_OF_SCOPE_PROGRAM_LEVEL` — 4

1. **Doctor of Veterinary Medicine (DVM)** — excluded professional doctoral degree. It must not be added even though Philippine materials have described veterinary education as undergraduate-entry. [CHED DVM PSG](https://ched.gov.ph/wp-content/uploads/2017/10/CMO-No.15-s2007.pdf)
2. **Doctor of Dental Medicine (DMD)** — excluded professional doctoral degree. [CHED DMD PSG](https://ched.gov.ph/wp-content/uploads/2018/05/CMO-No.-3-Series-of-2018-Policies-and-Standards-and-Guidelines-for-the-Doctor-of-Dental-Medicine-DMD-Program.pdf)
3. **Doctor of Optometry** — explicitly excluded by the corrected rule, even though CHED describes it as a six-year baccalaureate program. [CHED Optometry PSG](https://ched.gov.ph/wp-content/uploads/2017/10/CMO-No.38-s2007.pdf)
4. **Doctor of Medicine (MD)** — excluded post-baccalaureate professional degree; ordinary admission requires a prior bachelor’s degree and NMAT. [CHED Medical Education PSG](https://legacy.ched.gov.ph/wp-content/uploads/2017/10/CMO-18-s.-2016.pdf)

No professional/doctoral candidate remains in the proposed bachelor additions.

## 3. Duplicate and alias implications

The scope correction does not change the previous duplicate findings:

- 31 high-confidence duplicate groups
- 11 likely duplicate groups requiring review
- 10 related-but-distinct groups that should not be automatically merged
- 18 questionable bachelor-level titles

Program level and deduplication are independent. Two records can both be in-scope bachelor programs and still represent one duplicated degree. Likewise, a malformed title such as CRS278 can clearly declare bachelor level while remaining invalid as a canonical program name.

## 4. Revised bachelor-only search alias strategy

The new alias artifact uses only these target types:

| Target type | Alias groups | Meaning |
|---|---:|---|
| `DIRECT_COURSE` | 4 | One existing bachelor course |
| `COURSE_FAMILY` | 6 | Multiple related bachelor programs |
| `CAREER_PATHWAY` | 8 | Relevant bachelor options plus an explicit further-qualification note |
| `NOT_IN_CATALOG` | 0 | No usable bachelor target; none required in the current proposal because pathway guidance is available |
| `PROPOSED_BACHELOR` | 4 | Missing bachelor candidate pending approval |

There are 22 alias groups and 50 individual search terms.

Key corrected behavior:

- `dermatology`, `dermatologist`, `skin doctor`, `medicine`, `doctor`, `physician`, `surgeon`, and `pediatrician` use `CAREER_PATHWAY`, surfacing possible pre-med bachelor programs with a clear MD/specialty qualification note.
- `lawyer`, `attorney`, and `law` use `CAREER_PATHWAY`. Political Science, Philosophy, Public Administration, or proposed Legal Management may be explored, but none is presented as a law degree.
- `dentist`, `dentistry`, `dental medicine`, `veterinarian`, `veterinary`, `vet`, `optometrist`, and `optometry` use `CAREER_PATHWAY`; DMD, DVM, and Doctor of Optometry are never catalog targets.
- `IT` maps directly to CRS062 only through an exact abbreviation rule. Unrestricted substring matching remains prohibited.
- Generic `computer`, `programming`, `teacher`, and maritime terms return course families rather than manufacturing new canonical programs.
- Accountancy, Data Science, Aircraft Maintenance Technology, and Actuarial Science aliases may target proposed bachelor candidates, but only after approval.

The exact term-to-target mapping is in `course_search_aliases_bachelors_only.json`. No alias was implemented.

## 5. Corrected planning implications

The earlier additions list must not be used because it included four excluded professional degrees. Under the corrected scope:

- starting catalog: 342
- high-confidence duplicate consolidation effect, if approved: minus 33 rows
- valid missing bachelor candidates: up to plus 14
- likely duplicate and questionable-title decisions remain unresolved

A corrected planning range is approximately **307–323**, not a target quota. The upper bound applies the 33 high-confidence duplicate-row reductions and all 14 bachelor candidates. The lower bound allows additional reviewed duplicate/questionable consolidation. Exact count must follow manual decisions and dependency analysis.

## 6. Requested approval lists

### `REVIEW_PROGRAM_LEVEL`

None.

### `OUT_OF_SCOPE` currently in CRS001–CRS342

None.

### `VALID_MISSING_BACHELOR`

- BS Accountancy
- BS Data Science and Analytics
- BS Actuarial Science
- BS Biochemistry
- BS Legal Management
- BS Aircraft Maintenance Technology
- BS Aviation Electronics Technology
- BSBA major in Marketing Management
- BSBA major in Operations Management
- BS Microbiology
- BS Agricultural Biotechnology
- BS Demography
- BA International Studies
- BS Aviation Management

## 7. Safety confirmation

| Check | Result |
|---|---|
| Canonical JSON modified | NO |
| CRS IDs changed | NO |
| Courses deleted | NO |
| Courses added | NO |
| Course names changed | NO |
| Clusters changed | NO |
| Matching profiles changed | NO |
| Recommendation scoring changed | NO |
| Career dataset changed | NO |
| School Locator mappings changed | NO |
| Database/MySQL changed | NO |
| Migrations run | NO |
| Imports run | NO |
| Search logic changed | NO |
| Production touched | NO |
| Commit/push performed | NO |

