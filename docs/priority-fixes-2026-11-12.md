# High priority security and assessment fixes

Implemented locally on November 12, 2026. No deployment or production database writes were performed.

## Changes

- Student JWTs carry a keyed password-state fingerprint. Authentication compares it with the current stored password hash. A password reset therefore rejects all earlier student tokens, including resets within the same second. The hash itself is never placed in the JWT. No database migration is required. Pre-upgrade student sessions must sign in again after deployment; admin sessions are unaffected.
- Quiz submission requires an explicit owned, in-progress assessment attempt. Questions must be active and contain five items in each of the six supported domains. Submitted answers must match the saved question IDs. Duplicate finalization remains blocked. The former no-attempt submission path is rejected at entry.
- Draft saves require an owned active attempt and validate question sets, partial skill answers, and personality item IDs/ratings. Question display content is loaded from the database rather than trusted from the request. Existing saved question IDs cannot be replaced. Partial answers remain supported; completed skill answers cannot be overwritten through autosave.
- The isolated API harness was corrected to use personality item IDs 1 through 40, matching the real frontend rather than its earlier synthetic 0-based keys.

## Verification

- Backend: 34 tests passed, 1 unrelated destructive MySQL test skipped.
- Frontend: 41 tests passed.
- Real Express/MySQL API: 10 workflow groups passed in the isolated QA schema.
- Real browser: 7 workflow groups passed, plus no captured runtime exceptions/API 5xx. Includes registration, activation, login, Personal Factors, Interests, all 30 Skills questions, all 40 Personality questions, results, history, College views and admin draft entry.
- Service checks: 45 persisted recommendation item scores recalculated successfully; simulated AI success/failure preserved ranks/scores; captured reminder delivery obeyed preferences and duplicate prevention.
- Targeted real API checks passed: malformed draft rejection; valid partial-save/resume; missing-attempt rejection; substituted-question rejection; valid bound quiz acceptance; pre-reset token rejection; reset-authorization replay rejection; fresh login after reset.
- Backend syntax and git whitespace checks passed.

Evidence scripts/results remain in the ignored `.local-backups/priority-fixes-20261112/` and existing isolated QA directories. Email delivery was captured locally and AI responses simulated. No real-provider or authenticated production acceptance run is claimed.
