-- Follow-up for the already-applied additive classification migration.
-- Production currently has no non-NULL classification values.
-- Apply deliberately only after re-verifying that condition and the target database.

ALTER TABLE PROFILE
  MODIFY COLUMN factor_others_classification JSON DEFAULT NULL
    AFTER factor_others_classification_status;
