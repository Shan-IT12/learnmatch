-- College Tracking lifecycle. Apply after:
--   1. 20260919_add_college_terms.sql
--   2. 20260929_generalize_college_terms.sql
--
-- Historical course/check-in data is never rewritten. Only the latest modern
-- term is associated during backfill because older same-course terms cannot be
-- assigned to a lifecycle cycle without guessing.

CREATE TABLE COLLEGE_TRACKING_CYCLE (
  tracking_cycle_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('active', 'paused', 'ended') NOT NULL DEFAULT 'active',
  end_reason VARCHAR(32) DEFAULT NULL,
  started_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  paused_at TIMESTAMP NULL DEFAULT NULL,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active_user_id INT GENERATED ALWAYS AS (
    CASE WHEN status = 'active' THEN user_id ELSE NULL END
  ) STORED,
  PRIMARY KEY (tracking_cycle_id),
  UNIQUE KEY uq_college_tracking_one_active_user (active_user_id),
  KEY idx_college_tracking_user_status (user_id, status),
  KEY idx_college_tracking_course (course_id),
  CONSTRAINT college_tracking_cycle_user_fk
    FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id),
  CONSTRAINT college_tracking_cycle_course_fk
    FOREIGN KEY (course_id) REFERENCES COURSE (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE COLLEGE_TERM
  ADD COLUMN tracking_cycle_id INT DEFAULT NULL AFTER user_id,
  ADD KEY idx_college_term_tracking_cycle (tracking_cycle_id, term_id),
  ADD CONSTRAINT college_term_tracking_cycle_fk
    FOREIGN KEY (tracking_cycle_id) REFERENCES COLLEGE_TRACKING_CYCLE (tracking_cycle_id);

INSERT INTO COLLEGE_TRACKING_CYCLE (user_id, course_id, status)
SELECT latest.user_id, latest.course_id, 'active'
FROM COLLEGE_TERM latest
JOIN (
  SELECT user_id, MAX(term_id) AS latest_term_id
  FROM COLLEGE_TERM
  GROUP BY user_id
) selected ON selected.latest_term_id = latest.term_id;

UPDATE COLLEGE_TERM term
JOIN (
  SELECT user_id, MAX(term_id) AS latest_term_id
  FROM COLLEGE_TERM
  GROUP BY user_id
) selected ON selected.latest_term_id = term.term_id
JOIN COLLEGE_TRACKING_CYCLE cycle
  ON cycle.user_id = term.user_id
 AND cycle.course_id = term.course_id
 AND cycle.status = 'active'
SET term.tracking_cycle_id = cycle.tracking_cycle_id;
