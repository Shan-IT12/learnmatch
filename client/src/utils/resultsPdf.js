import { jsPDF } from 'jspdf'

const BRAND_ORANGE = [224, 105, 24]
const SLATE_900 = [15, 23, 42]
const SLATE_600 = [71, 85, 105]
const SLATE_400 = [148, 163, 184]
const BORDER_GRAY = [226, 232, 240]
const EMERALD_700 = [4, 120, 87]
const EMERALD_50 = [236, 253, 245]
const ORANGE_50 = [255, 247, 237]
const SLATE_50 = [248, 250, 252]

const RANK_LABELS = ['Top Match', '2nd Match', '3rd Match']
const BREAKDOWN_LABELS = {
  skill_match: 'Skills',
  interest_match: 'Interests',
  personality_match: 'Personality',
  personal_factor_match: 'Personal Factors',
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u20B1/g, 'PHP ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isVerifiedAssessment(monitoringSummary) {
  return Boolean(
    monitoringSummary?.cameraEnabled === true
    || monitoringSummary?.mode === 'Verified'
  )
}

export function formatLongDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function fetchCourseOverviewsForPdf(apiUrl, recommendations = []) {
  const results = await Promise.allSettled(
    recommendations.map(async (rec) => {
      if (!rec?.course_code) return [rec.course_code, null]
      const res = await fetch(`${apiUrl}/api/public/courses/${encodeURIComponent(rec.course_code)}`)
      if (!res.ok) return [rec.course_code, null]
      const data = await res.json()
      return [rec.course_code, data?.course || null]
    })
  )
  const map = {}
  for (const item of results) {
    if (item.status === 'fulfilled' && item.value?.[0]) {
      map[item.value[0]] = item.value[1]
    }
  }
  return map
}

