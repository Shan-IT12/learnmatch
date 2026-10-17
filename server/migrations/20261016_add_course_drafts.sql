-- Phase 1 only. Apply manually after backup and schema verification; not run by the app.
-- Verified locally: MySQL 8/InnoDB, COURSE.course_id INT AUTO_INCREMENT,
-- course_code VARCHAR(10) UNIQUE (uq_course_code); profile tables have unique
-- (course_id, skill_domain)/(course_id, riasec_type), evidence TEXT and course FKs.
-- Existing rows retain IDs, codes, active status and profiles. No backfill/import.
ALTER TABLE COURSE
  ADD COLUMN is_draft TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN program_duration_years TINYINT UNSIGNED DEFAULT NULL,
  ADD COLUMN year_levels JSON DEFAULT NULL,
  ADD CONSTRAINT chk_course_draft_inactive CHECK (is_draft = 0 OR is_active = 0);

CREATE TABLE COURSE_CODE_ALLOCATOR (
  allocator_id TINYINT NOT NULL PRIMARY KEY,
  next_number INT UNSIGNED NOT NULL,
  CONSTRAINT chk_course_allocator_singleton CHECK (allocator_id = 1)
) ENGINE=InnoDB;

-- Seed above existing numeric CRS codes; application locks this row for every save.
INSERT INTO COURSE_CODE_ALLOCATOR (allocator_id, next_number)
SELECT 1, GREATEST(361, COALESCE(MAX(CAST(SUBSTRING(course_code, 4) AS UNSIGNED)), 0) + 1)
FROM COURSE WHERE course_code REGEXP '^CRS[0-9]+$';
