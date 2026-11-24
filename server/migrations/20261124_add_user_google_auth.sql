-- Migration: Add optional Google OAuth linking fields to USER_ACCOUNT
-- Safe and nullable so all existing email/password accounts continue working unchanged.

ALTER TABLE USER_ACCOUNT
  ADD COLUMN google_id VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN auth_provider VARCHAR(30) NOT NULL DEFAULT 'local',
  ADD INDEX idx_user_account_google_id (google_id);
