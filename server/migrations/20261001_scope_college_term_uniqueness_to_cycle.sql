-- Lifecycle-aware term identity. Apply after 20260930_add_college_tracking_cycles.sql.
-- Modern terms may repeat the same academic stage in different tracking cycles,
-- while duplicate stages remain forbidden inside one cycle. Legacy NULL-cycle
-- rows retain the original user/course/stage protection through a generated key.

ALTER TABLE COLLEGE_TERM
  DROP INDEX uq_college_term_student_stage,
  ADD COLUMN legacy_user_id INT GENERATED ALWAYS AS (
    CASE WHEN tracking_cycle_id IS NULL THEN user_id ELSE NULL END
  ) STORED AFTER tracking_cycle_id,
  ADD UNIQUE KEY uq_college_term_cycle_stage
    (tracking_cycle_id, academic_year, year_level, term_code),
  ADD UNIQUE KEY uq_college_term_legacy_stage
    (legacy_user_id, course_id, academic_year, year_level, semester);
