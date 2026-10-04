-- Panel Revision #9: additive structured Personal Factors responses.
-- Legacy boolean and AI-classification columns are intentionally retained.
-- Existing rows remain NULL and receive the neutral 0.50 PF score on recalculation.
-- Rollback (only if deliberately required): drop the seven columns added below.

ALTER TABLE PROFILE
  ADD COLUMN physical_accessibility_areas JSON DEFAULT NULL AFTER factor_others_classification,
  ADD COLUMN physical_accessibility_difficulties JSON DEFAULT NULL AFTER physical_accessibility_areas,
  ADD COLUMN factor_physical_impact TINYINT UNSIGNED DEFAULT NULL AFTER physical_accessibility_difficulties,
  ADD COLUMN factor_health_impact TINYINT UNSIGNED DEFAULT NULL AFTER factor_physical_impact,
  ADD COLUMN factor_financial_impact TINYINT UNSIGNED DEFAULT NULL AFTER factor_health_impact,
  ADD COLUMN factor_family_impact TINYINT UNSIGNED DEFAULT NULL AFTER factor_financial_impact,
  ADD COLUMN factor_work_impact TINYINT UNSIGNED DEFAULT NULL AFTER factor_family_impact;
