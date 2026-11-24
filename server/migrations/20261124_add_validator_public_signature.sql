-- Migration: Add optional public signature field to VALIDATOR_ACCOUNT
-- Used exclusively for the public Landing Page "Validated by:" marquee for approved validators.

ALTER TABLE VALIDATOR_ACCOUNT
  ADD COLUMN public_signature MEDIUMTEXT NULL DEFAULT NULL;
