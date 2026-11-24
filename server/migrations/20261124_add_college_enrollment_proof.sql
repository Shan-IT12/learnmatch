-- Migration: Add private college enrollment verification & proof columns to COLLEGE_TRACKING_CYCLE.
-- Safe and idempotent: checks information_schema.COLUMNS before adding each column.

SET @col_school := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'school_name');
SET @sql_school := IF(@col_school = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN school_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE s1 FROM @sql_school; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @col_sid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'student_id_number');
SET @sql_sid := IF(@col_sid = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN student_id_number VARCHAR(64) NULL', 'SELECT 1');
PREPARE s2 FROM @sql_sid; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @col_pname := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'enrollment_proof_name');
SET @sql_pname := IF(@col_pname = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE s3 FROM @sql_pname; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @col_pmime := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'enrollment_proof_mime');
SET @sql_pmime := IF(@col_pmime = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_mime VARCHAR(64) NULL', 'SELECT 1');
PREPARE s4 FROM @sql_pmime; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @col_pdata := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'enrollment_proof_data');
SET @sql_pdata := IF(@col_pdata = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_data MEDIUMTEXT NULL', 'SELECT 1');
PREPARE s5 FROM @sql_pdata; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @col_pstatus := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'enrollment_proof_status');
SET @sql_pstatus := IF(@col_pstatus = 0, "ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_status ENUM('unsubmitted', 'submitted', 'verified') NOT NULL DEFAULT 'unsubmitted'", 'SELECT 1');
PREPARE s6 FROM @sql_pstatus; EXECUTE s6; DEALLOCATE PREPARE s6;

SET @col_psub := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'enrollment_proof_submitted_at');
SET @sql_psub := IF(@col_psub = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_submitted_at TIMESTAMP NULL', 'SELECT 1');
PREPARE s7 FROM @sql_psub; EXECUTE s7; DEALLOCATE PREPARE s7;

SET @col_pver := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'COLLEGE_TRACKING_CYCLE' AND COLUMN_NAME = 'enrollment_proof_verified_at');
SET @sql_pver := IF(@col_pver = 0, 'ALTER TABLE COLLEGE_TRACKING_CYCLE ADD COLUMN enrollment_proof_verified_at TIMESTAMP NULL', 'SELECT 1');
PREPARE s8 FROM @sql_pver; EXECUTE s8; DEALLOCATE PREPARE s8;
