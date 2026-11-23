import { jsPDF } from 'jspdf'

export function getCertificateBody({ type = 'assessment', variant = 'standard', formattedDate }) {
  if (type === 'college') {
    return `For successfully completing the College Phase of the LearnMatch Course Recommendation and Career Alignment Tracking Companion, including program setup, semester check-ins, and alignment review, on ${formattedDate}. Your dedication and commitment to reflecting on your chosen path are highly appreciated.`
  }
  if (variant === 'verified') {
    return `For successfully completing the Verified LearnMatch Assessment (Camera-Monitored), covering Personal Factors, Interests, Academic Skills, and Personality, and receiving your personalized course recommendations on ${formattedDate}. Your integrity, dedication, and commitment to exploring your future are highly appreciated.`
  }
  return `For successfully completing the LearnMatch assessment, covering Personal Factors, Interests, Academic Skills, and Personality, and receiving your personalized course recommendations on ${formattedDate}. Your dedication and commitment to exploring your future are highly appreciated.`
}

function drawFourPointStar(doc, cx, cy, outerR, innerR, fillRgb) {
  doc.setFillColor(...fillRgb)
  const points = []
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / 4) * i - Math.PI / 2
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
  }
  const lines = []
  for (let i = 1; i < points.length; i += 1) {
    lines.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]])
  }
  doc.lines(lines, points[0][0], points[0][1], [1, 1], 'F', true)
}

