-- Migration: Update existing developer account (@admin) display name from "System Admin" to "System Developer".
-- Safe and idempotent.

UPDATE ADMIN
SET full_name = 'System Developer'
WHERE username = 'admin'
  AND role = 'system_developer'
  AND (full_name IS NULL OR full_name = '' OR LOWER(full_name) = 'system admin');