export function generateResultsPdf({
  studentName = 'Student',
  assessmentDate,
  monitoringSummary = null,
  recommendations = [],
  courseDetailsByCode = {},
  assessment = {},
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const verified = isVerifiedAssessment(monitoringSummary)
  const formattedDate = formatLongDate(assessmentDate)
  let y = 18

  const ensureSpace = (neededMm) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage()
      y = 18
    }
  }

  // Top orange accent rule
  doc.setFillColor(...BRAND_ORANGE)
  doc.rect(0, 0, pageWidth, 4, 'F')

  // Header branding
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...SLATE_900)
  doc.text('Learn', margin, y)
  const learnWidth = doc.getTextWidth('Learn')
  doc.setTextColor(...BRAND_ORANGE)
  doc.text('Match', margin + learnWidth, y)

  // Verification badge (top-right)
  const badgeText = verified ? 'Verified (Camera-Monitored)' : 'Standard Assessment'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  const badgeWidth = doc.getTextWidth(badgeText) + 9
  const badgeX = pageWidth - margin - badgeWidth
  doc.setFillColor(...(verified ? EMERALD_50 : SLATE_50))
  doc.setDrawColor(...(verified ? EMERALD_700 : BORDER_GRAY))
  doc.roundedRect(badgeX, y - 5.5, badgeWidth, 7.5, 2, 2, 'FD')
  doc.setTextColor(...(verified ? EMERALD_700 : SLATE_600))
  doc.text(badgeText, badgeX + 4.5, y - 0.5)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...SLATE_900)
  doc.text('Assessment Results & Course Overview', margin, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...SLATE_600)
  doc.text(`Student: ${sanitizeText(studentName)}   |   Date: ${formattedDate}`, margin, y)

  y += 4
  doc.setDrawColor(...BORDER_GRAY)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // Assessment Snapshot box
  const domainEntries = Object.entries(assessment?.domainScores || {})
  const totalCorrect = domainEntries.reduce((sum, [, s]) => sum + Number(s?.correct || 0), 0)
  const totalQuestions = domainEntries.reduce((sum, [, s]) => sum + Number(s?.total || 0), 0)
  const skillsSummary = totalQuestions > 0
    ? `${totalCorrect}/${totalQuestions} (${Math.round((totalCorrect / totalQuestions) * 100)}%)`
    : 'N/A'

  ensureSpace(32)
  doc.setFillColor(...ORANGE_50)
  doc.setDrawColor(254, 215, 170)
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND_ORANGE)
  doc.text('ASSESSMENT SNAPSHOT', margin + 4, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE_900)
  doc.text(`Personality (MBTI): ${sanitizeText(assessment?.mbti || 'N/A')}`, margin + 4, y + 12.5)
  doc.text(`Academic Skills: ${skillsSummary}`, margin + 62, y + 12.5)
  doc.text(`Mode: ${badgeText}`, margin + 122, y + 12.5)

  const interestsText = (assessment?.interests || []).length
    ? `Selected Interests: ${sanitizeText(assessment.interests.slice(0, 6).join(', '))}`
    : 'Selected Interests: None selected'
  const interestLines = doc.splitTextToSize(interestsText, contentWidth - 8)
  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE_600)
  doc.text(interestLines[0] || '', margin + 4, y + 19)
  y += 30

  // Domain Breakdown (compact 2-column grid if available)
  if (domainEntries.length > 0) {
    ensureSpace(26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...SLATE_900)
    doc.text('Academic Skills Domain Breakdown', margin, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const halfWidth = contentWidth / 2
    domainEntries.forEach(([domain, score], idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      const xPos = margin + col * halfWidth
      const yPos = y + row * 5.5
      const pct = score?.total ? Math.round((score.correct / score.total) * 100) : 0
      doc.setTextColor(...SLATE_600)
      doc.text(`${sanitizeText(domain)}:`, xPos, yPos)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...SLATE_900)
      doc.text(`${score.correct}/${score.total} (${pct}%)`, xPos + 42, yPos)
      doc.setFont('helvetica', 'normal')
    })
    y += Math.ceil(domainEntries.length / 2) * 5.5 + 5
  }

  // Recommended Courses section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...SLATE_900)
  doc.text('Top Recommended Courses & Career Overview', margin, y)
  y += 6

  recommendations.forEach((rec, index) => {
    const detail = courseDetailsByCode[rec.course_code] || null
    const rankText = RANK_LABELS[rec.rank_position - 1] || `#${index + 1}`
    const title = sanitizeText(rec.course_name || 'Recommended Course')
    const narrative = sanitizeText(rec.ai_narrative || '')
    const overview = sanitizeText(detail?.description || '')
    const careers = Array.isArray(detail?.career_opportunities) ? detail.career_opportunities.slice(0, 4) : []

    ensureSpace(46)

    // Course card header strip
    doc.setFillColor(...SLATE_50)
    doc.setDrawColor(...BORDER_GRAY)
    doc.roundedRect(margin, y, contentWidth, 14, 2.5, 2.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...BRAND_ORANGE)
    doc.text(rankText.toUpperCase(), margin + 4, y + 5.5)

    doc.setFontSize(11)
    doc.setTextColor(...SLATE_900)
    const matchText = `${rec.match_score}% match`
    const matchWidth = doc.getTextWidth(matchText)
    const titleLines = doc.splitTextToSize(title, contentWidth - matchWidth - 16)
    doc.text(titleLines[0] || title, margin + 4, y + 11)

    doc.setTextColor(...BRAND_ORANGE)
    doc.text(matchText, pageWidth - margin - matchWidth - 4, y + 9.5)
    y += 17

    // Score Breakdown inline
    if (rec.score_breakdown) {
      const parts = Object.entries(BREAKDOWN_LABELS).map(([key, label]) => {
        const val = rec.score_breakdown[key]
        const display = val === null || (key === 'interest_match' && rec.interests_available === false)
          ? 'Not used'
          : `${val}%`
        return `${label}: ${display}`
      })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE_600)
      doc.text(parts.join('   ·   '), margin + 2, y)
      y += 5.5
    }

    // Why this course fits you
    if (narrative) {
      const lines = doc.splitTextToSize(narrative, contentWidth - 4)
      ensureSpace(lines.length * 4.4 + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE_900)
      doc.text('Why this course fits you:', margin + 2, y)
      y += 4.3
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE_600)
      doc.text(lines, margin + 2, y)
      y += lines.length * 4.1 + 3
    }

    // Course Overview
    if (overview) {
      const lines = doc.splitTextToSize(overview, contentWidth - 4)
      ensureSpace(lines.length * 4.2 + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE_900)
      doc.text('Course Overview:', margin + 2, y)
      y += 4.3
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE_600)
      doc.text(lines, margin + 2, y)
      y += lines.length * 4.1 + 3
    }

    // Career Opportunities & Salary (Est. 2025-2026)
    if (careers.length > 0) {
      ensureSpace(10 + careers.length * 5)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE_900)
      doc.text('Key Career Opportunities & Estimated Monthly Salary (Est. 2025-2026):', margin + 2, y)
      y += 4.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      careers.forEach((career) => {
        const salary = sanitizeText(career?.estimated_monthly_salary_php?.display || '')
        const line = `• ${sanitizeText(career.career_title)}${salary ? ` — ${salary} (Est. 2025-2026)` : ''}`
        const wrapped = doc.splitTextToSize(line, contentWidth - 6)
        ensureSpace(wrapped.length * 4.1 + 1)
        doc.setTextColor(...SLATE_600)
        doc.text(wrapped, margin + 4, y)
        y += wrapped.length * 4.1 + 1
      })
      y += 2
    }

    y += 4
  })

  // Footer on every page
  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p)
    doc.setDrawColor(...BORDER_GRAY)
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_400)
    doc.text(
      'LearnMatch · learnmatch.online · Salary figures (Est. 2025-2026) are Philippine estimates and may vary by employer and experience.',
      margin,
      pageHeight - 9.5
    )
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 9.5, { align: 'right' })
  }

  const safeFile = sanitizeText(studentName).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'Student'
  doc.save(`LearnMatch_Results_${safeFile}.pdf`)
}
