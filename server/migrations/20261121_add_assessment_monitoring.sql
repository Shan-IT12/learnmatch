-- Optional webcam monitoring metadata for student assessments. Additive only:
-- no video, photo or audio is ever stored, and existing rows keep camera_enabled = 0.
CREATE TABLE IF NOT EXISTS assessment_monitoring_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  attempt_id INT NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  assessment_step VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_monitoring_attempt (attempt_id, created_at),
  KEY idx_monitoring_user (user_id),
  KEY idx_monitoring_created (created_at),
  CONSTRAINT fk_monitoring_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_monitoring_attempt FOREIGN KEY (attempt_id) REFERENCES ASSESSMENT_ATTEMPT(attempt_id) ON DELETE CASCADE
);

-- 0 = Standard (no camera), 1 = Verified (camera on). MySQL has no ADD COLUMN IF NOT EXISTS;
-- scripts/applyAssessmentMonitoringMigration.mjs skips this statement when the column exists.
ALTER TABLE ASSESSMENT_ATTEMPT ADD COLUMN camera_enabled TINYINT(1) NOT NULL DEFAULT 0;
