import { sourceUrlError } from '../../../shared/sourceUrlPolicy.js'

export function sourceEvidencePageUrl(excerpt, policy) {
  if (excerpt.grounding !== 'ai_read' || typeof excerpt.url !== 'string' || !excerpt.url.trim() || !Number.isInteger(excerpt.pdf_page) || excerpt.pdf_page < 1 || excerpt.pdf_page > 30 || sourceUrlError(excerpt.url, policy)) return null
  const url = new URL(excerpt.url)
  url.hash = `page=${excerpt.pdf_page}`
  return url.href
}
