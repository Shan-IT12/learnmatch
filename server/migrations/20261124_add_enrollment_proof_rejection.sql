-- Migration: Add 'rejected' status and enrollment_proof_rejection_reason column to COLLEGE_TRACKING_CYCLE.
-- Safe and idempotent.

ALTER TABLE COLLEGE_TRACKING_CYCLE
  MODIFY COLUMN enrollment_proof_status ENUM('unsubmitted', 'submitted', 'verified', 'rejected') NOT NULL DEFAULT 'unsubmitted';

SET @col_rej := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE'
    AND COLUMN_NAME = 'enrollment_proof_rejection_reason'
);
SET @sql_rej := IF(
  @col_rej = 0,
  'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_rejection_reason VARCHAR(500) NULL',
  'SELECT 1'
);
PREPARE stmt_rej FROM @sql_rej;
EXECUTE stmt_rej;
DEALLOCATE PREPARE stmt_rej;
