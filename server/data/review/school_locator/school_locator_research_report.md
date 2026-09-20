# LearnMatch School Locator Phase 1 Research Report

Generated 2026-09-21. **Review data only — not approved for import.**

## A. Executive summary

All 223 CSV rows and all 13 schools are preserved in the review outputs. Conservative reconciliation produced 128 high-confidence proposed mappings covering 49 canonical courses; 95 rows remain ambiguous or unmatched. The dataset is **PARTIALLY READY**: the 128 high-confidence rows are candidates for human approval, but none should be imported until the CSV's provenance and the detected duplicates are resolved. Five campuses have retained point coordinates; eight have verified street/locality addresses but no sufficiently verified coordinate.

## B. CSV provenance findings

The CSV has 13 columns: `UII`, `HEI_Name`, `HEI_Type`, `HEI_Type2`, `HEI_Province`, `HEI_Municipality_City`, `HEI_Region`, `Full_Program_Name`, `Program_Name`, `Major`, `Detailed_Name`, `F2017PSCED_Discipline_Group`, and `AY`.

- Rows: 223
- Unique schools/UIIs: 13
- Academic year: 2024-25
- UII values: 03196, 03279, 03012b, 03310, 03180, 03303, 03194, 03179, 03135, 03261, 13228, 03003, 03306
- Institution types: Private, SUC, LUC
- Program fields: `Full_Program_Name`, `Program_Name`, and `Major` (101 rows have a non-empty major)
- PSCED fields: `Detailed_Name` and `F2017PSCED_Discipline_Group`; the filename also uses F2017 terminology

CHED Regional Office III masterlists independently corroborate the 13 institutions and many addresses. They do not establish that this exact 223-row file, these UIIs, or the complete AY 2024-25 program list came from CHED. No source URL, download metadata, license, or accompanying documentation exists in the repository.

**Source provenance could not be conclusively verified.**

Provenance record: source organization unknown; source title unknown; repository filename `sjdm_bulacan_courses.csv`; reference year AY 2024-25; verified 2026-09-21; confidence Low. CHED masterlists are corroborating identity evidence, not proof of CSV lineage or every offering.

## C. Canonical mapping results

| Classification | Rows |
|---|---:|
| EXACT | 50 |
| NORMALIZED | 50 |
| MAJOR_OR_SPECIALIZATION | 28 |
| AMBIGUOUS | 74 |
| UNMATCHED | 21 |

The 128 non-null proposals use exact `CRSxxx` identifiers and exact names from the canonical JSON. Normalization was deliberately narrow. Similar-looking programs were not forced into a match when the catalog contained multiple specializations or lacked the same credential level.

## D. Ambiguous and unmatched programs

The row-level JSON contains every occurrence, school, major, PSCED field, and rationale. Unique titles needing review are:

### Ambiguous (74 rows)

- Associate in Retail Technology
- Bachelor in Industrial Technology majors in Automotive, Computer, Drafting/Digital Graphics, Drafting, Electrical, Electronics, Food Processing, and Food Service technologies
- Bachelor of Arts in Religious Studies; BA major in Psychology
- BS Business Administration (general) and majors in Business Economics, HR Development/HR Management, Marketing Management, and Operation(s) Management
- BS Data Science and Analytics major in Geospaial and Big Data
- BS Retail Technology and Consumer Science
- BS/Bachelor of Secondary Education majors in English Education, English minor in Mandarin, combined English/Mathematics/Filipino/Biological Science, Filipino, Mathematics, MAPE, Physical Science(s), Science(s), Social Studies, TLE, and Values Education
- Bachelor of Technical Vocational Teacher Education (general) and Auto Diesel Mechanic
- Bachelor of Technology and Livelihood Education (general)
- Certificate in Two-Year Industrial Technology majors in Automotive, Computer, Drafting/Digital Graphics, Drafting, Electrical, Electronics, Food Service, and Food Technology
- General Engineering

### Unmatched (21 rows)

- Associate in Computer Technology (3 rows)
- Bachelor of Science in Accountancy (5 rows; the catalog only contains a combined Applied Economics/Accountancy title, which was not treated as equivalent)
- Certificate in Teaching Profession
- Diploma in Midwifery and Two-Year Diploma in Midwifery
- Master in Education major in Science
- Master of Arts in Education majors in Educational Management, English, and Mathematics
- Master of Arts in Nursing major in Administration
- Master of Information Technology
- Master of Science in Hospitality Management
- Masters major in Guidance and Counseling
- Masters major in Psychology
- Two-Year Associate in Computer Technology

## E. School identity verification

CHED sources support the existence of all 13 SJDM institutions. Review flags include:

