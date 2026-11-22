-- Migration: Create system_error_logs table for centralized try-catch error logging.
-- Separate from assessment_monitoring_logs.

CREATE TABLE IF NOT EXISTS system_error_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source ENUM('BACKEND', 'FRONTEND') NOT NULL DEFAULT 'BACKEND',
  endpoint VARCHAR(255) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT NULL,
  user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_system_error_logs_created_at (created_at),
  INDEX idx_system_error_logs_source (source)
);
