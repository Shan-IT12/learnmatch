-- Apply after the existing draft, source review, and publication migrations.
ALTER TABLE ADMIN
  ADD COLUMN email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
  ADD UNIQUE KEY admin_verified_email (email);

CREATE TABLE VALIDATOR_ACCOUNT (
  validator_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) COLLATE utf8mb4_0900_as_cs NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  profession VARCHAR(150) NOT NULL,
  affiliation VARCHAR(255) NOT NULL,
  expertise VARCHAR(500) NOT NULL,
  requested_clusters JSON NOT NULL,
  approved_clusters JSON NULL,
  status ENUM('unverified','pending','correction','rejected','approved','deactivated') NOT NULL DEFAULT 'unverified',
  terms_version VARCHAR(25) NOT NULL,
  privacy_version VARCHAR(25) NOT NULL,
  accepted_at DATETIME(6) NOT NULL,
  verified_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE VALIDATION_ACCOUNT_TOKEN (
  purpose ENUM('admin_setup','admin_reset','validator_invite','validator_verify','validator_reset') NOT NULL,
  subject_key VARCHAR(254) COLLATE utf8mb4_0900_as_cs NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  email VARCHAR(254) COLLATE utf8mb4_0900_as_cs NOT NULL,
  issued_by INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  PRIMARY KEY (purpose, subject_key),
  FOREIGN KEY (issued_by) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE VALIDATOR_CREDENTIAL (
  credential_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  validator_id INT NOT NULL,
  contents MEDIUMBLOB NOT NULL,
  submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY credential_account (validator_id, credential_id),
  UNIQUE KEY credential_owner (credential_id, validator_id),
  FOREIGN KEY (validator_id) REFERENCES VALIDATOR_ACCOUNT (validator_id)
) ENGINE=InnoDB;

CREATE TABLE VALIDATOR_ACCOUNT_DECISION (
  decision_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  validator_id INT NOT NULL,
  admin_id INT NOT NULL,
  credential_id INT NOT NULL,
  status ENUM('correction','rejected','approved','deactivated') NOT NULL,
  remarks VARCHAR(2500) NOT NULL,
  approved_clusters JSON NULL,
  decided_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY account_decisions (validator_id, decision_id),
  FOREIGN KEY (validator_id) REFERENCES VALIDATOR_ACCOUNT (validator_id),
  FOREIGN KEY (admin_id) REFERENCES ADMIN (admin_id),
  FOREIGN KEY (credential_id, validator_id) REFERENCES VALIDATOR_CREDENTIAL (credential_id, validator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE COURSE_VALIDATION_ASSIGNMENT (
  assignment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  validator_id INT NOT NULL,
  admin_id INT NOT NULL,
  cluster_category VARCHAR(100) NOT NULL,
  assignment_type ENUM('course','cluster') NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY validator_assignments (validator_id, assignment_id),
  FOREIGN KEY (validator_id) REFERENCES VALIDATOR_ACCOUNT (validator_id),
  FOREIGN KEY (admin_id) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE COURSE_VALIDATION_SIGNATURE (
  signature_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  method ENUM('typed','drawn','uploaded') NOT NULL,
  typed_name VARCHAR(150) NULL,
  contents MEDIUMBLOB NULL,
  reviewer_snapshot JSON NOT NULL,
  confirmation_version VARCHAR(40) NOT NULL,
  confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY signature_assignment (signature_id, assignment_id),
  FOREIGN KEY (assignment_id) REFERENCES COURSE_VALIDATION_ASSIGNMENT (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE COURSE_VALIDATION_ITEM (
  item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  course_id INT NOT NULL,
  version_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  version_snapshot JSON NOT NULL,
  decision ENUM('pending','needs_changes','approved','superseded') NOT NULL DEFAULT 'pending',
  remarks VARCHAR(5000) NULL,
  signature_id INT NULL,
  reviewer_snapshot JSON NULL,
  decided_at DATETIME(6) NULL,
  UNIQUE KEY assignment_course (assignment_id, course_id),
  UNIQUE KEY item_course (item_id, course_id),
  KEY validation_course (course_id, item_id),
  CONSTRAINT validation_signature_required CHECK (
    (decision = 'approved' AND signature_id IS NOT NULL) OR (decision <> 'approved' AND signature_id IS NULL)
  ),
  FOREIGN KEY (course_id) REFERENCES COURSE (course_id),
  FOREIGN KEY (assignment_id) REFERENCES COURSE_VALIDATION_ASSIGNMENT (assignment_id),
  FOREIGN KEY (signature_id, assignment_id) REFERENCES COURSE_VALIDATION_SIGNATURE (signature_id, assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE COURSE_PUBLICATION ADD COLUMN validation_item_id INT NULL,
  ADD CONSTRAINT fk_course_publication_validation_item
  FOREIGN KEY (validation_item_id, course_id) REFERENCES COURSE_VALIDATION_ITEM (item_id, course_id);

CREATE TABLE COURSE_VALIDATION_REVISION (
  course_id INT NOT NULL PRIMARY KEY,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  FOREIGN KEY (course_id) REFERENCES COURSE (course_id)
) ENGINE=InnoDB;

-- Replacement drafts use the existing editor and never replace a stable identity.
CREATE TABLE COURSE_REPLACEMENT_DRAFT (
  draft_id INT NOT NULL PRIMARY KEY,
  course_id INT NOT NULL,
  base_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  published_at DATETIME(6) NULL,
  open_course_id INT GENERATED ALWAYS AS (CASE WHEN published_at IS NULL THEN course_id ELSE NULL END) STORED,
  UNIQUE KEY one_open_replacement (open_course_id),
  KEY replacement_history (course_id, published_at),
  FOREIGN KEY (draft_id) REFERENCES COURSE (course_id),
  FOREIGN KEY (course_id) REFERENCES COURSE (course_id)
) ENGINE=InnoDB;

CREATE TABLE COURSE_REPLACEMENT_CAREER (
  draft_id INT NOT NULL,
  original_id INT NOT NULL,
  draft_career_id INT NOT NULL,
  PRIMARY KEY (draft_id, original_id),
  FOREIGN KEY (draft_id) REFERENCES COURSE_REPLACEMENT_DRAFT (draft_id)
) ENGINE=InnoDB;
