import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../config/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXPECTED_DATABASE = 'learnmatch_db'
const EXPECTED_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function validateCanonicalCourses(courses) {
  if (!Array.isArray(courses) || courses.length !== 360) {
    throw new Error('Canonical dataset must contain exactly 360 courses.')
  }
  const expectedCodes = Array.from(
    { length: 360 },
    (_, index) => `CRS${String(index + 1).padStart(3, '0')}`
  )
  if (courses.some((course, index) => course.course_id !== expectedCodes[index])) {
    throw new Error('Canonical dataset must contain the exact CRS001-CRS360 sequence.')
  }
}

async function assertLocalTarget(connection) {
  const configuredHost = String(process.env.DB_HOST || '').trim().toLowerCase()
  const [[identity]] = await connection.query('SELECT DATABASE() AS database_name')
  if (!EXPECTED_HOSTS.has(configuredHost) || identity.database_name !== EXPECTED_DATABASE) {
    throw new Error('Refusing course sync: database target is not confirmed local LearnMatch.')
  }
}

async function importCourses() {
  const filePath = path.join(__dirname, '../data/learnmatch_courses_final_342_with_ids.json')
  const { courses } = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  validateCanonicalCourses(courses)

  const connection = await pool.getConnection()
  try {
    await assertLocalTarget(connection)
    const [existingCourses] = await connection.query(
      'SELECT course_id, course_code FROM COURSE ORDER BY course_code'
    )
    const existingIdsByCode = new Map(
      existingCourses.map(({ course_id, course_code }) => [course_code, course_id])
    )

    await connection.beginTransaction()
    for (const course of courses) {
      const obtainableSkills = Array.isArray(course.obtainable_skills)
        ? course.obtainable_skills.join('\n')
        : null
      await connection.execute(
        `INSERT INTO COURSE (
           course_code, course_name, course_abbreviation, program_type,
           cluster_category, psced_group, description, obtainable_skills, is_active
         ) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           course_name = VALUES(course_name),
           course_abbreviation = VALUES(course_abbreviation),
           cluster_category = VALUES(cluster_category),
           description = VALUES(description),
           obtainable_skills = VALUES(obtainable_skills)`,
        [
          course.course_id,
          course.course_name,
          course.course_abbreviation || null,
          course.parent_cluster,
          course.course_description || null,
          obtainableSkills,
        ]
      )
    }

    const [syncedCourses] = await connection.query(
      'SELECT course_id, course_code FROM COURSE ORDER BY course_code'
    )
    const syncedByCode = new Map(
      syncedCourses.map(({ course_id, course_code }) => [course_code, course_id])
    )
    if (syncedCourses.length !== 360 || syncedByCode.size !== 360) {
      throw new Error('Course sync verification failed: expected 360 unique rows.')
    }
    for (const course of courses) {
      if (!syncedByCode.has(course.course_id)) {
        throw new Error(`Course sync verification failed: missing ${course.course_id}.`)
      }
    }
    for (const [courseCode, originalId] of existingIdsByCode) {
      if (syncedByCode.get(courseCode) !== originalId) {
        throw new Error(`Course sync changed the internal ID for ${courseCode}.`)
      }
    }

    await connection.commit()
    console.log(JSON.stringify({
      status: 'committed',
      database: EXPECTED_DATABASE,
      stored_courses: syncedCourses.length,
      existing_internal_ids_preserved: true,
    }))
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

importCourses().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
