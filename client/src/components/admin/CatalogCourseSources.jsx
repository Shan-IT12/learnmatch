import DraftDisclosure from './DraftDisclosure'
import { catalogReferenceHref } from '../../../../shared/catalogReferenceFields'

export default function CatalogCourseSources({ catalogReferences }) {
  const sources = catalogReferences?.references || []
  return <DraftDisclosure title="Sources">
    <p className="text-sm text-gray-600">Historical attributions are preserved. Official publications, when located, include a dated scope note. No source has been manually confirmed here, and a reference does not approve matching weights or revalidate saved course details.</p>
    {catalogReferences?.recorded_course_name && <p className="mt-2 text-sm text-gray-600">Recorded course: {catalogReferences.recorded_course_name}</p>}
    {catalogReferences?.recency_review && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Latest references found</p>
      <p className="mt-1">{catalogReferences.recency_review.status === 'official_reference_located' ? 'These are the latest official references identified during our lookup. No applicable 2026 replacement was identified.' : 'These are the recorded references found for this course. No newer applicable CHED memorandum was identified during this lookup.'}</p>
    </div>}
    {!catalogReferences && <p className="mt-3 text-sm text-amber-800">Catalog references could not be loaded. Refresh after updating the backend.</p>}
    {catalogReferences && !sources.length && <p className="mt-3 text-sm text-amber-800">No historical references are recorded for this stable course code. A reference must be researched before one can be attributed.</p>}
    {sources.map((source, index) => <article key={`${source.url}:${source.title}`} className="mt-4 space-y-2 rounded-lg border border-gray-100 p-4 text-sm">
      <h3 className="break-words font-medium">{index + 1}. {source.title || 'Untitled recorded reference'}</h3>
      <p className="text-xs font-medium text-gray-600">{source.reference_update ? `Official publication located (${source.reference_update.series_year}) - ${source.reference_update.scope.replaceAll('_', ' ')}` : 'Historical attribution - current applicability not established'}</p>
      {source.reference_update && <><p className="whitespace-pre-wrap break-words"><strong>Reference scope:</strong> {source.reference_update.scope_note}</p><p className="text-xs text-gray-600">Checked: {source.reference_update.checked_on}. {source.reference_update.check_method}. Locator: {source.reference_update.locator}.</p></>}
      {catalogReferenceHref(source.url) ? <><a className="inline-block text-orange-700 underline" href={catalogReferenceHref(source.url)} target="_blank" rel="noopener noreferrer">Open Source</a><p className="break-all text-xs text-gray-500">{source.url}</p></> : <p className="text-amber-800">No usable URL is recorded for this historical reference. The title is preserved; no link has been guessed.</p>}
      {[...new Set(source.records.filter(record => record.file !== 'learnmatch_catalog_reference_updates.json').map(record => record.used_for).filter(Boolean))].map(purpose => <p key={purpose} className="whitespace-pre-wrap break-words"><strong>Recorded use:</strong> {purpose}</p>)}
      <details className="text-xs text-gray-600"><summary className="cursor-pointer">View recorded provenance</summary><ul className="mt-2 space-y-2">{source.records.map(record => <li key={`${record.file}:${record.path}`}><p>{record.dataset}</p><p className="break-all">{record.file} - {record.path}</p>{record.title !== source.title && <p>Recorded title: {record.title || 'Not supplied'}</p>}</li>)}</ul></details>
    </article>)}
    {!!catalogReferences?.omitted_count && <p className="mt-3 text-sm text-gray-600">Showing up to 3 of {catalogReferences.total_references} recorded references. Additional references remain preserved in the original catalog files.</p>}
  </DraftDisclosure>
}
