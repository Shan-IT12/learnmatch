import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import pool from '../config/db.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// PSCED → LearnMatch Cluster mapping
const pscedToCluster = {
  'Business, Administration, and Law': 'Business Cluster',
  'Information and Communication Technologies (ICTs)': 'Engineering/STEM Cluster',
  'Engineering, Manufacturing, and Construction': 'Engineering/STEM Cluster',
  'Education': 'Education Cluster',
  'Health and Welfare': 'Healthcare Science Cluster',
  'Social Sciences, Journalism and Information': 'Humanities & Social Science Cluster',
  'Arts and Humanities': 'Arts & Multimedia Cluster',
  'Natural Sciences, Mathematics and Statistics': 'Science & Mathematics Cluster',
  'Agriculture, Forestry, Fisheries and Veterinary': 'Agriculture & Environmental Cluster',
  'Services': 'Hospitality & Tourism Cluster',
  'Law': 'Legal & Public Service Cluster',
  'Security Services': 'Criminology Cluster',
  'Sports': 'Sports & Physical Education Cluster',
}

const getCluster = (pscedGroup) => {
  return pscedToCluster[pscedGroup] || 'General Cluster'
}

const seed = async () => {
  try {
    console.log('Reading CSV...')
    const csvPath = path.join(__dirname, 'sjdm_bulacan_courses.csv')
    const fileContent = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '')

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    console.log(`Found ${records.length} records`)

    // Track inserted schools and courses to avoid duplicates
    const schoolMap = {} // uii → school_id
    const courseMap = {} // course_name → course_id

    for (const record of records) {
      const {
        UII,
        HEI_Name,
        HEI_Type,
        HEI_Type2,
        HEI_Province,
        HEI_Municipality_City,
        Program_Name,
        Major,
        Detailed_Name,
        F2017PSCED_Discipline_Group,
      } = record

      // Insert school if not already inserted
      if (!schoolMap[UII]) {
        const [existing] = await pool.query(
          'SELECT school_id FROM SCHOOL WHERE uii = ?',
          [UII]
        )

        if (existing.length > 0) {
          schoolMap[UII] = existing[0].school_id
        } else {
          const [result] = await pool.query(
            `INSERT INTO SCHOOL (uii, school_name, hei_type, hei_type2, address)
             VALUES (?, ?, ?, ?, ?)`,
            [
              UII,
              HEI_Name,
              HEI_Type,
              HEI_Type2,
              `${HEI_Municipality_City}, ${HEI_Province}`,
            ]
          )
          schoolMap[UII] = result.insertId
          console.log(`Inserted school: ${HEI_Name}`)
        }
      }

      // Insert course if not already inserted
      const courseKey = Program_Name.trim()
      if (!courseMap[courseKey]) {
        const [existing] = await pool.query(
          'SELECT course_id FROM COURSE WHERE course_name = ?',
          [courseKey]
        )

        if (existing.length > 0) {
          courseMap[courseKey] = existing[0].course_id
        } else {
          const cluster = getCluster(F2017PSCED_Discipline_Group)
          const [result] = await pool.query(
            `INSERT INTO COURSE (course_name, cluster_category, psced_group)
             VALUES (?, ?, ?)`,
            [courseKey, cluster, F2017PSCED_Discipline_Group]
          )
          courseMap[courseKey] = result.insertId
          console.log(`Inserted course: ${courseKey} → ${cluster}`)
        }
      }

      // Insert SCHOOL_COURSE link
      const schoolId = schoolMap[UII]
      const courseId = courseMap[courseKey]
      const major = Major ? Major.trim() : null

      const [existingLink] = await pool.query(
        'SELECT school_course_id FROM SCHOOL_COURSE WHERE school_id = ? AND course_id = ? AND (major = ? OR (major IS NULL AND ? IS NULL))',
        [schoolId, courseId, major, major]
      )

      if (existingLink.length === 0) {
        await pool.query(
          'INSERT INTO SCHOOL_COURSE (school_id, course_id, major) VALUES (?, ?, ?)',
          [schoolId, courseId, major]
        )
      }
    }

    console.log('Seeding complete!')
    process.exit(0)

  } catch (error) {
    console.error('Seeding error:', error)
    process.exit(1)
  }
}

seed()