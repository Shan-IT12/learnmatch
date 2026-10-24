import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'

const identifier = value => {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error('Unsafe test identifier')
  return `\`${value}\``
}

export async function createDeletionTestDatabase() {
  const env = dotenv.parse(await readFile(new URL('../../.env', import.meta.url)))
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Tests require a localhost source schema')
  const name = `learnmatch_delete_test_${randomBytes(8).toString('hex')}`
  assert.notEqual(name, env.DB_NAME)
  const config = { host: env.DB_HOST, port: Number(env.DB_PORT) || 3306, user: env.DB_USER, password: env.DB_PASSWORD }
  const admin = await mysql.createConnection(config)
  const [tables] = await admin.execute('SELECT TABLE_NAME name, ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [env.DB_NAME])
  assert.ok(tables.length >= 17)
  assert.ok(tables.every(table => table.engine === 'InnoDB'))
  const [foreignKeys] = await admin.execute('SELECT TABLE_NAME child, COLUMN_NAME columnName, REFERENCED_TABLE_NAME parent, REFERENCED_COLUMN_NAME parentColumn FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL', [env.DB_NAME])
  const [columns] = await admin.execute('SELECT TABLE_NAME tableName, COLUMN_NAME name, DATA_TYPE type, COLUMN_TYPE fullType, IS_NULLABLE nullable, COLUMN_DEFAULT defaultValue, EXTRA extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION', [env.DB_NAME])
  const ddl = new Map()
  const before = {}
  for (const table of tables) {
    const qualified = `${identifier(env.DB_NAME)}.${identifier(table.name)}`
    ddl.set(table.name, (await admin.query(`SHOW CREATE TABLE ${qualified}`))[0][0]['Create Table'])
    before[table.name] = (await admin.query(`SELECT COUNT(*) n FROM ${qualified}`))[0][0].n
  }
  // No source records are copied. Only empty table definitions enter the test DB.
  await admin.query(`CREATE DATABASE ${identifier(name)}`)
  let pool
  try {
    await admin.query(`USE ${identifier(name)}`)
    const created = new Set()
    while (ddl.size) {
      const ready = [...ddl].filter(([table]) => foreignKeys.filter(f => f.child === table && f.parent !== table).every(f => created.has(f.parent)))
      assert.ok(ready.length, 'Schema contains an unexpected dependency cycle')
      for (const [table, sql] of ready) {
        await admin.query(sql)
        created.add(table)
        ddl.delete(table)
      }
    }
    pool = mysql.createPool({ ...config, database: name, connectionLimit: 8 })
  } catch (error) {
    await admin.query(`DROP DATABASE ${identifier(name)}`)
    await admin.end()
    throw error
  }
  let counter = 0
  const insert = async (table, overrides = {}) => {
    const values = { ...overrides }
    counter++
    for (const col of columns.filter(c => c.tableName === table)) {
      if (Object.hasOwn(values, col.name) || col.nullable === 'YES' || col.defaultValue !== null || /auto_increment|GENERATED/.test(col.extra)) continue
      if (col.type === 'enum') values[col.name] = col.fullType.match(/^enum\('([^']+)'/)[1]
      else if (col.type === 'json') values[col.name] = '{}'
      else if (/int|decimal|float|double/.test(col.type)) values[col.name] = 1
      else if (/date|time/.test(col.type)) values[col.name] = '2026-10-24 00:00:00'
      else values[col.name] = `s${counter}`
    }
    const keys = Object.keys(values)
    const [result] = await pool.execute(`INSERT INTO ${identifier(table)} (${keys.map(identifier).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(values))
    return result.insertId
  }
  const snapshot = async () => {
    const result = {}
    for (const { name: table } of tables) result[table] = (await pool.query(`SELECT * FROM ${identifier(table)} ORDER BY 1`))[0]
    return result
  }
  const assertIntegrity = async () => {
    for (const f of foreignKeys) {
      const [[row]] = await pool.query(`SELECT COUNT(*) n FROM ${identifier(f.child)} c LEFT JOIN ${identifier(f.parent)} p ON c.${identifier(f.columnName)}=p.${identifier(f.parentColumn)} WHERE c.${identifier(f.columnName)} IS NOT NULL AND p.${identifier(f.parentColumn)} IS NULL`)
      assert.equal(Number(row.n), 0, `${f.child}.${f.columnName} orphan`)
    }
    assert.equal((await pool.query('SELECT @@foreign_key_checks n'))[0][0].n, 1)
  }
  return { name, config, pool, insert, snapshot, assertIntegrity, foreignKeys, async close() {
    await pool.end()
    for (const { name: table } of tables) {
      const [[row]] = await admin.query(`SELECT COUNT(*) n FROM ${identifier(env.DB_NAME)}.${identifier(table)}`)
      assert.equal(row.n, before[table], `Source table count changed: ${table}`)
    }
    // Exact random name created above; never drop the source/development DB.
    assert.match(name, /^learnmatch_delete_test_[a-f0-9]{16}$/)
    await admin.query(`DROP DATABASE ${identifier(name)}`)
    await admin.end()
  } }
}
