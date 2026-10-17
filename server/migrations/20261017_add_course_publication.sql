-- Additive publication phase. NOT APPLIED by the application.
-- Read-only local inspection: MySQL 8/InnoDB; COURSE/ADMIN IDs are signed INT.
-- Phase 1 and source-review/evidence tables already exist locally.
-- No changes to earlier migrations, catalog rows, profiles, or tracking.
CREATE TABLE COURSE_MATCHING_REVIEW (
  matching_review_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  context_token CHAR(64) NOT NULL,
  review_snapshot JSON NOT NULL,
  reviewer_id INT NOT NULL,
  reviewer_label VARCHAR(255) NOT NULL,
  reviewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY matching_review_course (course_id, matching_review_id),
  FOREIGN KEY (course_id) REFERENCES COURSE (course_id),
  FOREIGN KEY (reviewer_id) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE COURSE_PUBLICATION (
  course_id INT NOT NULL PRIMARY KEY,
  matching_review_id INT NOT NULL,
  context_token CHAR(64) NOT NULL,
  publication_snapshot JSON NOT NULL,
  published_by INT NOT NULL,
  publisher_label VARCHAR(255) NOT NULL,
  published_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (course_id) REFERENCES COURSE (course_id),
  FOREIGN KEY (matching_review_id) REFERENCES COURSE_MATCHING_REVIEW (matching_review_id),
  FOREIGN KEY (published_by) REFERENCES ADMIN (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
