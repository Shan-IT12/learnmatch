-- Run once, before releasing the registration agreement feature.
-- Nullable fields deliberately leave existing accounts without inferred acceptance.
ALTER TABLE USER_ACCOUNT
  ADD COLUMN terms_version VARCHAR(20) NULL,
  ADD COLUMN terms_accepted_at DATETIME(3) NULL,
  ADD COLUMN privacy_notice_version VARCHAR(20) NULL;
