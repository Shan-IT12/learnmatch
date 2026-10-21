# Privacy transparency wording review

Notice version: 1.0. Review date: 2026-10-21 (Asia/Singapore).
Internal publication review; this document is not public-page content.

## Verified implementation facts

- `controllers/authController.js`: account emails use the Resend endpoint and send
  recipient email, sender, subject and HTML message. Password storage uses bcrypt.
- `services/recommendationExplanationService.js`: the conditional OpenAI integration
  sends rank, course name/category, match score, strongest component summaries and
  development area. It does not serialize the whole recommendation/student object.
- `services/collegeMismatchExplanationService.js`: the conditional OpenAI integration
  sends deterministic status, alignment percentage, phase, dimension scores and GWA
  (null if omitted). On Track uses deterministic feedback. These are result-derived
  payloads, not anonymous data. No zero-retention/training claim is made.
- `services/directionsService.js`, `client/src/pages/SchoolLocator.jsx` and
  `client/src/components/ActionConfirmationModal.jsx`: directions confirmation precedes
  browser geolocation; origin/destination coordinates go through the backend to
  OpenRouteService at HeiGIT. `SchoolLocatorMap.jsx` loads OpenStreetMap tiles.
- Current profile collection uses structured choices. `factor_others` and its retired
  classification fields are excluded from GET /api/profile, but historical fields
  and snapshots are not erased. No active Others classification flow was found.
- Interests, Skills and Personality use browser drafts and server autosave. Profile
  Personal Factors use the explicit Save action. Browser cleanup does not delete
  server records. Administrative account/summary and identifiable feedback access
  remains unchanged.
- Aggregate-only thesis/defense use and the research-team contact were confirmed by
  the project owner; this UI change does not restrict or expand research access.

## Wording withheld pending verification

`client/vercel.json` defines Vercel headers/SPA rewriting and permits Railway API
origins. `server/config/db.js` uses environment-selected MySQL. These files do not
prove current live hosting, database ownership/location, processor arrangements or
which optional integrations are enabled. No secret values, provider dashboards or
real student records were accessed in this review.

The earlier proposed sentence naming Vercel for hosting and Railway for backend and
database hosting is therefore withheld from the public notice. The public page
describes hosting/database functions generically. Review and publish the precise
provider inventory once current deployment bindings are confirmed. Other named
integrations are grounded in hard-coded service endpoints; AI wording is explicitly
conditional. Recheck all provider/payload wording whenever those integrations change.

## Outstanding publication decisions

- Formal controller identity, institutional responsibilities and institutional review.
- Justified retention schedule for drafts, profiles, legacy free text, history,
  feedback, logs and backups; no cleanup is implemented here.
- Mailbox ownership, identity verification, request handling and feasible rights
  procedures. Email is only a questions/requests channel, not automated deletion or
  evidence of a completed rights-request workflow.
- Provider agreements, processing locations, logs/backups and AI retention/training
  settings. Exact hosting provider names remain withheld as described above.
- Aggregate thesis-output handling, including identification risks in small groups.
- Minor/guardian procedures remain a separate deferred task.

## Preview requirements

Use synthetic data only. Check public /privacy without a token; registration values
remain available when returning from the same-tab notice; all notice links work by keyboard.
At the owner's request, the added assessment information panels and reminders were
removed to preserve the original assessment layout. Check direct visits and retakes,
and check all three
results surfaces and 360px mobile layout. Browser preview was unavailable in this
session and must not be represented as an interactive check.

## Checks completed for this local change

- The initial 39 client checks passed. After removing the assessment privacy panels,
  focused tests cover public notice/link rendering, unchanged assessment controls
  for fresh and retake progress, navigation and all three disclaimer placements.
- 108 server tests passed with synthetic dependencies, including exact explanation
  payload boundaries, optional GWA, profile, drafts, recommendations and history.
- Targeted ESLint, production build and whitespace checks passed. Existing Vite
  test-port and production chunk-size warnings remain.
- Local production-preview HTTP requests returned 200 for /privacy, /register and /.
  This checks SPA route delivery, not interactive browser rendering.
- Privacy links now navigate in the same tab. App retains the originating route
  hidden and mounted, using its original transition key, while showing the notice.
  The notice return button uses browser history; returning restores focus to the
  original link. Form values remain in React memory, not new browser persistence.
  Route retention and return-button markup are covered by source/render checks.
  Keyboard semantics/focus styles and mobile wrapping,
  content scrolling, responsive spacing and long-email wrapping were source/render
  inspections. No interactive typing, keyboard traversal or mobile screenshot
  preview was available.
