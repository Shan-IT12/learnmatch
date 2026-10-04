-- Keep every in-progress assessment section attached to its active attempt.
ALTER TABLE ASSESSMENT_ATTEMPT
  ADD COLUMN skill_questions JSON NULL AFTER interests,
  ADD COLUMN personality_answers JSON NULL AFTER skill_result;