- `Academia de San Lorenzo Dema Ala` → CHED lists **Academia de San Lorenzo Dema-Ala, Inc.**
- `Sienna College of San Jose` → CHED lists **Siena College of San Jose, Inc.**; likely spelling issue
- `Bulacan State University-San Jose Del Monte` is commonly identified as the **Sarmiento Campus**
- Several records omit the incorporated suffix used by CHED
- La Concepcion College has multiple SJDM campuses; the CSV does not identify which campus owns each offering
- Repository UII values were preserved but were not independently confirmed from a public authoritative UII register

No database name was changed.

## F. School location results

- 13/13 schools have a more usable address recorded in the location review.
- 5/13 have retained campus coordinates: BulSU Sarmiento, City College of SJDM, Colegio de San Gabriel Arcangel, First City Providential College, and La Concepcion College (Kaypian main campus).
- 8/13 coordinates remain null rather than using city-center or weakly supported points.
- High geographic confidence: 2; Medium: 11; Low: 0.

BulSU has conflicting published government coordinates and requires a final visual check. La Concepcion is explicitly multi-campus, so one marker cannot safely represent all its offerings without campus-level evidence.

## G. Course-offering evidence quality

Every proposed offering currently cites the repository CSV only. Official CHED identity masterlists and official contact pages validate institutions/addresses, but they do not validate all 223 AY 2024-25 course offerings. No Google Maps or geographic source was used as offering evidence. AY 2024-25 rows must not be presented as guaranteed current offerings.

## H. Integrity checks

- Exactly 223 source rows: PASS
- No source row dropped: PASS
- All non-null codes belong to CRS001-CRS342: PASS
- Canonical names exactly match the source-of-truth JSON: PASS
- No invented codes: PASS
- Majors preserved: PASS
- All 13 schools represented: PASS
- Coordinates valid and campus-specific where retained: PASS, subject to noted final checks
- Offering and geographic sources separated: PASS
- Unique mapped canonical courses: 49
- Canonical courses with no proposed SJDM school: 293
- Schools with at least one high-confidence proposal: 13
- Duplicate source groups: 11 (principally repeated Siena rows plus one BulSU Associate row)
- Duplicate proposed school/course/major groups: 5

## I. Import readiness assessment

**PARTIALLY READY.**

The 128 High-confidence rows are mapping candidates, not import-ready records. They still rely on a repository CSV whose original provenance could not be verified. The 74 ambiguous and 21 unmatched rows must be excluded from an initial locator. Duplicate groups must be adjudicated before import. Only five location records are marker candidates, and BulSU still needs visual confirmation; eight schools need coordinate research.

## J. Manual review items

1. Obtain the original CSV publication/download record or replace it with a documented authoritative dataset.
2. Review all 95 null-code rows with an academic/program specialist.
3. Decide whether canonical parent courses should be added in a future, separately governed catalog process; do not create them during locator import.
4. Resolve the 11 duplicate source groups and five duplicate proposed mapping groups.
5. Confirm UII values from an authoritative UII-bearing source.
6. Verify the Siena/Sienna and Academia Dema-Ala spellings without changing production records prematurely.
7. Determine campus ownership for La Concepcion offerings.
8. Obtain/cross-check eight missing point coordinates and visually verify all five retained points.
9. Seek official AY 2024-25 program lists or catalogs per institution where feasible.

## K. Recommended next step

Conduct a human evidence review of the 128 high-confidence candidates, starting with duplicate removal and school confirmation. In parallel, request the CSV's original source metadata and collect official program pages/catalogs. Only an approved subset with documented offering evidence should later be transformed into an import manifest. Do not start database, API, frontend, or map work yet.

## Evidence references

- CHED RO III HEI masterlist (July 18, 2024): https://www.chedro3.ched.gov.ph/wp-content/uploads/2024/07/Masterlist-as-of-July-18-2024-Download-attachment.pdf
- CHED RO III HEI masterlist (May 15, 2024): https://chedro3.ched.gov.ph/wp-content/uploads/2024/05/Masterlist-as-of-May-15-2024-Download-attachment.pdf
- CHED RO III HEI masterlist (August 31, 2023): https://chedro3.ched.gov.ph/wp-content/uploads/2023/08/Masterlist-as-of-August-31-2023-Download-attachment.pdf
- Bestlink official guidebook: https://guide.bcp.edu.ph/
- La Concepcion official contact/campus page: https://laconcepcioncollege.com/contact-us-2/
- EDCOM II satellite-campus coordinate source: https://edcom2.gov.ph/media/2025/01/11_ALMADEN-Economics-of-Satellite-Campuses.pdf
- DICT regional connectivity site list: https://cms-cdn.e.gov.ph/DICT/pdf/DTS_PICS-PP-Phase-2-Region-3-Bulacan-Pampanga.pdf
- OSM-derived Mapcarta pages are used only for geographic cross-checking.

## Safety

No database operation, migration, application-code change, dependency installation, Maps configuration, secret access, commit, or push was performed. Source CSV and canonical catalog remain unchanged.
