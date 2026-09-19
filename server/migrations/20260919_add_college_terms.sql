-- Calendar-aware Career Alignment Tracking.
-- Apply deliberately to the target database after verifying the connection.
-- Existing SEMESTER_CHECKIN rows remain unchanged and keep a NULL term_id.

CREATE TABLE COLLEGE_TERM (
  term_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  academic_year VARCHAR(9) NOT NULL,
  year_level VARCHAR(20) NOT NULL,
  semester VARCHAR(20) NOT NULL,
  semester_start_date DATE DEFAULT NULL,
  semester_end_date DATE DEFAULT NULL,
  dates_source ENUM('student_confirmed','estimated','institution_calendar') DEFAULT NULL,
  timing_mode ENUM('exact','approximate','phase_only','manual') NOT NULL DEFAULT 'exact',
  initial_tracking_phase ENUM('Early','Mid','End') DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (term_id),
  UNIQUE KEY uq_college_term_student_stage
    (user_id, course_id, academic_year, year_level, semester),
  KEY user_id (user_id),
  KEY course_id (course_id),
  CONSTRAINT college_term_ibfk_1 FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT (user_id),
  CONSTRAINT college_term_ibfk_2 FOREIGN KEY (course_id) REFERENCES COURSE (course_id),
  CONSTRAINT chk_college_term_dates CHECK (
    semester_start_date IS NULL OR
    semester_end_date IS NULL OR
    semester_end_date > semester_start_date
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE SEMESTER_CHECKIN
  ADD COLUMN term_id INT DEFAULT NULL AFTER course_id,
  ADD KEY term_id (term_id),
  ADD CONSTRAINT semester_checkin_ibfk_3
    FOREIGN KEY (term_id) REFERENCES COLLEGE_TERM (term_id);
