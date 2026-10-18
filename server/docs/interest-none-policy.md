# Global no-interest answer and proportional scoring

New Interests responses use the existing `ASSESSMENT_ATTEMPT.interests` JSON
column: `{ selected: [activity names], noInterests: boolean, updatedAt }`.

The English checkbox “No interests or hobbies” sits above the activity categories.
Checking it clears all activities and disables activity selection. Unchecking it
enables activities again with an empty selection. Students can continue with the
checkbox checked or one through ten selected activities. Categories are optional.
An unchecked checkbox with no activities is an unanswered draft.

The existing session storage, serialized attempt autosaves, refresh/resume, and
fresh-retake behavior persist the boolean with the selected activities. Legacy
activity arrays remain readable. Earlier category drafts are read compatibly:
all categories answered None with no activities maps to the checked global box;
activity selections are preserved otherwise. No historical rows are rewritten.

The checkbox never enters `INTEREST_RESPONSE` or the RIASEC map. Completed
attempts remain completion evidence even with zero activity responses. The
Summary displays the global no-interest answer.

The approved no-interest policy excludes interests and normalizes the remaining
weights proportionally per cluster for both cluster selection and course ranking:

`score = (skills * Ws + personality * Wp + personalFactors * Wf) / (1 - Wi)`

This applies only when the completed attempt linked to the personality assessment
explicitly records `noInterests: true` and an empty selected list. Blank or missing
responses remain incomplete. Responses with activities retain the original scoring.

The API returns `interests_available: false`, including on saved snapshots. The
existing non-null interest-match snapshot column stores zero as an unused
placeholder; it contributes nothing to scoring and is displayed as Not used.
Explanations exclude it from strengths and development suggestions. Results explain
that recommendations use skills, personality, and personal factors. Historical
snapshots are not recalculated or rewritten. No database migration is required.
