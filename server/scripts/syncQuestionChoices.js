import pool from '../config/db.js'
import questionPool from '../data/questionPool.js'

const approvedItemNumbers = new Set([
  '1.8',
  '1.15',
  ...Array.from({ length: 15 }, (_, index) => `5.${index + 1}`),
  ...Array.from({ length: 15 }, (_, index) => `6.${index + 1}`),
])

const choiceFields = ['choice_a', 'choice_b', 'choice_c', 'choice_d']
const immutableFields = [
  'question_id',
  'question_text',
  'dimension',
  'correct_answer',
  'image_url',
  'is_active',
]

function valuesMatch(left, right, fields) {
  return fields.every((field) => left[field] === right[field])
}

function getCanonicalQuestions() {
  const selected = questionPool.filter((question) => approvedItemNumbers.has(question.item_number))
  const selectedItemNumbers = new Set(selected.map((question) => question.item_number))
  const missing = [...approvedItemNumbers].filter((itemNumber) => !selectedItemNumbers.has(itemNumber))

  if (selected.length !== 32 || selectedItemNumbers.size !== 32 || missing.length > 0) {
    throw new Error(
      `Expected exactly 32 unique canonical questions; found ${selected.length}. Missing: ${missing.join(', ') || 'none'}`
    )
  }

  return selected
}

async function identifyDatabaseRows(connection, canonicalQuestions, lockRows = false) {
  const identified = []
  const seenQuestionIds = new Set()

  for (const canonical of canonicalQuestions) {
    const [rows] = await connection.query(
      `SELECT question_id, question_text, dimension, choice_a, choice_b, choice_c, choice_d,
              correct_answer, image_url, is_active
       FROM QUESTION
       WHERE question_text = ?${lockRows ? ' FOR UPDATE' : ''}`,
      [canonical.question_text]
    )

    if (rows.length !== 1) {
      throw new Error(
        `Item ${canonical.item_number}: expected exactly one QUESTION row, found ${rows.length}`
      )
    }

    const row = rows[0]
    if (row.question_text !== canonical.question_text) {
      throw new Error(`Item ${canonical.item_number}: question_text is not an exact match`)
    }
    if (row.dimension !== canonical.dimension) {
      throw new Error(
        `Item ${canonical.item_number}: dimension mismatch (${row.dimension} !== ${canonical.dimension})`
      )
    }
    if (row.correct_answer !== canonical.correct_answer) {
      throw new Error(
        `Item ${canonical.item_number}: correct_answer mismatch (${row.correct_answer} !== ${canonical.correct_answer})`
      )
    }
    if (seenQuestionIds.has(row.question_id)) {
      throw new Error(`Item ${canonical.item_number}: question_id ${row.question_id} matched more than once`)
    }

    seenQuestionIds.add(row.question_id)
    identified.push({
      itemNumber: canonical.item_number,
      canonical,
      before: row,
      differs: !valuesMatch(row, canonical, choiceFields),
    })
  }

  if (identified.length !== 32 || seenQuestionIds.size !== 32) {
    throw new Error(`Expected 32 uniquely identified rows; found ${seenQuestionIds.size}`)
  }

  return identified
}

async function verifyUpdatedRows(connection, identified) {
  for (const entry of identified) {
    const [rows] = await connection.query(
      `SELECT question_id, question_text, dimension, choice_a, choice_b, choice_c, choice_d,
              correct_answer, image_url, is_active
       FROM QUESTION
       WHERE question_id = ?`,
      [entry.before.question_id]
    )

    if (rows.length !== 1) {
      throw new Error(`Item ${entry.itemNumber}: post-update row count is ${rows.length}`)
    }
    if (!valuesMatch(rows[0], entry.canonical, choiceFields)) {
      throw new Error(`Item ${entry.itemNumber}: post-update choices do not match canonical choices`)
    }
    if (!valuesMatch(rows[0], entry.before, immutableFields)) {
      throw new Error(`Item ${entry.itemNumber}: a protected field changed during synchronization`)
    }
  }
}

async function run() {
  const dryRun = process.argv.includes('--dry-run')
  const applyRun = process.argv.includes('--apply')

  if (dryRun === applyRun) {
    throw new Error('Specify exactly one mode: --dry-run or --apply')
  }

  const canonicalQuestions = getCanonicalQuestions()
  const connection = await pool.getConnection()
  let transactionStarted = false

  try {
    const [[beforeCounts]] = await connection.query(
      'SELECT COUNT(*) AS total, SUM(is_active = 1) AS active FROM QUESTION'
    )

    if (applyRun) {
      await connection.beginTransaction()
      transactionStarted = true
    }

    const identified = await identifyDatabaseRows(connection, canonicalQuestions, applyRun)
    const needingUpdates = identified.filter((entry) => entry.differs)

    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`)
    console.log(`Canonical approved entries: ${canonicalQuestions.length}`)
    console.log(`Database rows uniquely matched: ${identified.length}`)
    console.log(`Already matching: ${identified.length - needingUpdates.length}`)
    console.log(`Requiring updates: ${needingUpdates.length}`)
    console.log('Item number -> question_id (status)')
    for (const entry of identified) {
      console.log(
        `${entry.itemNumber} -> ${entry.before.question_id} (${entry.differs ? 'update required' : 'already matches'})`
      )
    }

    if (dryRun) {
      console.log('Dry run complete. Zero database rows modified.')
      return
    }

    for (const entry of identified) {
      await connection.query(
        `UPDATE QUESTION SET
           choice_a = ?, choice_b = ?, choice_c = ?, choice_d = ?
         WHERE question_id = ?`,
        [
          entry.canonical.choice_a,
          entry.canonical.choice_b,
          entry.canonical.choice_c,
          entry.canonical.choice_d,
          entry.before.question_id,
        ]
      )
    }

    await verifyUpdatedRows(connection, identified)

    const [[afterCounts]] = await connection.query(
      'SELECT COUNT(*) AS total, SUM(is_active = 1) AS active FROM QUESTION'
    )
    if (beforeCounts.total !== afterCounts.total || Number(beforeCounts.active) !== Number(afterCounts.active)) {
      throw new Error('QUESTION total or active row count changed during synchronization')
    }

    await connection.commit()
    transactionStarted = false
    console.log(`Apply complete. ${identified.length} approved rows verified and transaction committed.`)
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback()
      console.error('Synchronization failed. Transaction rolled back.')
    }
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
