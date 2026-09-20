# LearnMatch Canonical Course Catalog Coverage and Deduplication Audit

Audit date: 2026-09-21  
Scope: read-only audit of all 342 records in `server/data/learnmatch_courses_final_342_with_ids.json`.  
Prior evidence reviewed: the Course Explorer data-quality report and contamination appendix. No database connection was made.

## 1. Executive conclusion

The 342-record catalog is structurally intact but is **not yet a defensible 342-distinct-program catalog** and is **not sufficiently complete for common Philippine student searches**.

- All CRS001–CRS342 identifiers are present and unique, but 31 high-confidence duplicate groups represent about 33 excess records if each group is consolidated to one stable survivor.
- A further 11 groups are likely duplicates requiring academic/regulatory review. Ten related-but-distinct groups and five negative-control groups were explicitly preserved to avoid over-merging.
- Eighteen existing titles are questionable because they are malformed, combine multiple degrees, encode a cohort/delivery mode/minor as a course, or lack credible course-specific support.
- Twelve missing candidates have high-confidence Philippine relevance. Six additional candidates need either scope or prevalence review.
- Engineering/STEM holds 112 of 342 records (32.7%), with a heavy concentration of parent/major/title variants; several common health, business, science, legal, and aviation programs are absent.
- “Complete” should mean useful coverage of major Philippine program families, not every local specialization. Majors should be added only where LearnMatch intentionally recommends at that granularity.

The machine-readable companion files contain the full 342-row normalized inventory, every classified duplicate group, missing-program evidence, and 48 proposed alias terms.

## 2. Method and normalized inventory

Every canonical row was inventoried with:

- CRS code
- canonical name
- abbreviation
- existing LearnMatch cluster
- inferred program type
- comparison-only normalized name

Normalization lowercased text, removed punctuation/parenthetical abbreviation suffixes, standardized whitespace, and reduced obvious `Bachelor of Science`/`Bachelor in` wording. It did **not** change source data. String normalization generated candidates; final classifications used program meaning, degree type, major/specialization structure, descriptions, abbreviations, and Philippine regulatory context.

The full normalized inventory is embedded in `course_catalog_duplicate_candidates.json`.

## 3. Duplicate and semantic-overlap findings

### Classification totals

| Classification | Groups |
|---|---:|
| High-confidence duplicate | 31 |
| Likely duplicate — requires review | 11 |
| Related but distinct | 10 |
| Distinct controls | 5 |

The 31 high-confidence groups would reduce the catalog by 33 rows if one survivor per group were eventually retained. That is a proposal impact, not an executed change.

### High-confidence duplicate groups

The strongest cases are:

- CRS024/025 Computer Engineering
- CRS035/036 Elementary Education
- CRS054/219 Human Services
- CRS055/222 Industrial Design
- CRS072/248 Marine Transportation
- CRS075/256 Mechanical Engineering
- CRS076/077 Medical Technology / Medical Laboratory Science (the same synonymous titles reversed)
- CRS083/267 Nursing
- CRS098/284 Radiologic Technology
- CRS103/293 Industrial Security Management
- CRS107/300 Special Needs Education
- CRS102/290/292 Secondary Education major in English
- CRS139/188 Culture and Arts Education
- CRS143/144/191 Electronics and Communication(s) Engineering
- CRS150/151 English Education
- CRS153/157 Environmental and Sanitary Engineering
- CRS109/159 Exercise and Sports Science(s)
- CRS163/164 Filipino Education
- CRS173/174 Geodetic Engineering (`Geiodetic` is an apparent typo)
- CRS175/211 Civil Engineering major in Geotechnical Engineering
- CRS200/201 Industrial Technology major in Foods/Foods Technology
- CRS224/225 Information and Communication(s) Technology
- CRS228/229 Information Systems
- CRS253/254 Mathematics Education
- CRS264/265 Music Education
- CRS302/304 Sports Science
- CRS315/316 Civil Engineering major in Transportation Engineering
- CRS317/318 Civil Engineering major in Water Resource(s) Engineering
- CRS328/329 Industrial Technology major in Computer Technology
- CRS337/338 Industrial Technology major in Electronics
- CRS340/341 Industrial Technology major in Electronics and Communications Technology

