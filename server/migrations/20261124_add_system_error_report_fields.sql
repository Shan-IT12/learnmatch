-- Migration: Add in-app escalation/report tracking fields to system_error_logs
-- Allows system_admin to escalate runtime errors directly to the System Developer dashboard.

ALTER TABLE system_error_logs
  ADD COLUMN reported_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN reported_by VARCHAR(120) NULL DEFAULT NULL;
