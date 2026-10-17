import { sourceEvidencePageUrl } from '../../utils/sourceEvidencePage'

export default function SourceEvidenceExcerpts({ report, sourceUrlPolicy, showGroundingLabel = true }) {
  return (report.excerpts || report.suggestions || []).map((excerpt, i) => {
    const link = sourceEvidencePageUrl(excerpt, sourceUrlPolicy)
    return <blockquote key={excerpt.id || `${excerpt.location}-${i}`} className="mt-3 whitespace-pre-wrap border-l-2 border-orange-200 pl-3">
      {showGroundingLabel && excerpt.grounding === 'ai_read' && <p className="mb-1 text-xs"><strong>AI-read excerpt — verify manually.</strong></p>}
      {excerpt.text || excerpt.evidence?.excerpt}
      <p className="mt-1 text-xs text-gray-600">{excerpt.location || excerpt.evidence?.location}</p>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-orange-700 underline">Open cited PDF page {excerpt.pdf_page}</a>}
    </blockquote>
  })
}
