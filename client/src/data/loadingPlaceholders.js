// Render-only geometry placeholders; never passed to saves or API requests.
export const coursePlaceholder = {
  course_code: 'loading', course_name: 'Your course and program name', course_abbreviation: 'Course',
  description: 'Explore the course overview, the skills covered by the program, and possible career opportunities. Learn more about the academic journey and what you can expect from this program.',
  obtainable_skills: ['Program skill', 'Applied knowledge', 'Practical experience'],
  career_paths: ['Career opportunity', 'Professional role', 'Related career'],
  program_duration_years: 4,
  year_levels: [1, 2, 3, 4].map(year => ({ year, label: `Year ${year}`, overview: 'Program subjects, practical activities, and learning outcomes for this academic year.' })),
  career_opportunities: [1, 2, 3].map(career_id => ({ career_id, career_title: 'Career opportunity', philippines_description: 'An overview of the work, responsibilities, and related opportunities for this career.', estimated_monthly_salary_php: { display: 'Salary range' } })),
}
export const recommendationPlaceholders = [1, 2, 3].map(rank_position => ({ ...coursePlaceholder, course_id: rank_position, rank_position, match_score: 80 }))
export const collegePlaceholder = { courseName: 'Your enrolled program', yearLevel: '1st Year', semester: '1st Semester', academicYear: '2026-2027', lifecycleStatus: 'active' }
