-- Migration: Add 3-tier admin role column to ADMIN table and migrate existing developer accounts.
-- Supports: system_developer, system_admin, validator.
-- Existing ADMIN accounts are migrated to 'system_developer'; new accounts default to 'system_admin'.

SET @has_admin_role := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ADMIN'
    AND COLUMN_NAME = 'role'
);

SET @add_admin_role_sql := IF(
  @has_admin_role = 0,
  "ALTER TABLE ADMIN ADD COLUMN role ENUM('system_developer', 'system_admin', 'validator') NOT NULL DEFAULT 'system_developer'",
  'SELECT 1'
);

PREPARE stmt_add_role FROM @add_admin_role_sql;
EXECUTE stmt_add_role;
DEALLOCATE PREPARE stmt_add_role;

-- Ensure existing rows without an explicit system_admin/validator role are system_developer
UPDATE ADMIN
SET role = 'system_developer'
WHERE role IS NULL OR role = '';

-- Set column default for newly created admin accounts to 'system_admin'
ALTER TABLE ADMIN
  MODIFY COLUMN role ENUM('system_developer', 'system_admin', 'validator') NOT NULL DEFAULT 'system_admin';
