import { courseMatchingRubric as rubric } from '../../data/courseMatchingRubric'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { draftCourseExample as example } from '../../data/draftCourseExample'
import { setupExampleDialog } from '../../utils/exampleDialogFocus'

const linkClass = 'break-words text-orange-700 underline underline-offset-2'
const buttonClass = 'rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2'
const sectionClass = 'space-y-3 border-t border-gray-200 pt-5'
const passages = [
  { page: 1, section: 'Subject heading', quote: 'BACHELOR OF SCIENCE IN MANAGEMENT ACCOUNTING (BSMA)', explanation: 'Identifies the official program and short name.' },
  { page: 3, section: 'Section 5.2, Nature of the Field of Study', quote: 'apply accounting and finance skills', explanation: 'Describes the field and its accounting/finance focus.' },
  { page: 6, section: 'Section 6.1, outcome 2', quote: 'effectively communicate orally and in writing', explanation: 'Provides a communication outcome, relevant context for the stored Verbal and Social evidence notes.' },
  { page: 7, section: 'Section 6.3, outcome 2', quote: 'conduct management accounting research', explanation: 'Documents a research outcome; use it only for the information it supports.' },
]

function ReferencePassages() {
  return <section className={sectionClass}>
    <h3 className="font-semibold">Verified source passages</h3>
    <p><a className={linkClass} href={example.source.url} target="_blank" rel="noopener noreferrer">{example.source.title} (CHED PDF)</a></p>
    <p className="text-xs text-gray-600">Pages below are PDF page numbers. These passages were visually checked for this example; they are not an original admin review record.</p>
    {passages.map(passage => <div key={passage.page} className="rounded-lg bg-gray-50 p-3">
      <a className={linkClass} href={`${example.source.url}#page=${passage.page}`} target="_blank" rel="noopener noreferrer">Page {passage.page}: {passage.section}</a>
      <blockquote className="mt-2 border-l-2 border-orange-200 pl-3">“{passage.quote}”</blockquote>
      <p className="mt-2 text-xs text-gray-600">{passage.explanation}</p>
    </div>)}
  </section>
}

function ProjectReferences() {
  return <details className="rounded-lg border border-gray-200 p-3 text-xs">
    <summary className="cursor-pointer font-medium">Project record references</summary>
    <p className="mt-2">Bundled matching profile, course_id {example.courseCode}:</p>
    <code className="block break-all">{example.profileFile}</code>
    <p className="mt-2">Bundled catalog record, course_id {example.courseCode}:</p>
    <code className="block break-all">{example.catalogFile}</code>
    <p className="mt-2">This is a documented guidance snapshot, not a live database lookup or a claim that this course has completed admin review.</p>
  </details>
}

