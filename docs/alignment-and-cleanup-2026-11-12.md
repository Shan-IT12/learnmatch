# Alignment threshold and submission cleanup

- The high-alignment threshold is now inclusive at 70 percent for Early, Mid and End without GWA. The admin monitoring SQL uses the same configured threshold. Scores above 40 and below 70 remain Monitor; 40 and below remain Needs Attention.
- End check-ins with GWA retain the existing combined rule: both alignment of at least 70 and GWA of at least 75 are needed for On Track. Meeting one threshold yields Monitor; meeting neither yields Needs Attention. Numerical alignment percentages and recommendation weights are unchanged.
- Existing persisted check-in analyses/feedback are historical records and were not rewritten. The threshold change applies to newly calculated classifications; admin monitoring calculates its status from the current rule.
- Added `shared/package.json` with `type: module`. The production build succeeds without the previous shared-module/CommonJS warning; no warning-suppression setting or dependency change was used.
- Deleted 84 generated QA screenshots, logs and captured email files (7,228,777 bytes), four generated Vite test/build cache directories, and empty QA directories. Kept database/restore backups, reusable QA scripts and fixtures, dependencies, environment/hosting configuration, source files, tests, and the final paper PDF. No database records were deleted.
- Root output and scratch directories are now excluded from Git and Vercel archives.
- Verification: 40 backend tests passed, one unrelated destructive MySQL integration test skipped; 41 frontend tests passed; frontend lint, production build and whitespace checks passed. Boundary tests cover 40/41, 69/70/71, all phases, GWA 74/75 and an actual five-rating result of exactly 70 percent.
