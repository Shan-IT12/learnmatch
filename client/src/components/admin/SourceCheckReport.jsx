import { sourceReportHeading } from '../../utils/draftSourceCheckForm'
import SourceAnalysisDetails from './SourceAnalysisDetails'
import SourceEvidenceExcerpts from './SourceEvidenceExcerpts'
import SourceCheckResults from './SourceCheckResults'
import { DraftGuidance } from './DraftDisclosure'

const distinct = values => [...new Set(values.filter(Boolean).map(value => value.trim()))]

export default function SourceCheckReport({ report, previous = false, sourceUrlPolicy, summaryOnly = false, detailsOnly = false }) {
  const reasons = distinct(report.reasons || [])
  const notice = report.analysis_failure?.message || report.analysis_notice
  const warnings = distinct([notice, ...(report.manual_review || [])]).filter(text => !reasons.includes(text))
  const coverage = distinct(report.coverage || []).filter(text => !reasons.includes(text) && !warnings.includes(text))
  return <>
    {!detailsOnly && <div className="min-w-0 space-y-2 break-words text-sm [overflow-wrap:anywhere]">
      <p className="font-semibold text-gray-900">{sourceReportHeading(report)}</p>
      {previous && <p className="text-amber-800">Previous analysis: Information supported changed. These results are retained for reference and are not a current check or confirmation. Check again if you need updated results.</p>}
      {reasons.map(reason => <p key={reason}>{reason}</p>)}
      {report.evidence_grounding === 'ai_read' && <p className="text-amber-800">AI-read evidence: excerpts are transcriptions, not independently text-verified. Open cited pages and review them manually.</p>}
      {warnings.length > 0 && <ul className="list-disc space-y-1 pl-5 text-amber-800">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      {report.pdf_scope?.partial && !coverage.some(text => text.startsWith('Partial PDF review:')) && <p className="text-amber-800">Partial PDF review: only pages 1–{report.pdf_scope.read_pages} of {report.pdf_scope.total_pages} were read. Later pages were not checked.</p>}
      {coverage.filter(text => text.startsWith('Partial PDF review:')).map(text => <p className="text-amber-800" key={text}>{text}</p>)}
    </div>}
    {!summaryOnly && <div className="min-w-0 space-y-3 break-words [overflow-wrap:anywhere]">
      <SourceCheckResults initialExpanded={false} flat>
        <SourceAnalysisDetails report={report} view="findings" />
        <SourceEvidenceExcerpts report={report} sourceUrlPolicy={sourceUrlPolicy} showGroundingLabel={false} />
      </SourceCheckResults>
      {coverage.some(text => !text.startsWith('Partial PDF review:')) && <DraftGuidance label="View coverage limitations"><ul className="list-disc pl-5">{coverage.filter(text => !text.startsWith('Partial PDF review:')).map(text => <li key={text}>{text}</li>)}</ul></DraftGuidance>}
      <DraftGuidance label="View technical diagnostics"><SourceAnalysisDetails report={report} view="diagnostics" />{report.usage && <><p className="font-medium">Reported usage and cost metadata</p><pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(report.usage, null, 2)}</pre></>}</DraftGuidance>
    </div>}
  </>
}