function MatchingExample() {
  return <>
    <section className="space-y-2">
      <h3 className="font-semibold">Learn the steps with {example.courseCode}</h3>
      <p>{example.catalogName} ({example.abbreviation}) - {example.cluster}</p>
      <p>Follow the source passage, identify the dimension, explain its relationship, then apply the relevance rubric. The explanations below were written for this tutorial; they are not original assignment records or approvals.</p>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold">Documented relevance rubric</h3>
      <p><a className={linkClass} href={rubric.source.url} target="_blank" rel="noopener noreferrer">{rubric.source.title}, pages 2-3</a>: skill levels are on pages 2-3; RIASEC levels and definitions are on page 3. The link contains only the relevant reference material.</p>
      <dl className="grid gap-3 sm:grid-cols-2">{rubric.levels.map(level => <div key={level.value} className="rounded-lg bg-gray-50 p-3"><dt className="font-medium">{level.label} = {level.value}</dt><dd>{level.meaning}</dd></div>)}</dl>
      <p className="text-xs text-gray-600">Use course-specific evidence, not cluster membership alone. In this form, leave unsupported skill domains unselected: selected skill weights remain 1-3. Complete all six RIASEC entries, using 0 when there is no meaningful supporting evidence. These are course-relevance weights, not student grades.</p>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold">Worked examples: evidence to relevance</h3>
      {example.tutorials.map(item => {
        const recorded = example.rows.find(row => row.dimension === item.dimension && row.group === item.group)
        const level = rubric.levels.find(entry => entry.value === item.rubricValue)
        return <article key={item.dimension} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold">{item.group}: {item.dimension}</h4>
          <ol className="list-decimal space-y-3 pl-5">
            <li><strong>Source and passage.</strong> <a className={linkClass} href={`${example.source.url}#page=${item.page}`} target="_blank" rel="noopener noreferrer">{example.source.title}, page {item.page}, {item.section}</a>{item.passage ? <blockquote className="mt-1 border-l-2 border-orange-200 pl-3">&quot;{item.passage}&quot;</blockquote> : <p className="mt-1">Source summary: {item.sourceSummary}</p>}</li>
            <li><strong>Related dimension:</strong> {item.dimension}. <p className="mt-1">Existing bundled evidence note: {recorded.evidence}</p></li>
            <li><strong>Relationship (new tutorial explanation).</strong> {item.relationship}</li>
            <li><strong>Apply the documented rubric.</strong> {item.application}<p className="mt-2">Illustrative application: <strong>{level.label} = {level.value}</strong>. Separately, the existing recorded weight is <strong>{recorded.weight}</strong>.</p></li>
          </ol>
          <p className="text-xs text-gray-600">Existing record field: <code className="break-all">{recorded.recordReference}</code>. No value is copied to your draft.</p>
        </article>
      })}
    </section>
    <aside className="rounded-lg bg-amber-50 p-3 text-sm">
      <h3 className="font-semibold">Historical limits</h3>
      <p className="mt-1">{example.historicalNote} The profile name is &quot;{example.profileName}&quot;, while the catalog/reference use &quot;{example.catalogName}&quot;; resolution is not recorded. Inferred or blank-evidence assignments are excluded from this teaching example, without changing the stored profile.</p>
    </aside>
    <ProjectReferences />
  </>
}

const supportExamples = [
  { label: 'Course name', selected: true, why: 'Page 1 names the program. Use the official name, and resolve the bundled name discrepancy before relying on the profile.' },
  { label: 'Description', selected: true, why: 'Section 5.2 on page 3 explains the field and its management-accounting focus. Summarize it accurately in your own words.' },
  { label: 'Obtainable skills', selected: true, why: 'Page 3 names accounting/finance skills; pages 6 and 7 include communication and research outcomes. Select only skills you can tie to those passages.' },
  { label: 'Duration', selected: false, why: 'A source-based duration citation for this example is Not documented. This does not establish that the full reference lacks duration information.' },
  { label: 'Matching-profile evidence', selected: false, why: 'Original page-linked assignments for the stored profile are not documented. The matching tutorial provides new illustrative mappings, not historical approval. Leave this clear until you document the basis for your own proposed profile; source support does not approve weights.' },
]

