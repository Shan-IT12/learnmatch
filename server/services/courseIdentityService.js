import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const registryPath = path.join(__dirname, '../data/learnmatch_course_identity_registry.json')
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

const allowedStatuses = new Set([
  'confirmed_duplicate',
  'alternative_title',
  'historical',
  'malformed',
  'quarantine',
])

const recordsByCourseId = new Map()
for (const record of registry.records) {
  if (recordsByCourseId.has(record.course_id)) {
    throw new Error(`Duplicate course identity registry entry: ${record.course_id}`)
  }
  if (!allowedStatuses.has(record.status)) {
    throw new Error(`Unsupported course identity status for ${record.course_id}: ${record.status}`)
  }
  recordsByCourseId.set(record.course_id, Object.freeze({ ...record }))
}

const statusCounts = registry.records.reduce((counts, record) => {
  counts[record.status] = (counts[record.status] || 0) + 1
  return counts
}, {})

if (
  statusCounts.confirmed_duplicate !== 30 ||
  statusCounts.alternative_title !== 14 ||
  statusCounts.historical !== 6 ||
  statusCounts.malformed !== 4 ||
  statusCounts.quarantine !== 2
) {
  throw new Error('Course identity registry classification counts are invalid')
}

export const COURSE_IDENTITY_METADATA = Object.freeze({ ...registry.metadata })

export function getCourseIdentityRecord(courseId) {
  return recordsByCourseId.get(String(courseId || '').trim().toUpperCase()) || null
}

export function isCurrentIndependentCourse(courseId) {
  return !getCourseIdentityRecord(courseId)
}

export function resolveCanonicalCourseIds(courseId) {
  const normalizedCourseId = String(courseId || '').trim().toUpperCase()
  const record = getCourseIdentityRecord(normalizedCourseId)
  if (!record) return normalizedCourseId ? [normalizedCourseId] : []
  if (record.canonical_course_id) return [record.canonical_course_id]
  return record.successor_course_ids ? [...record.successor_course_ids] : []
}
