function summarizeFactor(courses) {
  const applied = courses.filter(course => course.applied === 1).length
  const unknown = courses.filter(course => course.applied === null).length
  if (!courses.length || unknown === courses.length) return 'Field details are unavailable for these matches.'
  if (applied === courses.length) return `Considered for all ${courses.length} of your matches.`
  if (!applied && !unknown) return 'Did not change these matches because this factor does not apply to their fields.'
  return `Considered for ${applied} of your ${courses.length} matches.${unknown ? ` Field details are unavailable for ${unknown}.` : ''}`
}

export default function PersonalFactorExplanation({ factors }) {
  if (!factors.length) return null
  return <details className="group border-t border-gray-100 px-5 py-4 sm:px-6">
    <summary className="cursor-pointer rounded-lg text-sm font-semibold text-orange-700 marker:text-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
      How your personal factors were considered
    </summary>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">A higher reported impact can lower a match score when that factor is relevant to the course.</p>
    <div className="mt-3 divide-y divide-gray-100">
      {factors.map(factor => <section key={factor.factor} className="py-3">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">{factor.label} <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{factor.impact}/4 impact</span></h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">{summarizeFactor(factor.courses)}</p>
      </section>)}
    </div>
  </details>
}
