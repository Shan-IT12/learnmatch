import { catalogReferenceHref } from '../../../shared/catalogReferenceFields.js'

const referenceLink = 'font-semibold text-orange-900 underline decoration-orange-300 underline-offset-2'

export default function CourseValidationSnapshot({ snapshot }) {
  const catalog = snapshot.catalog
  const sources = [...snapshot.sources, ...snapshot.catalogSources]
  return <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
    <SnapshotBlock title="Course overview">
      <dl className="grid gap-3 rounded-lg bg-stone-50 px-3 py-2 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold text-slate-600">Parent cluster</dt><dd className="font-medium text-slate-900">{snapshot.cluster_category}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-600">Obtainable skills</dt><dd className="font-medium text-slate-900">{snapshot.obtainable_skills || catalog?.obtainable_skills?.join(', ') || 'None recorded'}</dd></div>
      </dl>
      <p className="whitespace-pre-wrap">{snapshot.description}</p>
      {catalog?.description && catalog.description !== snapshot.description && <details><summary className="cursor-pointer font-medium">Current student catalog description</summary><p className="whitespace-pre-wrap">{catalog.description}</p></details>}
    </SnapshotBlock>
    <SnapshotBlock title="Year-level content">
      {snapshot.year_levels.length ? <dl className="divide-y divide-stone-100">{snapshot.year_levels.map(row => <div className="grid gap-1 py-2 sm:grid-cols-[7rem_1fr] sm:gap-3" key={row.year}>
        <dt className="font-semibold text-slate-900">{row.label || `Year ${row.year}`}</dt><dd className="whitespace-pre-wrap">{row.overview}</dd>
      </div>)}</dl> : <p>No year-level content is recorded.</p>}
    </SnapshotBlock>
    <div className="grid gap-4 lg:grid-cols-2">
      <SnapshotBlock title="Career and salary information">
        {snapshot.careers.map(row => <p key={row.opportunity_id} className="whitespace-pre-wrap"><strong>{row.job_title}</strong> {row.salary_range && `· ${row.salary_range}${/\bEst\.\s*\d{4}/i.test(row.salary_range) ? '' : ' (Est. 2025-2026)'}`} {row.description}</p>)}
        {catalog?.career_opportunities?.map(row => <p key={row.career_id || row.career_title} className="whitespace-pre-wrap"><strong>{row.career_title}</strong> {row.estimated_monthly_salary_php?.display && `· ${row.estimated_monthly_salary_php.display} (Est. 2025-2026)`} {row.philippines_description}
          {catalogReferenceHref(row.salary_basis?.source_url) && <> · <a className={referenceLink} href={row.salary_basis.source_url} target="_blank" rel="noreferrer">{row.salary_basis.source_title || 'Salary reference'}{row.reference_year && ` (${row.reference_year})`}</a></>}
        </p>)}
        {!snapshot.careers.length && !catalog?.career_opportunities?.length && <p>No career entries are recorded.</p>}
      </SnapshotBlock>
      <SnapshotBlock title="Supporting sources">
        {!sources.length && <p>No sources are recorded.</p>}
        {sources.map((row, index) => <p key={row.source_id || `catalog-${index}`} className="break-words">
          {catalogReferenceHref(row.url) ? <a href={row.url} className={referenceLink} target="_blank" rel="noreferrer">{row.title}</a> : row.title}
          {row.notes && ` · ${row.notes}`}{row.supported_fields?.length > 0 && ` · ${row.supported_fields.map(label => label.replaceAll('_', ' ')).join(', ')}`}
        </p>)}
      </SnapshotBlock>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Weights title="Academic skill weights" explanation="These weights represent how strongly the course relies on each assessed academic skill." rows={snapshot.skills} field="skill_domain" />
      <Weights title="RIASEC weights" explanation="These weights describe how strongly the course reflects Realistic, Investigative, Artistic, Social, Enterprising and Conventional work interests." rows={snapshot.riasec} field="riasec_type" />
    </div>
  </div>
}

function SnapshotBlock({ title, children }) {
  return <section className="min-w-0 space-y-2 rounded-xl border border-stone-200 bg-white p-3.5 sm:p-4">
    <h3 className="font-semibold text-slate-950">{title}</h3>
    {children}
  </section>
}

function Weights({ title, explanation, rows, field }) {
  return <SnapshotBlock title={title}>
    <p className="text-xs text-slate-600">{explanation}</p>
    <dl className="divide-y divide-stone-100">{rows.map(row => <div key={row[field]} className="py-2">
      <dt className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{row[field]}<span className="rounded-md bg-orange-50 px-2 text-xs font-semibold text-orange-950">{row.weight}</span></dt>
      <dd className="whitespace-pre-wrap">{row.evidence || 'No evidence supplied'}</dd>
    </div>)}</dl>
  </SnapshotBlock>
}
