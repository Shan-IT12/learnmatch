export async function getAdminCourses(database) {
  const [courses] = await database.query(
    `SELECT course_id, course_code, course_name, course_abbreviation, program_type, cluster_category, psced_group, is_active
     FROM COURSE
     ORDER BY course_name ASC`
  )
  return courses
}

export async function setCourseActiveStatus(database, courseId, isActive) {
  if (typeof isActive !== 'boolean') {
    const error = new TypeError('is_active must be a boolean')
    error.code = 'INVALID_COURSE_STATUS'
    throw error
  }

  const [result] = await database.query(
    'UPDATE COURSE SET is_active = ? WHERE course_id = ?',
    [isActive ? 1 : 0, courseId]
  )

  return result.affectedRows > 0
}