function drawMonogram(doc, cx, topY) {
  const primary = [224, 105, 24]
  const secondary = [249, 115, 22]

  // Stylized LM monogram block (always LearnMatch orange)
  doc.setFillColor(...primary)
  doc.rect(cx - 10, topY, 3, 10, 'F')
  doc.rect(cx - 10, topY + 7.4, 8, 2.6, 'F')

  doc.setFillColor(...secondary)
  doc.rect(cx - 0.5, topY, 2.8, 10, 'F')
  doc.rect(cx + 7.2, topY, 2.8, 10, 'F')
  doc.triangle(cx + 1, topY, cx + 4.8, topY + 5.8, cx + 8.6, topY, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(154, 52, 18)
  doc.text('LearnMatch', cx, topY + 14.5, { align: 'center' })
}

export function generateCertificatePdf({
  studentName = 'Student',
  formattedDate = 'November 22, 2026',
  certificateId = 'LM-2026-000001',
  variant = 'standard',
  type = 'assessment',
}) {
  const isVerified = variant === 'verified'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth() // 297
  const h = doc.internal.pageSize.getHeight() // 210
  const cx = w / 2

  const bgRgb = isVerified ? [255, 253, 247] : [255, 255, 255]
  const outerRgb = [224, 105, 24]
  const innerRgb = isVerified ? [212, 160, 23] : [234, 122, 42]
  const starRgb = isVerified ? [212, 160, 23] : [224, 105, 24]
  const accentTextRgb = [180, 83, 9]

  // Page background
  doc.setFillColor(...bgRgb)
  doc.rect(0, 0, w, h, 'F')

  // Double-line border frame
  doc.setDrawColor(...outerRgb)
  doc.setLineWidth(isVerified ? 0.85 : 0.75)
  doc.rect(10, 10, w - 20, h - 20)

  doc.setDrawColor(...innerRgb)
  doc.setLineWidth(0.4)
  doc.rect(13, 13, w - 26, h - 26)

  // Corner cutouts + 4-point stars
  const corners = [
    [11.5, 11.5],
    [w - 11.5, 11.5],
    [11.5, h - 11.5],
    [w - 11.5, h - 11.5],
  ]
  for (const [sx, sy] of corners) {
    doc.setFillColor(...bgRgb)
    doc.rect(sx - 6.5, sy - 6.5, 13, 13, 'F')
    drawFourPointStar(doc, sx, sy, 4.2, 1.3, starRgb)
  }

  // Top-center white cutout + LM monogram
  doc.setFillColor(...bgRgb)
  doc.rect(cx - 28, 5, 56, 20, 'F')
  drawMonogram(doc, cx, 10.5)

  // Bottom-center white cutout + Certificate Reference ID
  doc.setFillColor(...bgRgb)
  doc.rect(cx - 32, h - 16, 64, 10, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 130, 145)
  doc.text(`Certificate ID: ${certificateId}`, cx, h - 10, { align: 'center' })

  // Verified Assessment Seal (top-right inside frame)
  if (isVerified) {
    const sealX = w - 36
    const sealY = 38
    doc.setFillColor(6, 78, 59)
    doc.setDrawColor(217, 155, 22)
    doc.setLineWidth(1.1)
    doc.circle(sealX, sealY, 14, 'FD')
    doc.setDrawColor(253, 230, 138)
    doc.setLineWidth(0.35)
    doc.circle(sealX, sealY, 11.8, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(253, 224, 71)
    doc.text('OFFICIAL', sealX, sealY - 4.2, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setTextColor(255, 255, 255)
    doc.text('VERIFIED', sealX, sealY + 1, { align: 'center' })
    doc.setFontSize(6)
    doc.setTextColor(167, 243, 208)
    doc.text('MONITORED', sealX, sealY + 5.2, { align: 'center' })
  }

  // Title: CERTIFICATE
  doc.setFont('times', 'normal')
  doc.setFontSize(40)
  doc.setTextColor(15, 23, 42)
  doc.text('CERTIFICATE', cx, 55, { align: 'center', charSpace: 2.2 })

  // Subtitle: OF COMPLETION flanked by horizontal lines
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...accentTextRgb)
  doc.text('O F   C O M P L E T I O N', cx, 66, { align: 'center' })

  doc.setDrawColor(...outerRgb)
  doc.setLineWidth(0.45)
  doc.line(cx - 82, 64.5, cx - 42, 64.5)
  doc.line(cx + 42, 64.5, cx + 82, 64.5)

  // PRESENTED TO
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(51, 65, 85)
  doc.text('P R E S E N T E D   T O', cx, 84, { align: 'center' })
  doc.setDrawColor(...outerRgb)
  doc.setLineWidth(0.45)
  doc.line(cx - 8, 87.5, cx + 8, 87.5)

  // Recipient Name
  const cleanName = String(studentName || 'Student').trim()
  doc.setFont('times', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(15, 23, 42)
  doc.text(cleanName, cx, 108, { align: 'center' })

  // Horizontal line under name
  doc.setDrawColor(51, 65, 85)
  doc.setLineWidth(0.4)
  doc.line(cx - 88, 113, cx + 88, 113)

  // Body paragraph (exact wording)
  const body = getCertificateBody({ type, variant, formattedDate })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  const bodyLines = doc.splitTextToSize(body, 178)
  doc.text(bodyLines, cx, 125, { align: 'center', lineHeightFactor: 1.45 })

  // Footer signature & date columns
  const footerY = 174
  const leftCx = 78
  const rightCx = w - 78

  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  doc.text('LearnMatch Platform', leftCx, footerY - 3, { align: 'center' })

  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.4)
  doc.line(leftCx - 30, footerY, leftCx + 30, footerY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...accentTextRgb)
  doc.text('L E A R N M A T C H   T E A M', leftCx, footerY + 5.5, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(formattedDate, rightCx, footerY - 3, { align: 'center' })

  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.4)
  doc.line(rightCx - 30, footerY, rightCx + 30, footerY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...accentTextRgb)
  doc.text('D A T E', rightCx, footerY + 5.5, { align: 'center' })

  const safeName = cleanName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'Student'
  const tierLabel = isVerified ? 'Verified' : 'Standard'
  doc.save(`LearnMatch_${tierLabel}_Certificate_${safeName}.pdf`)
}
