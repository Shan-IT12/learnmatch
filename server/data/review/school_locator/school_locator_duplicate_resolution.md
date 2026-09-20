# School Locator Duplicate Resolution

Review date: 2026-09-21  
Scope: import-manifest preparation only; no database import performed.

## Resolution rule

Only High-confidence `EXACT`, `NORMALIZED`, and `MAJOR_OR_SPECIALIZATION` rows with a non-null canonical code were eligible. Within that eligible set, rows were collapsed only when UII, canonical course code, normalized major, original source title, PSCED detail, and academic year were equivalent. The first CSV occurrence was retained for traceability.

## Eleven duplicate source-offering groups

| UII | Offering | Source rows | Manifest resolution | Reason |
|---|---|---:|---|---|
| 03012b | Associate in Computer Technology | 24, 25 | Both excluded | Identical source rows, but both are Low-confidence `UNMATCHED`; neither qualifies for the manifest. |
| 03135 | BS Business Administration major in Human Resource Management | 175, 176 | Both excluded | Identical source rows, but both are Low-confidence `AMBIGUOUS`. |
| 03135 | BS Business Administration major in Marketing Management | 177, 178 | Both excluded | Identical source rows, but both are Low-confidence `AMBIGUOUS`. |
| 03135 | BS Computer Science | 179, 180 | Retain 179; exclude 180 | Same school, CRS026, null major, source title, PSCED detail, and AY; row 180 is a true duplicate. |
| 03135 | BS Elementary Education | 181, 182 | Retain 181; exclude 182 | Same school, CRS035, null major, source title, PSCED detail, and AY; row 182 is a true duplicate. |
| 03135 | BS Entrepreneurship | 183, 184 | Retain 183; exclude 184 | Same school, CRS040, null major, source title, PSCED detail, and AY; row 184 is a true duplicate. |
| 03135 | BS Hospitality Management | 185, 186 | Retain 185; exclude 186 | Same school, CRS053, null major, source title, PSCED detail, and AY; row 186 is a true duplicate. |
| 03135 | BS Secondary Education major in English | 187, 188 | Retain 187; exclude 188 | Same school, CRS290, equivalent `English` major, source title, PSCED detail, and AY; row 188 is a true duplicate. |
| 03135 | BS Secondary Education major in Filipino | 189, 190 | Both excluded | Identical source rows, but both are Low-confidence `AMBIGUOUS`. |
| 03135 | BS Secondary Education major in Mathematics | 191, 192 | Both excluded | Identical source rows, but both are Low-confidence `AMBIGUOUS`. |
| 03135 | BS Secondary Education major in Values Education | 193, 194 | Both excluded | Identical source rows, but both are Low-confidence `AMBIGUOUS`. |

## Five duplicate proposed school/course/major groups

All five occur within the high-confidence eligible set and are the same five true duplicate pairs resolved above:

| Key | Retained | Excluded |
|---|---:|---:|
| 03135 / CRS026 / null | 179 | 180 |
| 03135 / CRS035 / null | 181 | 182 |
| 03135 / CRS040 / null | 183 | 184 |
| 03135 / CRS053 / null | 185 | 186 |
| 03135 / CRS290 / English | 187 | 188 |

Total high-confidence duplicate rows excluded from the manifest: **5**.

## Distinct offerings preserved

No materially different major was collapsed. In particular, First City Providential College has three retained CRS062 rows:

- Source row 130: BS Information Technology, no major
- Source row 131: BS Information Technology, Cyber Security
- Source row 132: BS Information Technology, Software Engineering

These share a school/course pair but are distinct school/course/major combinations and remain separate.

## Result

- Original high-confidence proposals: 128
- True duplicate eligible rows excluded: 5
- Final manifest rows: 123
- Duplicate school/course/equivalent-major combinations remaining: 0
