import { COURSE_SOURCE_FIELDS } from '../../../../shared/courseSourceFields'

// Plain React text only: both source content and model interpretation are untrusted.
export default function SourceAnalysisDetails({ report, view = 'all' }) {
  const notCompleted = report.analysis_completed === false || report.fetch_status === 'failed' || report.parse_status === 'failed'
  return <>
    {view !== 'diagnostics' && report.target_course_name && <p className="mt-2"><strong>Entered course:</strong> {report.target_course_name}</p>}
    {view === 'all' && report.pdf_scope?.partial && <p className="mt-2 text-amber-800"><strong>Partial PDF review:</strong> Only pages 1–{report.pdf_scope.read_pages} of {report.pdf_scope.total_pages} were read. Later pages were not checked.</p>}
    {view !== 'diagnostics' && !notCompleted && report.relationship && <div className="mt-2 space-y-1">
      <p><strong>Source program(s):</strong> {report.relationship.source_programs?.length ? report.relationship.source_programs.join('; ') : 'Not established'}</p>
      <p><strong>Relationship:</strong> {report.relationship.kind}</p>
      <p><strong>Explanation:</strong> {report.relationship.explanation}</p>
    </div>}
    {view !== 'findings' && <p className="mt-2"><strong>Analysis method:</strong> {notCompleted ? 'Analysis not completed' : report.method || 'Basic'}</p>}
    {view === 'all' && !notCompleted && report.reading_method === 'pdf_vision' && <p><strong>AI-read PDF:</strong> Page references and response structure were checked. Transcriptions were not independently text-verified. Open each cited page and review it yourself.</p>}
    {view === 'all' && report.analysis_notice && <p><strong>Checking notice:</strong> {report.analysis_notice}</p>}
    {view !== 'findings' && report.analysis_failure && <p className="mt-2"><strong>Failure stage:</strong> {report.analysis_failure.stage} / {report.analysis_failure.code}{report.analysis_failure.http_status ? ` (HTTP ${report.analysis_failure.http_status})` : ''}{report.analysis_failure.provider_code ? ` — ${report.analysis_failure.provider_code}` : ''}{report.analysis_failure.provider_param ? `; parameter: ${report.analysis_failure.provider_param}` : ''}</p>}
    {view !== 'findings' && report.analysis_failure && <p className="mt-1 text-xs text-gray-600"><strong>Timing:</strong> {Number.isFinite(report.analysis_failure.elapsed_ms) ? `${(report.analysis_failure.elapsed_ms / 1000).toFixed(1)}s elapsed` : 'Elapsed time unavailable'}{Number.isFinite(report.analysis_failure.timeout_ms) ? `; stage limit ${report.analysis_failure.timeout_ms / 1000}s` : ''}{report.analysis_failure.fetch_phase ? `; fetch phase: ${report.analysis_failure.fetch_phase}` : ''}</p>}
    {view !== 'diagnostics' && !notCompleted && !!report.claims?.length && <div className="mt-3"><strong>Information assessed:</strong>{report.claims.map(claim => <p key={claim.field} className="mt-2"><strong>{COURSE_SOURCE_FIELDS[claim.field]} — {claim.support === 'direct' ? report.evidence_grounding === 'ai_read' ? 'AI-read fact; verify manually' : 'Direct passage found' : claim.support === 'inference' ? 'Inference only' : 'Unresolved'}:</strong> {claim.explanation}</p>)}{view === 'all' && <p className="mt-2 text-xs">Explanations are unverified analysis. Compare them with the source before confirming. Complete coverage and conflict detection are not guaranteed.</p>}</div>}
    {view === 'all' && !!report.manual_review?.length && <div className="mt-3"><strong>Manual review / conflicts:</strong><ul className="list-disc pl-5">{report.manual_review.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
    {view === 'all' && !!report.coverage?.length && <div className="mt-3"><strong>Coverage limitations:</strong><ul className="list-disc pl-5">{report.coverage.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
  </>
}
