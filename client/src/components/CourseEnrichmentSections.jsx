const SALARY_DISCLAIMER = 'Salary figures are estimates for the Philippines and may vary by employer, experience, location, and industry.'

function CourseEnrichmentSections({ course, compact = false }) {
  const yearLevels = course?.year_levels || []
  const careers = course?.career_opportunities || []

  return (
    <div className={compact ? 'space-y-5' : 'grid lg:grid-cols-[1.05fr_1fr] gap-6'}>
      <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Your path through the program</h2>
        {course?.program_duration_years && <p className="text-xs text-gray-400 mt-1 mb-5">Typical {course.program_duration_years}-year program roadmap</p>}
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
          {yearLevels.map((item) => (
            <div key={`${item.year}-${item.label}`} className="relative mb-6 last:mb-0">
              <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-orange-500 border-2 border-white shadow" />
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">{item.label || `Year ${item.year}`}</p>
              <p className="text-sm text-gray-600 leading-6">{item.overview}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Career opportunities</h2>
        <p className="text-xs text-gray-500 leading-5 mt-1 mb-5">{SALARY_DISCLAIMER}</p>
        <div className="space-y-4">
          {careers.map((career) => (
            <article key={career.career_id || career.career_title} className="border border-gray-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900">{career.career_title}</h3>
              <p className="text-sm font-medium text-orange-600 mt-1">{career.estimated_monthly_salary_php?.display}</p>
              <p className="text-sm text-gray-600 leading-6 mt-3">{career.philippines_description}</p>
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">Reference year: {career.reference_year}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default CourseEnrichmentSections
