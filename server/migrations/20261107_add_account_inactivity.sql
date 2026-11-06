-- Apply before deploying authentication changes. All DATETIME values are UTC.
-- Unknown historical logins receive a fresh observation window, never an inferred login.
ALTER TABLE USER_ACCOUNT
  ADD COLUMN last_successful_login_at DATETIME(3) NULL,
  ADD COLUMN inactivity_tracking_started_at DATETIME(3) NULL,
  ADD COLUMN inactivity_generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN inactivity_warning_sent_at DATETIME(3) NULL,
  ADD COLUMN inactivity_delete_after DATETIME(3) NULL,
  ADD COLUMN inactivity_final_sent_at DATETIME(3) NULL,
  ADD COLUMN inactivity_eligible_at DATETIME(3) NULL,
  ADD INDEX ix_inactivity_login (is_active, last_successful_login_at);

UPDATE USER_ACCOUNT SET inactivity_tracking_started_at = UTC_TIMESTAMP(3)
WHERE inactivity_tracking_started_at IS NULL;

CREATE TABLE ACCOUNT_INACTIVITY_EMAIL (
  email_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  generation BIGINT UNSIGNED NOT NULL,
  stage ENUM('warning','final') NOT NULL,
  email_status ENUM('pending','sending','sent','review') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  first_attempt_at DATETIME(3) NULL,
  last_attempt_at DATETIME(3) NULL,
  provider_id VARCHAR(255) NULL,
  payload JSON NULL,
  UNIQUE KEY uq_inactivity_email (user_id, generation, stage),
  FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
