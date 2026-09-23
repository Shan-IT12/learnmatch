import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../config/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXPECTED_DATABASE = 'learnmatch_db'
const EXPECTED_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const RIASEC_TYPES = ['R', 'I', 'A', 'S', 'E', 'C']

async function assertLocalTarget(connection) {
  const configuredHost = String(process.env.DB_HOST || '').trim().toLowerCase()
  const [[identity]] = await connection.query('SELECT DATABASE() AS database_name')
  if (!EXPECTED_HOSTS.has(configuredHost) || identity.database_name !== EXPECTED_DATABASE) {
    throw new Error('Refusing profile sync: database target is not confirmed local LearnMatch.')
  }
}

function validateProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length !== 360) {
    throw new Error('Matching profile dataset must contain exactly 360 profiles.')
  }
  const codes = new Set(profiles.map(({ course_id }) => course_id))
  if (codes.size !== 360) throw new Error('Matching profile course IDs must be unique.')
  for (let index = 1; index <= 360; index += 1) {
    const code = `CRS${String(index).padStart(3, '0')}`
    if (!codes.has(code)) throw new Error(`Matching profile dataset is missing ${code}.`)
  }
}

async function importMatchingProfiles() {
  const filePath = path.join(
    __dirname,
    '../data/learnmatch_course_matching_profiles_final_342_with_ids.json'
  )
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const profiles = data.courses || data.profiles || data.course_matching_profiles
  validateProfiles(profiles)

  const connection = await pool.getConnection()
  try {
    await assertLocalTarget(connection)
    const [courseRows] = await connection.query(
      'SELECT course_id, course_code FROM COURSE ORDER BY course_code'
    )
    const courseIdsByCode = new Map(
      courseRows.map(({ course_id, course_code }) => [course_code, course_id])
    )
    if (courseIdsByCode.size !== 360) {
      throw new Error('Matching profiles require 360 unique COURSE rows first.')
    }

    await connection.beginTransaction()
    for (const profile of profiles) {
      const internalCourseId = courseIdsByCode.get(profile.course_id)
      if (!internalCourseId) throw new Error(`No COURSE row found for ${profile.course_id}.`)

      for (const skill of profile.skills_profile || []) {
        await connection.execute(
          `INSERT INTO COURSE_SKILL_PROFILE (course_id, skill_domain, weight, evidence)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE weight = VALUES(weight), evidence = VALUES(evidence)`,
          [internalCourseId, skill.skill, skill.weight, skill.evidence || null]
        )
      }

      for (const riasecType of RIASEC_TYPES) {
        const riasec = profile.riasec_profile?.[riasecType]
        if (!riasec) throw new Error(`${profile.course_id} is missing RIASEC ${riasecType}.`)
        await connection.execute(
          `INSERT INTO COURSE_RIASEC_PROFILE (course_id, riasec_type, weight, evidence)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE weight = VALUES(weight), evidence = VALUES(evidence)`,
          [internalCourseId, riasecType, riasec.weight, riasec.evidence || null]
        )
      }
    }

    const [[counts]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM COURSE_SKILL_PROFILE) AS skill_rows,
         (SELECT COUNT(*) FROM COURSE_RIASEC_PROFILE) AS riasec_rows`
    )
    const expectedRiasecRows = profiles.length * RIASEC_TYPES.length
    if (Number(counts.riasec_rows) !== expectedRiasecRows) {
      throw new Error('Matching profile sync verification failed due to unexpected row counts.')
    }

    const [skillRows] = await connection.query(
      `SELECT c.course_code, p.skill_domain, p.weight, p.evidence
       FROM COURSE_SKILL_PROFILE p
       JOIN COURSE c ON c.course_id = p.course_id`
    )
    const skillsByKey = new Map(skillRows.map((row) => [
      `${row.course_code}|${row.skill_domain}`,
      row,
    ]))
    for (const profile of profiles) {
      for (const skill of profile.skills_profile || []) {
        const stored = skillsByKey.get(`${profile.course_id}|${skill.skill}`)
        if (
          !stored ||
          Number(stored.weight) !== skill.weight ||
          (stored.evidence || null) !== (skill.evidence || null)
        ) {
          throw new Error(`Skill profile verification failed for ${profile.course_id}.`)
        }
      }
    }

    await connection.commit()
    console.log(JSON.stringify({
      status: 'committed',
      database: EXPECTED_DATABASE,
      profiles: profiles.length,
      skill_rows: Number(counts.skill_rows),
      riasec_rows: Number(counts.riasec_rows),
    }))
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

importMatchingProfiles().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