### Likely duplicates requiring review

- CRS046/165/166 Fine Arts: likely overlapping, but BFA/BS/BA degree structures may differ.
- CRS057/058/060 Service Management: minor/specialization and Industrial versus Industrial Management Engineering wording differ.
- CRS090/275 Physical Education: likely a regulatory-era naming variant, but BPEd versus BS needs confirmation.
- CRS094/281 Psychology: generic Bachelor of Psychology probably overlaps BS Psychology, but its degree structure is unclear.
- CRS123/170/171/172/197/205/206 fashion/apparel/garments Industrial Technology: heavily overlapping; E-TEEAP is a pathway, not a discipline.
- CRS133/138/326 Civil Engineering Technology: likely degree-title variants.
- CRS146/240/241 Engineering Management / Management Engineering / Management Science and Engineering: meaningful overlap but potentially distinct curricula.
- CRS242/243 Manufacturing Engineering Technology: BS versus BET wording.
- CRS258/259/260 Mechanical Engineering Technology automotive specializations: likely equivalent wording.
- CRS294/295 Sign Language Interpretation/Interpreting: likely same subject, uncertain degree type.
- CRS312/314 Theology: BS Theology and Bachelor of Theology may be variants, but seminary/theological degree structures require review.

### Related but distinct—do not automatically merge

- BA versus BS Economics and BA versus BS Psychology.
- Public Administration BA/BS/BPA variants pending program-definition review.
- Social Science versus Sociology.
- Christian Education, Values Education, Religious Education, and Theology.
- Parent Civil Engineering versus its genuine geotechnical, structural, transportation, and water-resources specializations.
- Parent Environmental Science versus coastal, ecosystem, planning, heritage, natural-resource, and resource-management majors.
- General Exercise and Sports Sciences versus Fitness and Sports Coaching.
- Instrumentation and Control Engineering versus Engineering Technology.
- Chemistry versus Chemical Engineering; Computer Science versus IT versus Computer Engineering; Marine Biology versus Marine Science.

The complete reasoning and proposed survivor for every group is in `course_catalog_duplicate_candidates.json`.

## 4. Program/profession/specialization boundary

| Search concept | Classification | Catalog action |
|---|---|---|
| Veterinary / veterinarian | DVM program plus profession | Add DVM only after approval; aliases point to it. |
| Dentistry / dentist | DMD program plus profession | Add DMD only after approval; aliases point to it. |
| Medicine / physician | Post-baccalaureate professional MD plus profession | Scope decision; do not label as undergraduate. |
| Dermatology / dermatologist | Medical specialization/occupation | Alias or pathway guidance only; never create a Dermatology bachelor’s degree. |
| Surgeon / pediatrician | Medical specialties/occupations | Medicine pathway guidance only. |
| Lawyer | Occupation reached through legal education | Do not alias to Political Science as though equivalent; provide a JD/law pathway. |
| Architect | Occupation tied to existing Architecture | Alias to CRS125. |
| Psychologist | Occupation related to BA/BS Psychology, with further qualification considerations | Alias to the Psychology family with a qualification caveat. |
| Teacher | Occupation spanning many Education programs | Cluster/facet alias, not one canonical course. |

This distinction prevents popular career terms from inflating the catalog with non-degree records.

## 5. Philippine relevance and known gaps

Authoritative evidence confirms:

