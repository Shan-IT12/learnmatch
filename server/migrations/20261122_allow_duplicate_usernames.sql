-- Migration: Allow duplicate usernames on USER_ACCOUNT while keeping email unique.
-- Safe and idempotent: only drops the UNIQUE index on USER_ACCOUNT.username if present.

SET @has_unique_username := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'USER_ACCOUNT'
    AND INDEX_NAME = 'username'
    AND NON_UNIQUE = 0
);

SET @drop_username_unique_sql := IF(
  @has_unique_username > 0,
  'ALTER TABLE USER_ACCOUNT DROP INDEX `username`',
  'SELECT 1'
);

PREPARE stmt FROM @drop_username_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
