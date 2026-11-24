-- Migration: Ensure FEEDBACK.category defaults cleanly to 'General'
-- Preserves all existing feedback records while normalizing NULL/blank categories to 'General'.

UPDATE FEEDBACK
SET category = 'General'
WHERE category IS NULL OR TRIM(category) = '';

ALTER TABLE FEEDBACK
  MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'General';