- CHED’s veterinary PSG names the degree **Doctor of Veterinary Medicine** and expressly frames it as undergraduate veterinary education; PRC regulates the profession. [CHED DVM PSG](https://ched.gov.ph/wp-content/uploads/2017/10/CMO-No.15-s2007.pdf), [PRC Veterinary Medicine](https://www.prc.gov.ph/veterinary-medicine)
- CHED’s current dental PSG names **Doctor of Dental Medicine (DMD)**; PRC regulates Dentistry. [CHED DMD PSG](https://ched.gov.ph/wp-content/uploads/2018/05/CMO-No.-3-Series-of-2018-Policies-and-Standards-and-Guidelines-for-the-Doctor-of-Dental-Medicine-DMD-Program.pdf), [PRC Dentistry](https://www.prc.gov.ph/dentistry)
- CHED describes **Doctor of Optometry** as a baccalaureate program of at least six years. [CHED Optometry PSG](https://ched.gov.ph/wp-content/uploads/2017/10/CMO-No.38-s2007.pdf)
- Standard **Doctor of Medicine** admission requires a prior baccalaureate degree and NMAT, so it is a post-baccalaureate professional program for ordinary scope decisions. [CHED Medical Education PSG](https://legacy.ched.gov.ph/wp-content/uploads/2017/10/CMO-18-s.-2016.pdf)
- CHED recognizes BSCS, BSIS, and BSIT as distinct programs. The catalog’s CRS026 `Bachelor of Computer Science` covers the CS family but should be title-reviewed rather than duplicated. [CHED CMO No. 25, s. 2015](https://legacy.ched.gov.ph/wp-content/uploads/2017/10/CMO-no.-25-s.-2015.pdf)
- Current official CHED materials identify Data Science and Analytics and Actuarial Science as priority programs. [CHED 2025 program codes](https://ched.gov.ph/wp-content/uploads/CMO-No.-14-S.-2025-Revised-Estatistikolar-guidelines.pdf)
- CHED priority materials and official program inventories support Biochemistry, Accountancy, Legal Management, aviation technology programs, and BSBA majors. [CHED priority programs](https://ched.gov.ph/wp-content/uploads/20230913-JMC-No-01-S-2023-Implementing-Guidelines-of-the-Scholarship-Program-for-Coconut-Farmers-and-their-Families-CoScho.pdf), [CHEDRO XI program inventory](https://ro11.ched.gov.ph/programs-inventory/)

### Group A — proposed additions

High confidence (12):

| Proposed program | Type | Suggested cluster | Why |
|---|---|---|---|
| Doctor of Veterinary Medicine | Direct-entry professional/undergraduate | Healthcare Science | Regulated, common, wholly absent. |
| Doctor of Dental Medicine | Direct-entry professional | Healthcare Science | Regulated, common, wholly absent. |
| Doctor of Optometry | Six-year baccalaureate professional | Healthcare Science | Explicit CHED baccalaureate program, absent. |
| BS Accountancy | Undergraduate | Business | Major regulated degree; CRS232’s concatenated double degree is not a substitute. |
| BS Data Science and Analytics | Undergraduate | Engineering/STEM | Current high-demand, officially recognized computing/data program. |
| BS Actuarial Science | Undergraduate | Science & Mathematics | Official priority mathematics/professional program. |
| BS Biochemistry | Undergraduate | Science & Mathematics | Recognized science program distinct from Biology/Chemistry. |
| BS Legal Management | Undergraduate | Legal & Public Service | Recognized common pre-law/business-law program. |
| BS Aircraft Maintenance Technology | Undergraduate | Aviation & Maritime | Common recognized aviation program. |
| BS Aviation Electronics Technology | Undergraduate | Aviation & Maritime | Recognized program distinct from generic ECE. |
| BSBA major in Marketing Management | Undergraduate major | Business | Common BSBA major; catalog already models other majors. |
| BSBA major in Operations Management | Undergraduate major | Business | Common BSBA major absent from otherwise granular business coverage. |

Medium/lower confidence (6): Doctor of Medicine (scope decision), BS Microbiology, BS Agricultural Biotechnology, BS Demography, BA International Studies, and BS Aviation Management. Their evidence and caveats are recorded in `course_catalog_missing_candidates.json`.

If approved, additions must start at **CRS343** and continue without shifting an existing identifier.

## 6. Coverage by LearnMatch cluster

| Cluster | Count | Strengths | Suspected gaps | Overrepresentation / duplicate concentration |
|---|---:|---|---|---|
| Healthcare Science | 16 | Nursing, therapies, laboratory science, pharmacy, allied health | DVM, DMD, Optometry; MD only if scope expands | Duplicate Nursing, Med Tech/MLS, Radiologic Technology; invalid PT cohort title |
| Humanities & Social Science | 39 | Psychology, language, communication, sociology, theology | International Studies (medium) | Theology/English/Human Services variants; some records belong elsewhere |
| Business | 19 | Finance, HRDM, entrepreneurship, office/admin, real estate | Accountancy, BSBA Marketing, BSBA Operations | Combined Accountancy record; Office Administration variants; undercoverage despite common demand |
| Hospitality & Tourism | 3 | Hospitality and Tourism core | Culinary-specific programs only if national/common enough | Very low count; BSHM versus Hotel/Restaurant/Tourism naming needs review |
| Aviation & Maritime | 13 | Aeronautical/aerospace, marine transport/engineering | Aircraft Maintenance Technology, Aviation Electronics; Aviation Management (medium) | Duplicate Marine Transportation; several unsupported compound titles |
| Legal & Public Service | 9 | Political Science, Public Administration, Customs | Legal Management; JD is a professional scope question | Public Administration variants; malformed CRS278 |
| Education | 41 | Broad teacher-education and subject majors | No urgent parent-family gap; audit missing common BSEd majors before additions | High title/major duplication: English, Filipino, Math, SPED, Culture/Arts, Home Economics |
| Arts & Multimedia | 25 | Multimedia, design, fine/performing arts | General Music may need verification | Fine Arts, Industrial Design, and fashion/apparel duplication |
| Criminology | 5 | Criminology, forensic/security programs | Public-safety/law-enforcement programs need prevalence review | Criminology and Industrial Security naming variants |
| Agriculture & Environmental | 37 | Agriculture, fisheries, forestry, environmental science | Agricultural Biotechnology (medium) | Multiple near-identical ABE, agriculture, resource-management, and food-science variants |
| Science & Mathematics | 15 | Core biology, chemistry, physics, math, statistics | Actuarial Science, Biochemistry; Microbiology/Demography (medium) | Underrepresented relative to Engineering; few duplicate issues |
| Sports & Physical Education | 8 | PE, sports/exercise science, coaching, esports | No urgent major family gap | Sports Science and PE duplicates; esports scope should be verified |
| Engineering/STEM | 112 | Very broad engineering, IT, and technology coverage | Data Science and Analytics | Severe overrepresentation of institution-level majors/title variants; many duplicate groups |

## 7. Suspicious/questionable existing programs

Eighteen records require evidence or title repair before they can be treated as stable distinct programs:

- CRS020 redundant `Major in Civil`; CRS033 redundant self-major.
- CRS043 legacy/unclear Family Economics wording.
- CRS057 encodes a minor as a separate course.
- CRS059/060 unsupported composite Industrial Management Engineering minors.
- CRS114 malformed casing and taxonomy commentary in the name.
- CRS127 unusual BA major in Biology requiring recognized-program evidence.
- CRS149 malformed `Bachelor in Arts in English`.
- CRS173 misspelled `Geiodetic`.
- CRS180 repeats Aviation Engineering Technology as degree and major.
- CRS196 unexplained `Envet` label with no course-specific PSG.
- CRS206 embeds E-TEEAP, a delivery/equivalency pathway, in the degree identity.
- CRS232 concatenates Applied Economics and Accountancy into one canonical record.
- CRS245 compound Marine Engineering and Electro Technology title requires evidence.
- CRS276 `Foreign Student 1St Year` is a cohort/year label, not a degree.
- CRS278 contains the placeholder/malformed `Bachelor of Na`.
- CRS322 concatenates multiple degrees and repeats Advertising Management.

These are flags, not deletion decisions. Several also participate in duplicate groups, so they must not be double-counted in target-size calculations.

## 8. Group B — proposed duplicate merges/removals

Only the 31 high-confidence groups should enter a first adjudication queue. Each proposed survivor in the JSON was chosen for clearer canonical wording, a recognized abbreviation, or fewer formatting defects—not because its CRS number is intrinsically preferred.

Every proposed merge/removal has these downstream impacts:

1. **Matching profiles and recommendation logic:** references to retired codes must be redirected to the survivor and tested for score/rank changes.
2. **Saved/recommended course relationships:** foreign keys or stored codes must be migrated; history should retain an alias/tombstone from retired code to survivor.
3. **Career/year-level enrichment:** duplicate enrichment records must be reconciled semantically, not merely discarded.
4. **School Locator:** SCHOOL_COURSE mappings for all group members must be unioned onto the survivor while preserving distinct majors and avoiding duplicate school/course/major identities.
5. **Database:** COURSE and dependent tables require a transaction, preflight counts, referential checks, and rollback; hard deletion should not precede reference migration.
6. **URLs/API/search:** old CRS URLs should continue resolving through an explicit code alias/redirect policy.

Group-specific risk is highest for CRS076/077 (synonymous regulated names and potentially split references), CRS083/267 (Nursing school mappings), the three-record Education/ECE groups, and large fashion/apparel clusters. Parent degrees must not absorb genuine specializations. No existing code should be renumbered.

## 9. Group C — search aliases only

The alias appendix proposes **22 alias groups containing 48 search terms**. Key policies:

- `IT` must be an exact abbreviation alias for CRS062, not an arbitrary substring.
- `computer`/`computing` should return a family facet across CS, IT, IS, and Computer Engineering.
- `programming`, `coder`, and `software developer` are skill/career aliases to ranked computing alternatives.
- `psych` and `psychologist` point to the Psychology family without collapsing BA/BS.
- `accounting`, `accountant`, `CPA`, `accountancy`, and `BSA` should prefer a future BS Accountancy record while showing Management Accounting as a distinct alternative.
- `lawyer`, `law`, and `attorney` should show legal-education pathway guidance, not silently map to Political Science.
- `dermatology`, `surgeon`, and `pediatrician` are medical specialization/career concepts, never new bachelor records.

The full list is in `course_search_alias_candidates.json`; no alias was implemented.

## 10. Impact of proposed additions

Each approved addition requires: a new CRS343+ identity; canonical description, skills, careers, sources, duration/year-level enrichment; matching-profile coverage; recommendation regression tests; COURSE synchronization; Course Explorer search/detail validation; and independently evidenced School Locator offerings. An addition must not inherit schools merely because a similarly named program exists.

MD deserves separate scope treatment: the ordinary Philippine pathway is post-baccalaureate, so adding it would broaden LearnMatch beyond undergraduate-first recommendations. DVM, DMD, and Optometry use doctoral titles but are direct-entry/baccalaureate-level professional programs in the cited Philippine frameworks and fit Grade 12 exploration more naturally.

## 11. Recommended sequence

1. Approve or reject duplicate classifications; establish code-alias/tombstone policy before data mutation.
2. Validate questionable titles against original provenance and current recognized-program evidence.
3. Approve the 12 high-confidence additions individually and decide whether MD is in scope.
4. Implement token-aware aliases independently of catalog additions.
5. Draft a migration plan with dependency counts; only then change canonical data and synchronize the database in a separately authorized phase.

## 12. Final summary

| Metric | Result |
|---|---:|
| Current canonical count | 342 |
| High-confidence duplicate groups | 31 |
| Likely duplicate groups needing review | 11 |
| Related-but-distinct groups reviewed | 10 |
| Distinct control groups reviewed | 5 |
| Questionable existing programs | 18 |
| High-confidence missing candidates | 12 |
| Lower-confidence/scope-dependent missing candidates | 6 |
| Proposed search alias groups | 22 |
| Proposed search terms | 48 |

Recommended future target catalog count: **305–327**, as a planning range only. The range starts from 342, accounts for 33 high-confidence duplicate rows, allows some—but not all—likely duplicate/questionable removals without double-counting, and adds 12 high-confidence plus zero-to-six scope-dependent programs. The eventual number must follow record-by-record adjudication, not a quota.

## 13. Safety confirmation

| Check | Result |
|---|---|
| Canonical JSON modified | NO |
| Courses added | NO |
| Courses removed | NO |
| Courses renamed | NO |
| CRS IDs changed | NO |
| Matching profiles changed | NO |
| Career dataset changed | NO |
| School Locator mappings changed | NO |
| Database changed | NO |
| Search logic changed | NO |
| Recommendation engine changed | NO |
| Commit/push performed | NO |

