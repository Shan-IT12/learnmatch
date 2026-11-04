-- Additive only. Requires explicit approval before production execution.
CREATE TABLE IF NOT EXISTS CHECKIN_REMINDER_PREFERENCE (
  user_id INT NOT NULL PRIMARY KEY,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CHECKIN_REMINDER (
  reminder_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  term_id INT NOT NULL,
  phase ENUM('Early','Mid','End') NOT NULL,
  stage ENUM('upcoming','due','overdue') NOT NULL,
  due_date DATE NOT NULL,
  read_at DATETIME NULL,
  email_status ENUM('pending','sending','sent','review') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  first_attempt_at DATETIME NULL,
  last_attempt_at DATETIME NULL,
  provider_id VARCHAR(255) NULL,
  payload JSON NULL,
  UNIQUE KEY uq_checkin_reminder (user_id, term_id, phase, stage, due_date),
  FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES COLLEGE_TERM(term_id) ON DELETE CASCADE
) ENGINE=InnoDB;
