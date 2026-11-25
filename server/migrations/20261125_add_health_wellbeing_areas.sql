-- Guidance Counselor Revision: additive multi-select sub-options for Health & Well-being.
-- Existing rows remain NULL and are treated as empty arrays until updated.

ALTER TABLE PROFILE
  ADD COLUMN health_wellbeing_areas JSON DEFAULT NULL AFTER physical_accessibility_difficulties;
