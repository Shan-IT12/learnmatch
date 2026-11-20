import { allocateCourseCode } from './courseDraftService.js'
import { courseValidationVersion, bumpValidationRevision } from './courseValidationService.js'
import { WorkflowError, workflowTransaction } from './workflowSupport.js'

export async function createReplacementDraft(database, courseId, expectedVersion) {
  return workflowTransaction(database, async (connection) => {
    const [[allocator]] = await connection.query('SELECT next_number FROM COURSE_CODE_ALLOCATOR WHERE allocator_id = 1 FOR UPDATE')
    const [[course]] = await connection.execute('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [courseId])
    if (!course || Number(course.is_draft) || Number(course.is_active) !== 1) throw new WorkflowError('Choose an active published course.', 409)
    const [[old]] = await connection.execute('SELECT draft_id FROM COURSE_REPLACEMENT_DRAFT WHERE open_course_id = ?', [courseId])
    if (old) return { draftId: old.draft_id }
    const version = await courseValidationVersion(connection, course)
    if (version.token !== expectedVersion) throw new WorkflowError('The course changed. Reload before creating a replacement draft.', 409)
    const courseCode = await allocateCourseCode(connection, allocator.next_number)
    const [draft] = await connection.execute(`INSERT INTO COURSE
      (course_code, course_name, course_abbreviation, program_type, cluster_category, psced_group, description, is_active, obtainable_skills,
       is_draft, program_duration_years, year_levels) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`,
    [courseCode, course.course_name, course.course_abbreviation, course.program_type, course.cluster_category, course.psced_group,
      course.description, course.obtainable_skills, version.snapshot.program_duration_years, JSON.stringify(version.snapshot.year_levels)])
    const draftId = draft.insertId
    await connection.execute('INSERT INTO COURSE_REPLACEMENT_DRAFT (draft_id, course_id, base_token) VALUES (?, ?, ?)', [draftId, courseId, version.token])
    const copiedCareers = await copyReviewContent(connection, courseId, draftId)
    if (!copiedCareers) {
      for (const career of version.snapshot.catalog?.career_opportunities || []) {
        await connection.execute('INSERT INTO CAREER_OPPORTUNITY (course_id, job_title, salary_range, description) VALUES (?, ?, ?, ?)',
          [draftId, career.career_title.slice(0, 150), career.estimated_monthly_salary_php?.display?.slice(0, 100) || null, career.philippines_description || null])
      }
    }
    const [sources] = await connection.execute(`SELECT s.title, s.url, s.supported_fields, s.notes
      FROM COURSE_DRAFT_SOURCE s WHERE s.is_removed = 0 AND s.course_id = COALESCE(
        (SELECT draft_id FROM COURSE_REPLACEMENT_DRAFT WHERE course_id = ? AND published_at IS NOT NULL
          ORDER BY published_at DESC, draft_id DESC LIMIT 1), ?)`, [courseId, courseId])
    for (const source of sources) {
      await connection.execute(`INSERT INTO COURSE_DRAFT_SOURCE (course_id, title, url, supported_fields, notes)
        VALUES (?, ?, ?, ?, ?)`, [draftId, source.title, source.url, typeof source.supported_fields === 'string'
        ? source.supported_fields : JSON.stringify(source.supported_fields), source.notes])
    }
    return { draftId }
  })
}

async function copyReviewContent(connection, from, to, replacing = false) {
  for (const [table, domain] of [['COURSE_SKILL_PROFILE','skill_domain'], ['COURSE_RIASEC_PROFILE','riasec_type']]) {
    if (replacing) {
      await connection.execute(`DELETE p FROM ${table} p LEFT JOIN ${table} d ON d.course_id = ? AND p.${domain} = d.${domain}
        WHERE p.course_id = ? AND d.course_id IS NULL`, [from, to])
    }
    await connection.execute(`INSERT INTO ${table} (course_id, ${domain}, weight, evidence)
      SELECT ?, ${domain}, weight, evidence FROM ${table} WHERE course_id = ?
      ON DUPLICATE KEY UPDATE weight = VALUES(weight), evidence = VALUES(evidence)`, [to, from])
  }
  if (replacing) {
    // Keep the IDs of careers copied into the draft when they still exist.
    const [originals] = await connection.execute('SELECT opportunity_id FROM CAREER_OPPORTUNITY WHERE course_id = ?', [to])
    const [draftCareers] = await connection.execute('SELECT opportunity_id, job_title, salary_range, description FROM CAREER_OPPORTUNITY WHERE course_id = ?', [from])
    const [links] = await connection.execute('SELECT original_id, draft_career_id FROM COURSE_REPLACEMENT_CAREER WHERE draft_id = ?', [from])
    const byOriginal = new Map(links.map(row => [row.original_id, row.draft_career_id]))
    const byDraft = new Map(draftCareers.map(row => [row.opportunity_id, row]))
    for (const { opportunity_id } of originals) {
      const draftId = byOriginal.get(opportunity_id)
      const career = byDraft.get(draftId)
      if (career) {
        await connection.execute('UPDATE CAREER_OPPORTUNITY SET job_title = ?, salary_range = ?, description = ? WHERE opportunity_id = ?',
          [career.job_title, career.salary_range, career.description, opportunity_id])
        byDraft.delete(draftId)
      } else {
        await connection.execute('DELETE FROM CAREER_OPPORTUNITY WHERE opportunity_id = ?', [opportunity_id])
      }
    }
    for (const career of byDraft.values()) {
      await connection.execute('INSERT INTO CAREER_OPPORTUNITY (course_id, job_title, salary_range, description) VALUES (?, ?, ?, ?)',
        [to, career.job_title, career.salary_range, career.description])
    }
  } else {
    const [careers] = await connection.execute('SELECT opportunity_id, job_title, salary_range, description FROM CAREER_OPPORTUNITY WHERE course_id = ?', [from])
    for (const career of careers) {
      const [row] = await connection.execute('INSERT INTO CAREER_OPPORTUNITY (course_id, job_title, salary_range, description) VALUES (?, ?, ?, ?)',
        [to, career.job_title, career.salary_range, career.description])
      await connection.execute('INSERT INTO COURSE_REPLACEMENT_CAREER (draft_id, original_id, draft_career_id) VALUES (?, ?, ?)', [to, career.opportunity_id, row.insertId])
    }
    return careers.length
  }
}

export async function publishReplacement(database, draft) {
  const [[replacement]] = await database.execute('SELECT course_id, base_token FROM COURSE_REPLACEMENT_DRAFT WHERE draft_id = ? AND published_at IS NULL', [draft.course_id])
  if (!replacement) return null
  const [[original]] = await database.execute('SELECT * FROM COURSE WHERE course_id = ? FOR UPDATE', [replacement.course_id])
  if (!Number(original.is_active) || (await courseValidationVersion(database, original)).token !== replacement.base_token) {
    throw new WorkflowError('The published course changed after this draft was started. Review the current course before publishing.', 409)
  }
  await database.execute(`UPDATE COURSE live JOIN COURSE draft ON draft.course_id = ?
    SET live.course_name = draft.course_name, live.course_abbreviation = draft.course_abbreviation,
      live.cluster_category = draft.cluster_category, live.program_type = draft.program_type, live.psced_group = draft.psced_group,
      live.description = draft.description, live.obtainable_skills = draft.obtainable_skills,
      live.program_duration_years = draft.program_duration_years, live.year_levels = draft.year_levels
    WHERE live.course_id = ?`, [draft.course_id, original.course_id])
  await copyReviewContent(database, draft.course_id, original.course_id, true)
  await bumpValidationRevision(database, original.course_id)
  await database.execute('UPDATE COURSE_REPLACEMENT_DRAFT SET published_at = CURRENT_TIMESTAMP(6) WHERE draft_id = ?', [draft.course_id])
  return original
}
