# Global no-interest answer and pending scoring decision

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

The existing no-interest ranking handling is retained:
`MISSING_INTEREST_SCORING_POLICY` blocks recommendation generation and snapshot
writes when no activity interests are available. Results and Summary explain
that ranking is pending. WSM weights, RIASEC contributions, zero-vector math,
and historical recommendation snapshots are unchanged.

Remaining decision: the panel/project owner must approve the missing-interest
scoring policy before ranking assessments without activity-interest signals.
