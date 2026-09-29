-- Persist OTP verification failures so the five-attempt limit survives restarts.
-- Apply deliberately to the target database after verifying the connection.

ALTER TABLE OTP_VERIFICATION
  ADD COLUMN failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0
    AFTER otp_code;
