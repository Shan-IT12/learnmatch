-- Recommendation snapshot persistence support.
-- Apply deliberately to the target database after verifying the connection.

ALTER TABLE RECOMMENDATION
  ADD CONSTRAINT uq_recommendation_user_assessment
    UNIQUE (user_id, assessment_id);

ALTER TABLE RECOMMENDATION_ITEM
  ADD COLUMN skill_match DECIMAL(5,4) NOT NULL AFTER match_score,
  ADD COLUMN interest_match DECIMAL(5,4) NOT NULL AFTER skill_match,
  ADD COLUMN personality_match DECIMAL(5,4) NOT NULL AFTER interest_match,
  ADD COLUMN personal_factor_match DECIMAL(5,4) NOT NULL AFTER personality_match,
  ADD CONSTRAINT uq_recommendation_item_rank
    UNIQUE (recommendation_id, rank_position),
  ADD CONSTRAINT uq_recommendation_item_course
    UNIQUE (recommendation_id, course_id);
