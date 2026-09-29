-- Adds non-destructive academic-calendar metadata to the existing term model.
-- Existing semester/display columns and historical SEMESTER_CHECKIN labels remain unchanged.

ALTER TABLE COLLEGE_TERM
  ADD COLUMN calendar_type ENUM('semester','trimester','legacy') NULL AFTER year_level,
  ADD COLUMN term_code VARCHAR(32) NULL AFTER calendar_type;

UPDATE COLLEGE_TERM
SET calendar_type = 'semester', term_code = 'SEM_1'
WHERE semester = '1st Semester' AND calendar_type IS NULL;

UPDATE COLLEGE_TERM
SET calendar_type = 'semester', term_code = 'SEM_2'
WHERE semester = '2nd Semester' AND calendar_type IS NULL;

UPDATE COLLEGE_TERM
SET calendar_type = 'semester', term_code = 'SUMMER_MIDYEAR'
WHERE semester IN ('Summer', 'Summer/Midyear') AND calendar_type IS NULL;

UPDATE COLLEGE_TERM
SET calendar_type = 'legacy', term_code = 'LEGACY_3RD_SEMESTER'
WHERE semester = '3rd Semester' AND calendar_type IS NULL;

UPDATE COLLEGE_TERM
SET calendar_type = 'legacy', term_code = CONCAT('LEGACY_', term_id)
WHERE calendar_type IS NULL OR term_code IS NULL;

ALTER TABLE COLLEGE_TERM
  MODIFY calendar_type ENUM('semester','trimester','legacy') NOT NULL,
  MODIFY term_code VARCHAR(32) NOT NULL,
  ADD KEY idx_college_term_calendar (calendar_type, term_code);
