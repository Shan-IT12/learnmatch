-- Phase 2A only. NOT APPLIED. Requires the separately applied Phase 1 migration.
-- Read-only local inspection: MySQL 8/InnoDB, COURSE.course_id and ADMIN.admin_id
-- are signed INT primary keys. No existing sources/reviews tables were present.
-- No ALTER, backfill, import, publication, or changes to Phase 1/student tables.
CREATE TABLE COURSE_DRAFT_FIELD_REVISION (
  course_id INT NOT NULL,
  field_key VARCHAR(40) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  PRIMARY KEY (course_id, field_key),
  CONSTRAINT draft_field_course_fk FOREIGN KEY (course_id) REFERENCES COURSE (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE COURSE_DRAFT_SOURCE (
  source_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  source_revision INT UNSIGNED NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  supported_fields JSON NOT NULL,
  notes TEXT DEFAULT NULL,
  is_removed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY draft_source_course (course_id, source_id),
  CONSTRAINT draft_source_course_fk FOREIGN KEY (course_id) REFERENCES COURSE (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE COURSE_DRAFT_SOURCE_REVIEW (
  review_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  source_revision INT UNSIGNED NOT NULL,
  context_token CHAR(64) NOT NULL,
  field_revisions JSON NOT NULL,
  source_snapshot JSON NOT NULL,
  claim_snapshot JSON NOT NULL,
  reviewer_id INT NOT NULL,
  reviewer_label VARCHAR(255) NOT NULL,
  reviewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY draft_review_source (source_id, review_id),
  CONSTRAINT draft_review_source_fk FOREIGN KEY (source_id) REFERENCES COURSE_DRAFT_SOURCE (source_id),
  CONSTRAINT draft_review_admin_fk FOREIGN KEY (reviewer_id) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
