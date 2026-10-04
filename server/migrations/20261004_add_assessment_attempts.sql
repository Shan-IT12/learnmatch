CREATE TABLE ASSESSMENT_ATTEMPT (
  attempt_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  status ENUM('IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
  personal_factors JSON NULL,
  interests JSON NULL,
  skill_answers JSON NULL,
  skill_result JSON NULL,
  personality_assessment_id INT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  PRIMARY KEY (attempt_id),
  KEY idx_assessment_attempt_user (user_id, attempt_id),
  CONSTRAINT fk_assessment_attempt_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id),
  CONSTRAINT fk_assessment_attempt_personality FOREIGN KEY (personality_assessment_id) REFERENCES PERSONALITY_ASSESSMENT(assessment_id)
);
