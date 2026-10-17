-- Phase 2B only. NOT APPLIED. Apply AFTER Phase 2A's source/review tables exist.
-- Phase 2A was inspected read-only and remains unapplied locally.
-- No backfill or changes to Phase 1, existing reviews, or student-facing tables.
ALTER TABLE COURSE_DRAFT_SOURCE ADD COLUMN check_digest CHAR(64) DEFAULT NULL;

CREATE TABLE COURSE_DRAFT_SOURCE_CHECK (
  check_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  source_revision INT UNSIGNED NOT NULL,
  report JSON NOT NULL,
  checked_by INT NOT NULL,
  checked_at DATETIME(6) NOT NULL,
  KEY draft_check_source (source_id, check_id),
  CONSTRAINT draft_check_source_fk FOREIGN KEY (source_id) REFERENCES COURSE_DRAFT_SOURCE (source_id),
  CONSTRAINT draft_check_admin_fk FOREIGN KEY (checked_by) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
