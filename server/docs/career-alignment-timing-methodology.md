# Career Alignment timing methodology (internal)

This document is for implementation, testing, and defense/reference use only. It must not be rendered, linked, summarized, or quoted in the student-facing product.

## Official source boundary

CHED Memorandum Order No. 01, Series of 2011, *Guidelines on Adoption of School Calendar*:
https://ched.gov.ph/wp-content/uploads/2017/10/CMO-No.01-s2011.pdf

The source allows higher education institutions to establish their calendars within CHED guidelines and describes a semestral academic year as at least 36 weeks, or 18 weeks per semester. Institutional calendars can vary.

CHED does not define LearnMatch's Early, Mid, and End tracking phases. The three equal progress bands, approximate-date normalization, initial-phase fallback, tracking states, and trend rules are LearnMatch-designed behavior.

## Internal calculation rules

- Exact and estimated dates use clamped elapsed-term progress. Values from 0 through 0.33 map to Early, values above 0.33 through 0.66 map to Mid, and values above 0.66 map to End.
- Approximate month selections normalize deterministically to day 5 for early, day 15 for middle, and day 25 for late. These are calculation anchors, not official dates.
- A term stores its initial tracking phase. Earlier phases are `not_recorded`; a phase that passed after tracking began is missed but can remain available. Neither state creates a check-in row.
- Trends use completed check-ins only. One completed result is insufficient to state a direction.

The student UI may describe estimated progress as estimated, but must not expose this document's sources, thresholds, formulas, anchor days, or methodology caveats.
