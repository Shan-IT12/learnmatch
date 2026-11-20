// Only local development can use compatibility reads before validation.
// Any evidence of a partial migration keeps the original database error visible.
export async function withLocalLegacyCatalog(database, readCurrent, readLegacy, missingCode = 'ER_NO_SUCH_TABLE') {
  try {
    return await readCurrent()
  } catch (error) {
    if (error.code !== missingCode
      || process.env.NODE_ENV === 'production'
      || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) throw error

    const [[schema]] = await database.query(`SELECT
      EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
        AND ((UPPER(TABLE_NAME) = 'ADMIN' AND COLUMN_NAME = 'email')
          OR (UPPER(TABLE_NAME) = 'COURSE_PUBLICATION' AND COLUMN_NAME = 'validation_item_id'))) AS validation_columns,
      EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
        AND UPPER(TABLE_NAME) IN ('VALIDATOR_ACCOUNT', 'VALIDATION_ACCOUNT_TOKEN', 'VALIDATOR_CREDENTIAL',
          'VALIDATOR_ACCOUNT_DECISION', 'COURSE_VALIDATION_ASSIGNMENT', 'COURSE_VALIDATION_SIGNATURE',
          'COURSE_VALIDATION_ITEM', 'COURSE_VALIDATION_REVISION', 'COURSE_REPLACEMENT_DRAFT',
          'COURSE_REPLACEMENT_CAREER')) AS validation_tables`)
    if (schema.validation_columns || schema.validation_tables) throw error
    return readLegacy()
  }
}
