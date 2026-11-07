-- Additive only. Does not authorize or delete any account. Defaults deny deletion.
ALTER TABLE ACCOUNT_INACTIVITY_EMAIL ADD INDEX ix_inactivity_provider (provider_id);

CREATE TABLE ACCOUNT_INACTIVITY_CONTROL (
  control_id TINYINT NOT NULL PRIMARY KEY,
  deletion_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  policy_version VARCHAR(100) NULL,
  scope_version VARCHAR(100) NULL,
  approval_reference VARCHAR(100) NULL,
  backup_review_reference VARCHAR(100) NULL,
  schema_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  approved_until DATETIME(3) NULL,
  CONSTRAINT chk_inactivity_control_id CHECK (control_id = 1)
) ENGINE=InnoDB;
INSERT INTO ACCOUNT_INACTIVITY_CONTROL (control_id) VALUES (1);

CREATE TABLE ACCOUNT_INACTIVITY_CLEARANCE (
  user_id INT NOT NULL PRIMARY KEY,
  generation BIGINT UNSIGNED NOT NULL,
  student_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  excluded BOOLEAN NOT NULL DEFAULT TRUE,
  legal_hold BOOLEAN NOT NULL DEFAULT TRUE,
  retention_hold BOOLEAN NOT NULL DEFAULT TRUE,
  policy_version VARCHAR(100) NOT NULL,
  scope_version VARCHAR(100) NOT NULL,
  review_reference VARCHAR(100) NOT NULL,
  approved_until DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Stores signed delivery events only for this inactivity ledger. No recipient,
-- message body, or raw webhook payload is retained. Parent removal cascades.
CREATE TABLE ACCOUNT_INACTIVITY_DELIVERY (
  event_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  email_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX ix_inactivity_delivery_email (email_id),
  FOREIGN KEY (email_id) REFERENCES ACCOUNT_INACTIVITY_EMAIL(email_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Deliberately no account FK, raw account ID, email, name, or message content.
-- Retention of these pseudonymous receipts must be approved before enablement.
CREATE TABLE ACCOUNT_INACTIVITY_DELETION_AUDIT (
  operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  account_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  policy_version VARCHAR(100) NOT NULL,
  scope_version VARCHAR(100) NOT NULL,
  approval_reference VARCHAR(100) NOT NULL,
  review_reference VARCHAR(100) NOT NULL,
  backup_review_reference VARCHAR(100) NOT NULL,
  notice_evidence_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  deleted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
