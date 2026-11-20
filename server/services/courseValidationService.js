import { createHash } from 'node:crypto'
import { PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { getCatalogCourseReferences } from './catalogCourseReferenceService.js'
import { isCurrentIndependentCourse, resolveCanonicalCourseIds } from './courseIdentityService.js'
import { getAvailablePublicCourse, getPublicCourse } from './publicCourseService.js'
import { withLocalLegacyCatalog } from './localLegacyCatalog.js'
import { parseJson, stableJson } from './draftSourceService.js'
import { buildPublicationContext, publicationFieldErrors } from './coursePublicationService.js'
import { reviewImage } from './privateReviewImage.js'
import { lockValidator } from './staffAccountService.js'
import { WorkflowError, workflowId, workflowText, workflowTransaction } from './workflowSupport.js'

const hash = (snapshot) => createHash('sha256').update(stableJson(snapshot)).digest('hex')

export async function courseValidationVersion(database, course, current = null) {
  current ||= await buildPublicationContext(database, course)
  const [[revision]] = await database.execute('SELECT revision FROM COURSE_VALIDATION_REVISION WHERE course_id = ?', [course.course_id])
  const [[replacement]] = await database.execute(`SELECT r.course_id, c.course_code FROM COURSE_REPLACEMENT_DRAFT r
    JOIN COURSE c ON c.course_id = r.course_id WHERE r.draft_id = ?`, [course.course_id])
  const [[publication]] = await database.execute(`SELECT course_id FROM COURSE_PUBLICATION WHERE course_id = ?
    UNION SELECT course_id FROM COURSE_REPLACEMENT_DRAFT WHERE course_id = ? AND published_at IS NOT NULL LIMIT 1`, [course.course_id, course.course_id])
  const catalog = Number(course.is_draft) === 0 && !publication ? getPublicCourse(course.course_code) : null
  const catalogSources = catalog ? getCatalogCourseReferences(course.course_code).references : []
  // Project rows down before hashing. Date objects and private source-check receipts are excluded.
  const snapshot = {
    revision: revision?.revision || 1,
    course_code: replacement?.course_code ?? course.course_code, course_name: course.course_name, course_abbreviation: course.course_abbreviation,
    cluster_category: course.cluster_category, program_type: course.program_type, psced_group: course.psced_group,
    description: course.description, obtainable_skills: course.obtainable_skills,
    program_duration_years: current.fields.duration.years ?? catalog?.program_duration_years ?? null,
    year_levels: current.fields.duration.year_levels ?? catalog?.year_levels ?? [],
    skills: current.fields.matching_profile_evidence.skills, riasec: current.fields.matching_profile_evidence.riasec,
    careers: current.snapshot.careers.map(({ opportunity_id, job_title, salary_range, description }) => ({ opportunity_id, job_title, salary_range, description })),
    sources: current.sources.map(({ source_id, source_revision, title, url, supported_fields, notes, current_review, check_digest }) => ({
      source_id, source_revision, title, url, supported_fields, notes, check_digest,
      current_source_confirmation: current_review?.review_id ?? null,
    })),
    field_revisions: current.snapshot.revisions,
    catalog, catalogSources,
    replacement_for: replacement?.course_id ?? null,
  }
  return { token: hash(snapshot), snapshot, current }
}

export async function supersedePendingReviews(database, courseId) {
  await database.execute("UPDATE COURSE_VALIDATION_ITEM SET decision = 'superseded' WHERE course_id = ? AND decision = 'pending'", [courseId])
}

export async function bumpValidationRevision(database, courseId) {
  await database.execute(`INSERT INTO COURSE_VALIDATION_REVISION (course_id, revision) VALUES (?, 2)
    ON DUPLICATE KEY UPDATE revision = revision + 1`, [courseId])
  await supersedePendingReviews(database, courseId)
}

async function lockCourse(database, id) {
  const [[course]] = await database.execute('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [id])
  if (!course) throw new WorkflowError('Course not found.', 404)
  return course
}

const isEligible = (course) => Number(course.is_draft) === 1
  || (Number(course.is_active) === 1 && Boolean(course.course_code) && isCurrentIndependentCourse(course.course_code))

async function clusterCourses(database, cluster, lock = false) {
  const [rows] = await database.execute(`SELECT c.* FROM COURSE c WHERE c.cluster_category = ? AND c.is_active = 1 AND c.is_draft = 0
    ORDER BY c.course_id${lock ? ' FOR UPDATE' : ''}`, [cluster])
  return rows.filter(isEligible)
}

const requireCluster = (value) => {
  if (!PARENT_CLUSTERS.includes(value)) throw new WorkflowError('Select a valid cluster.')
  return value
}

const itemFields = `i.item_id, i.course_id, i.assignment_id, i.version_token, i.decision, i.remarks, i.signature_id,
  i.reviewer_snapshot, i.decided_at, a.validator_id, a.created_at, a.cluster_category, a.assignment_type,
  s.method AS signature_method, s.typed_name, s.confirmed_at, s.confirmation_version, v.status AS validator_status, v.full_name AS validator_name`
const joins = `FROM COURSE_VALIDATION_ITEM i JOIN COURSE_VALIDATION_ASSIGNMENT a ON a.assignment_id = i.assignment_id
  JOIN VALIDATOR_ACCOUNT v ON v.validator_id = a.validator_id
  LEFT JOIN COURSE_VALIDATION_SIGNATURE s ON s.signature_id = i.signature_id`
const record = (row) => ({ ...row, reviewer_snapshot: parseJson(row.reviewer_snapshot) })
const courseLabel = (course) => ({ course_id: course.course_id, course_name: course.course_name, course_code: course.course_code })
const readiness = (course, version) => Number(course.is_draft) !== 1 ? {}
  : publicationFieldErrors(course, version.current.fields, version.current.sources)

export async function exactApproval(database, courseId, token) {
  const [[approval]] = await database.execute(`SELECT item_id FROM COURSE_VALIDATION_ITEM
    WHERE course_id = ? AND version_token = ? AND decision = 'approved' AND signature_id IS NOT NULL ORDER BY item_id DESC LIMIT 1`, [courseId, token])
  return approval || null
}

export async function reviewQueue(database, input) {
  if (input.courseId !== undefined) {
    const id = workflowId(input.courseId)
    return workflowTransaction(database, async (connection) => {
      const course = await lockCourse(connection, id)
      if (!isEligible(course)) throw new WorkflowError('This course is unavailable for validation.', 409)
      const version = await courseValidationVersion(connection, course)
      const [history] = await connection.execute(`SELECT ${itemFields} ${joins} WHERE i.course_id = ? ORDER BY i.item_id DESC`, [id])
      const [[replacement]] = await connection.execute('SELECT draft_id FROM COURSE_REPLACEMENT_DRAFT WHERE open_course_id = ?', [id])
      const [inherited] = await connection.execute(`SELECT ${itemFields} ${joins}
        JOIN COURSE_PUBLICATION p ON p.validation_item_id = i.item_id
        JOIN COURSE_REPLACEMENT_DRAFT r ON r.draft_id = p.course_id
        WHERE r.course_id = ? AND r.published_at IS NOT NULL ORDER BY r.published_at DESC, r.draft_id DESC`, [id])
      const active = history.find(row => row.version_token === version.token && (row.decision !== 'pending' || row.validator_status === 'approved') && row.decision !== 'superseded')
        || inherited[0] || await publishedApproval(connection, id)
      const origin = version.snapshot.replacement_for
      const [originHistory] = origin ? await connection.execute(`SELECT ${itemFields},
        JSON_UNQUOTE(JSON_EXTRACT(i.version_snapshot, '$.course_name')) AS course_name ${joins}
        WHERE i.course_id = ? AND i.decision IN ('needs_changes','approved') ORDER BY i.item_id DESC`, [origin]) : [[]]
      return { course: courseLabel(course), cluster: course.cluster_category, canReplace: !Number(course.is_draft), replacementId: replacement?.draft_id,
        replacementFor: origin, expectedVersion: version.token, fieldErrors: readiness(course, version),
        status: validationStatus(active || lastCorrection(history)), history: [...history, ...inherited, ...originHistory].map(record) }
    })
  }
  const cluster = requireCluster(input.cluster)
  const courses = await clusterCourses(database, cluster)
  const [batches] = await database.execute(`SELECT a.assignment_id, a.created_at, v.full_name, COUNT(*) AS total,
    SUM(i.decision = 'approved') AS approved, SUM(i.decision = 'needs_changes') AS needs_changes
    FROM COURSE_VALIDATION_ASSIGNMENT a JOIN COURSE_VALIDATION_ITEM i USING (assignment_id)
    JOIN VALIDATOR_ACCOUNT v ON v.validator_id = a.validator_id
    WHERE a.cluster_category = ? AND a.assignment_type = 'cluster'
    GROUP BY a.assignment_id, a.created_at, v.full_name ORDER BY a.assignment_id DESC`, [cluster])
  const { prepared, validated } = await prepareBatch(database, courses)
  return { cluster, validated, total: courses.length, courses: prepared.map(({ course, version }) => ({ ...courseLabel(course), version: version.token })), batches }

}

async function prepareBatch(database, courses) {
  const prepared = []
  let validated = 0
  for (const course of courses) {
    const version = await courseValidationVersion(database, course)
    if (await exactApproval(database, course.course_id, version.token)
      || await publishedApproval(database, course.course_id) || await replacementApproval(database, course.course_id)) {
      validated += 1
      continue
    }
    const latest = await latestItem(database, course.course_id)
    if (latest?.version_token === version.token && (latest.decision === 'needs_changes'
      || (latest.decision === 'pending' && latest.validator_status === 'approved'))) continue
    prepared.push({ course, version })
  }
  return { prepared, validated }
}

async function latestItem(database, courseId) {
  const [[row]] = await database.execute(`SELECT ${itemFields} ${joins} WHERE i.course_id = ? ORDER BY i.item_id DESC LIMIT 1`, [courseId])
  return row
}

export async function submitAssignment(database, adminId, input) {
  const validatorId = workflowId(input?.validatorId)
  if (input.confirmed !== true) throw new WorkflowError('Confirm the course list and chosen validator.')
  const individual = input.courseId !== undefined
  const cluster = requireCluster(input.cluster)
  const expectedIds = individual ? [workflowId(input.courseId)] : Array.isArray(input.courses) && input.courses.map(course => course?.course_id)
  if (!Array.isArray(expectedIds) || !expectedIds.length || expectedIds.length > 2000) throw new WorkflowError('Confirm a nonempty course list.')
  const ids = expectedIds.map(workflowId)
  return workflowTransaction(database, async (connection) => {
    const validator = await lockValidator(connection, validatorId)
    if (validator.status !== 'approved' || !validator.approved_clusters.includes(cluster)) throw new WorkflowError('Choose an approved validator with expertise in this cluster.', 422)
    const courses = individual ? [await lockCourse(connection, ids[0])] : await clusterCourses(connection, cluster, true)
    const prepared = individual ? [] : (await prepareBatch(connection, courses)).prepared
    for (const course of individual ? courses : []) {
      if (!isEligible(course) || course.cluster_category !== cluster) throw new WorkflowError('The course is no longer eligible in this cluster.', 409)
      const version = await courseValidationVersion(connection, course)
      if (individual && input.expectedVersion !== version.token) throw new WorkflowError('The saved course changed. Reload before submitting.', 409)
      const errors = readiness(course, version)
      if (Object.keys(errors).length) throw new WorkflowError('Complete the saved course and its supporting sources before sending for validation.', 422, { fieldErrors: errors })
      if (await exactApproval(connection, course.course_id, version.token) || await publishedApproval(connection, course.course_id) || await replacementApproval(connection, course.course_id)) {
        if (individual) throw new WorkflowError('This version is already validated.', 409)
        continue
      }
      const latest = await latestItem(connection, course.course_id)
      if (latest?.decision === 'pending' && latest.version_token === version.token && latest.validator_status === 'approved') {
        if (individual) throw new WorkflowError('This version is already under review.', 409)
        continue
      }
      if (latest?.decision === 'needs_changes' && latest.version_token === version.token) {
        if (individual) throw new WorkflowError('Save corrections before resubmitting this version.', 409)
        continue
      }
      prepared.push({ course, version })
    }
    if (!prepared.length) throw new WorkflowError('There are no new or corrected versions eligible to send.', 409)
    // Batch preview is exact. A concurrent assignment or change invalidates confirmation.
    if (!individual && stableJson(prepared.map(({ course, version }) => ({ course_id: course.course_id, version: version.token })))
      !== stableJson(input.courses.map(course => ({ course_id: workflowId(course.course_id), version: course.version })))) {
      throw new WorkflowError('The eligible course list or saved versions changed. Reload and confirm again.', 409)
    }
    const [assignment] = await connection.execute(`INSERT INTO COURSE_VALIDATION_ASSIGNMENT
      (validator_id, admin_id, cluster_category, assignment_type) VALUES (?, ?, ?, ?)`, [validatorId, adminId, cluster, individual ? 'course' : 'cluster'])
    for (const { course, version } of prepared) {
      await supersedePendingReviews(connection, course.course_id)
      await connection.execute(`INSERT INTO COURSE_VALIDATION_ITEM (assignment_id, course_id, version_token, version_snapshot)
        VALUES (?, ?, ?, ?)`, [assignment.insertId, course.course_id, version.token, JSON.stringify(version.snapshot)])
    }
    return { assignment_id: assignment.insertId, count: prepared.length }
  })
}

function requireApproved(validator) {
  if (validator.status !== 'approved') throw new WorkflowError('Review access requires an approved account.', 403)
}

export async function adminReviewRecord(database, itemId) {
  const [[item]] = await database.execute(`SELECT i.version_snapshot FROM COURSE_VALIDATION_ITEM i WHERE i.item_id = ?`, [itemId])
  if (!item) throw new WorkflowError('Review record not found.', 404)
  return { snapshot: parseJson(item.version_snapshot) }
}

export async function adminAssignment(database, assignmentId) {
  const [items] = await database.execute(`SELECT ${itemFields},
    JSON_UNQUOTE(JSON_EXTRACT(i.version_snapshot, '$.course_name')) AS course_name ${joins}
    WHERE i.assignment_id = ? ORDER BY i.course_id`, [assignmentId])
  if (!items.length) throw new WorkflowError('Assignment not found.', 404)
  return { items: items.map(record) }
}

export async function validatorAssignments(database, validator, assignmentId = null) {
  return workflowTransaction(database, async (connection) => {
    const account = await lockValidator(connection, validator.id, validator.sessionVersion)
    requireApproved(account)
    const params = assignmentId ? [validator.id, assignmentId] : [validator.id]
    const filter = assignmentId ? ' AND a.assignment_id = ?' : ''
    const [assignments] = await connection.execute(`SELECT a.* FROM COURSE_VALIDATION_ASSIGNMENT a WHERE a.validator_id = ?${filter}
      ORDER BY a.assignment_id DESC`, params)
    if (assignmentId && !assignments.length) throw new WorkflowError('Assignment not found.', 404)
    const snapshotField = assignmentId ? 'i.version_snapshot' : "JSON_UNQUOTE(JSON_EXTRACT(i.version_snapshot, '$.course_name')) AS course_name"
    const [items] = await connection.execute(`SELECT ${itemFields}, ${snapshotField} ${joins}
      WHERE a.validator_id = ?${filter} ORDER BY i.course_id`, params)
    if (assignmentId && items.length) {
      const [history] = await connection.execute(`SELECT ${itemFields} ${joins}
        WHERE a.validator_id = ? AND i.assignment_id <> ? AND i.course_id IN
        (SELECT course_id FROM COURSE_VALIDATION_ITEM WHERE assignment_id = ?) AND i.decision IN ('needs_changes','approved')
        ORDER BY i.item_id DESC`, [validator.id, assignmentId, assignmentId])
      const [originHistory] = await connection.execute(`SELECT ${itemFields} ${joins}
        JOIN COURSE_REPLACEMENT_DRAFT r ON r.course_id = i.course_id
        JOIN COURSE_VALIDATION_ITEM d ON d.course_id = r.draft_id
        WHERE a.validator_id = ? AND d.assignment_id = ? AND i.decision IN ('needs_changes','approved')
        ORDER BY i.item_id DESC`, [validator.id, assignmentId])
      return { ...assignments[0], items: items.map(item => ({ ...record(item), version_snapshot: parseJson(item.version_snapshot) })),
        history: [...history, ...originHistory].map(record) }
    }
    const grouped = new Map()
    for (const item of items) {
      if (!grouped.has(item.assignment_id)) grouped.set(item.assignment_id, [])
      grouped.get(item.assignment_id).push(item)
    }
    return { assignments: assignments.map(assignment => ({ ...assignment, items: (grouped.get(assignment.assignment_id) || []).map(record) })) }
  })
}

function decisionInput(input) {
  if (!Array.isArray(input?.decisions) || !input.decisions.length || input.decisions.length > 2000) throw new WorkflowError('Choose at least one course decision.')
  const decisions = new Map()
  for (const entry of input.decisions) {
    const id = workflowId(entry?.itemId)
    if (decisions.has(id) || !['approved','needs_changes'].includes(entry.decision) || !/^[a-f0-9]{64}$/.test(entry.version || '')) throw new WorkflowError('Invalid or duplicate course decision.')
    decisions.set(id, { decision: entry.decision, version: entry.version, remarks: workflowText(entry.remarks, 'Remarks', 5000) })
  }
  const approves = [...decisions].filter(([, item]) => item.decision === 'approved').map(([id]) => id).sort((a,b) => a-b)
  if (!approves.length) return { decisions }
  const signature = input.signature
  if (signature?.confirmed !== true || !Array.isArray(signature.itemIds)
    || stableJson([...signature.itemIds].sort((a,b) => a-b)) !== stableJson(approves)) {
    throw new WorkflowError('Explicitly confirm personal review and sign the exact approved courses.')
  }
  if (signature.method === 'typed') return { decisions, signature: { method: 'typed', typedName: workflowText(signature.name, 'Full name', 150), contents: null } }
  if (['drawn','uploaded'].includes(signature.method)) return { decisions, signature: { method: signature.method, typedName: null, contents: reviewImage(signature.image) } }
  throw new WorkflowError('Choose a signature method.')
}

export async function submitDecisions(database, validator, assignmentId, input) {
  const { decisions, signature } = decisionInput(input)
  return workflowTransaction(database, async (connection) => {
    const reviewer = await lockValidator(connection, validator.id, validator.sessionVersion)
    requireApproved(reviewer)
    const [[assignment]] = await connection.execute('SELECT * FROM COURSE_VALIDATION_ASSIGNMENT WHERE assignment_id = ? AND validator_id = ?', [assignmentId, validator.id])
    if (!assignment) throw new WorkflowError('Assignment not found.', 404)
    if (!reviewer.approved_clusters.includes(assignment.cluster_category)) throw new WorkflowError('This assignment is outside your approved expertise.', 403)
    const [items] = await connection.execute('SELECT item_id, course_id, version_token FROM COURSE_VALIDATION_ITEM WHERE assignment_id = ? ORDER BY course_id', [assignmentId])
    const included = items.filter(row => decisions.has(row.item_id))
    if (included.length !== decisions.size) throw new WorkflowError('One or more courses are outside this assignment.', 404)
    for (const item of included) {
      const course = await lockCourse(connection, item.course_id)
      const [[state]] = await connection.execute('SELECT decision FROM COURSE_VALIDATION_ITEM WHERE item_id = ? FOR UPDATE', [item.item_id])
      if (state.decision !== 'pending' || !isEligible(course) || course.cluster_category !== assignment.cluster_category
        || decisions.get(item.item_id).version !== item.version_token
        || (await courseValidationVersion(connection, course)).token !== item.version_token) {
        throw new WorkflowError('A selected course or its assignment changed. Reload before submitting decisions.', 409)
      }
    }
    if (signature?.method === 'typed' && signature.typedName.normalize('NFKC') !== reviewer.full_name.normalize('NFKC')) {
      throw new WorkflowError('Type your full name exactly as shown in your profile.')
    }
    const [[credential]] = await connection.execute('SELECT MAX(credential_id) AS id FROM VALIDATOR_CREDENTIAL WHERE validator_id = ?', [reviewer.validator_id])
    const evidence = JSON.stringify({
      validator_id: reviewer.validator_id, full_name: reviewer.full_name, profession: reviewer.profession,
      affiliation: reviewer.affiliation, expertise: reviewer.expertise, approved_clusters: reviewer.approved_clusters, credential_id: credential.id,
    })
    let signatureId = null
    if (signature) {
      const [created] = await connection.execute(`INSERT INTO COURSE_VALIDATION_SIGNATURE
        (assignment_id, method, typed_name, contents, reviewer_snapshot, confirmation_version) VALUES (?, ?, ?, ?, ?, 'personal-review-v1')`,
      [assignmentId, signature.method, signature.typedName, signature.contents, evidence])
      signatureId = created.insertId
    }
    for (const item of included) {
      const { decision, remarks } = decisions.get(item.item_id)
      await connection.execute(`UPDATE COURSE_VALIDATION_ITEM SET decision = ?, remarks = ?, signature_id = ?,
        reviewer_snapshot = ?, decided_at = CURRENT_TIMESTAMP(6) WHERE item_id = ?`,
      [decision, remarks, decision === 'approved' ? signatureId : null, evidence, item.item_id])
    }
    return { recorded: included.length }
  })
}

export async function privateSignature(database, signatureId, validatorId = null) {
  const [[signature]] = await database.execute(`SELECT s.contents FROM COURSE_VALIDATION_SIGNATURE s
    JOIN COURSE_VALIDATION_ASSIGNMENT a USING (assignment_id) WHERE s.signature_id = ?${validatorId ? ' AND a.validator_id = ?' : ''}`,
  validatorId ? [signatureId, validatorId] : [signatureId])
  if (!signature?.contents) throw new WorkflowError('Signature image not found.', 404)
  return signature.contents
}

function lastCorrection(rows) {
  const latest = rows.find(row => row.decision !== 'superseded')
  return latest?.decision === 'needs_changes' ? latest : null
}

const validationStatus = (row) => ({
  status: row?.decision === 'approved' ? 'validated' : row?.decision === 'needs_changes' ? 'needs_changes' : row?.decision === 'pending' ? 'under_review' : 'pending',
  ...(row?.decision === 'approved' ? { validated_at: row.confirmed_at || row.decided_at } : {}),
})
async function publishedApproval(database, id) {
  const [[approved]] = await database.execute(`SELECT ${itemFields} ${joins}
    JOIN COURSE_PUBLICATION p ON p.validation_item_id = i.item_id WHERE p.course_id = ?`, [id])
  return approved
}
async function replacementApproval(database, id) {
  const [[approved]] = await database.execute(`SELECT ${itemFields} ${joins}
    JOIN COURSE_PUBLICATION p ON p.validation_item_id = i.item_id JOIN COURSE_REPLACEMENT_DRAFT r ON r.draft_id = p.course_id
    WHERE r.course_id = ? AND r.published_at IS NOT NULL ORDER BY r.published_at DESC, r.draft_id DESC LIMIT 1`, [id])
  return approved
}

async function lockPublicCourse(connection, code) {
  const [[course]] = await connection.execute('SELECT * FROM COURSE WHERE course_code = ? AND is_active = 1 AND is_draft = 0 FOR SHARE', [code])
  return course
}

export async function validatedPublicCourse(database, code) {
  const codes = resolveCanonicalCourseIds(code)
  if (codes.length !== 1) return null
  return workflowTransaction(database, async (connection) => {
    const row = await lockPublicCourse(connection, codes[0])
    if (!row) return null
    const course = await getAvailablePublicCourse(codes[0], connection)
    return course ? { ...course, validation: await publicStatus(connection, row) } : null
  })
}

export function publicStatus(connection, course) {
  return withLocalLegacyCatalog(connection, () => currentPublicStatus(connection, course), () => ({ status: 'pending' }))
}

async function currentPublicStatus(connection, course) {
  const approved = await replacementApproval(connection, course.course_id) || await publishedApproval(connection, course.course_id)
  if (approved) return studentValidation(approved)
  const [records] = await connection.execute(`SELECT i.version_token, i.decision, i.decided_at, s.confirmed_at, v.status AS validator_status ${joins}
    WHERE i.course_id = ? AND i.decision <> 'superseded' ORDER BY i.item_id DESC`, [course.course_id])
  if (!records.length) return { status: 'pending' }
  const version = await courseValidationVersion(connection, course)
  const current = records.find(item => item.version_token === version.token && (item.decision !== 'pending' || item.validator_status === 'approved'))
  return studentValidation(current || lastCorrection(records))
}

function studentValidation(row) {
  const result = validationStatus(row)
  return result.validated_at ? { status: result.status, validated_on: new Date(result.validated_at).toISOString().slice(0, 10) }
    : { status: result.status }
}
