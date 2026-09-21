-- Persist the validated interpretation of PROFILE.factor_others separately from
-- both the student's original text and manually selected factor booleans.
-- Apply deliberately only after verifying the target database connection.

ALTER TABLE PROFILE
  ADD COLUMN factor_others_classification_status VARCHAR(16) DEFAULT NULL
    AFTER factor_others,
  ADD COLUMN factor_others_classification VARCHAR(32) DEFAULT NULL
    AFTER factor_others_classification_status;