function SourcesExample() {
  return <>
    <section className="space-y-3">
      <h3 className="font-semibold">How one reference could be entered</h3>
      <p>Example target: {example.catalogName} ({example.abbreviation}). These entries are shown only here; nothing is added to your draft.</p>
      <dl className="space-y-3 rounded-lg bg-gray-50 p-4">
        <div><dt className="font-medium">Source URL</dt><dd><a className={`${linkClass} break-all`} href={example.source.url} target="_blank" rel="noopener noreferrer">{example.source.url}</a></dd><dd className="mt-1 text-xs text-gray-600">Use the document itself, not a search-results link.</dd></div>
        <div><dt className="font-medium">Title</dt><dd>{example.source.title} — BS Management Accounting policies, standards and guidelines</dd><dd className="mt-1 text-xs text-gray-600">Identify the reference so another reviewer can find it.</dd></div>
        <div><dt className="font-medium">Notes (optional)</dt><dd>Program name: page 1. Field description: section 5.2, page 3. Outcomes: sections 6.1 and 6.3, pages 6–7. Review manually; this PDF has 31 pages.</dd><dd className="mt-1 text-xs text-gray-600">Use notes for useful locations and reading limitations, not proof of approval.</dd></div>
      </dl>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold">Information Supported: why each box is selected or left clear</h3>
      <p className="text-xs text-gray-600">Read-only illustration. In your draft, select only what you have personally checked.</p>
      {supportExamples.map(item=><div key={item.label} className="rounded-lg border border-gray-200 p-3"><p className="font-medium">{item.selected ? 'Selected' : 'Not selected'}: {item.label}</p><p className="mt-1">{item.why}</p></div>)}
    </section>
    <ReferencePassages />
    <section className={sectionClass}>
      <h3 className="font-semibold">How to read Check Sources results</h3>
      <p><strong>Potential Match:</strong> the entered target course and supporting text were found, and both the original and final source hosts are explicitly approved. It is not verification.</p>
      <p><strong>Needs Review:</strong> inspect the reference yourself when origin is unverified, content is unrelated or unclear, or reading fails. A logo, official-looking title or matching words do not establish origin.</p>
      <p><strong>This PDF:</strong> Needs Review because it has 31 pages and the current reader allows 30. This example does not run a live check or assert that its host is currently approved. Scanned PDFs also require manual review.</p>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold">When you may confirm</h3>
      <p>The source URL must use an explicitly approved publisher host. Unapproved URLs cannot be saved or confirmed, including local test references. An approved origin alone does not prove relevance.</p>
      <p>Open the reference, verify its origin, compare its actual content with your entered target and selected information, and resolve conflicts. If the checker cannot read it, manual inspection is still necessary; Needs Review is not permission to confirm without reading.</p>
      <p>Only then select the admin confirmation and record it for the draft. Your admin identity and server date are recorded on save. Relevant edits require another confirmation.</p>
      <p className="rounded-lg bg-amber-50 p-3">Source confirmation does not approve matching weights, automatically verify the course, or publish it.</p>
    </section>
    <ProjectReferences />
  </>
}

function ExampleModal({ kind, onClose, trigger }) {
  const dialog = useRef(null)
  const closeButton = useRef(null)
  const id = useId()
  useEffect(() => setupExampleDialog(dialog.current, closeButton.current, trigger.current), [trigger])
  return createPortal(<dialog ref={dialog} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event=>{event.preventDefault();onClose()}} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-2xl border border-orange-100 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-4 sm:px-5">
      <div><h2 id={`${id}-title`} className="text-xl font-semibold">{kind==='matching'?'Course Matching example':'Sources example'}</h2><p id={`${id}-description`} className="mt-1 text-sm text-gray-600">Read-only guidance. Opening or closing this example leaves your form unchanged.</p></div>
      <button ref={closeButton} type="button" className={buttonClass} onClick={onClose} aria-label="Close example">Close</button>
    </header>
    <div className="space-y-5 p-4 text-sm leading-6 sm:px-5">{kind==='matching'?<MatchingExample />:<SourcesExample />}</div>
    <footer className="border-t border-gray-200 p-4 sm:px-5"><button type="button" className={buttonClass} onClick={onClose}>Close example</button></footer>
  </dialog>,document.body)
}

export default function DraftCourseExample({ kind }) {
  const [open,setOpen]=useState(false)
  const trigger=useRef(null)
  return <><button ref={trigger} type="button" className={buttonClass} aria-haspopup="dialog" onClick={()=>setOpen(true)}>View Example<span className="sr-only">: {kind==='matching'?'Course Matching':'Sources'}</span></button>{open && <ExampleModal kind={kind} onClose={()=>setOpen(false)} trigger={trigger} />}</>
}
