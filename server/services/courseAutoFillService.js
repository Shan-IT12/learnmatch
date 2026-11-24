import { PARENT_CLUSTERS } from '../config/recommendationConfig.js'
import { parseSourceContent } from './sourceParserService.js'
import { checkCourseDuplicates, extractCourseAcronym } from './courseDuplicateService.js'

const MAX_SOURCE_TEXT_LENGTH = 40000
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const CLUSTER_KEYWORDS = [
  ['ENGINEERING / STEM CLUSTER', ['engineering', 'computer science', 'information technology', 'software', 'electronics', 'civil', 'mechanical', 'electrical', 'architecture', 'data science', 'cybersecurity', 'robotics', 'programming', 'algorithm']],
  ['HEALTHCARE SCIENCE CLUSTER', ['nursing', 'medicine', 'pharmacy', 'medical technology', 'physical therapy', 'midwifery', 'dentistry', 'public health', 'nutrition', 'dietetics', 'radiologic', 'clinical', 'patient']],
  ['BUSINESS CLUSTER', ['accountancy', 'accounting', 'business administration', 'marketing', 'finance', 'management', 'entrepreneurship', 'economics', 'human resource', 'office administration', 'commerce']],
  ['HOSPITALITY & TOURISM CLUSTER', ['hospitality', 'tourism', 'hotel', 'restaurant', 'culinary', 'travel', 'event management']],
  ['EDUCATION CLUSTER', ['education', 'teaching', 'pedagogy', 'curriculum', 'elementary education', 'secondary education', 'early childhood', 'special needs education']],
  ['ARTS & MULTIMEDIA CLUSTER', ['multimedia', 'fine arts', 'graphic design', 'animation', 'film', 'music', 'communication', 'journalism', 'broadcasting', 'interior design', 'fashion']],
  ['CRIMINOLOGY CLUSTER', ['criminology', 'forensic', 'law enforcement', 'criminal justice', 'policing']],
  ['LEGAL & PUBLIC SERVICE CLUSTER', ['legal management', 'public administration', 'political science', 'social work', 'diplomacy', 'foreign service', 'governance']],
  ['AGRICULTURE & ENVIRONMENTAL CLUSTER', ['agriculture', 'forestry', 'fisheries', 'environmental science', 'agribusiness', 'veterinary', 'agronomy', 'ecology']],
  ['SCIENCE & MATHEMATICS CLUSTER', ['biology', 'chemistry', 'physics', 'mathematics', 'statistics', 'applied math', 'biochemistry', 'geology', 'marine science']],
  ['AVIATION & MARITIME CLUSTER', ['aviation', 'aeronautical', 'marine transportation', 'marine engineering', 'aircraft', 'maritime', 'pilot']],
  ['SPORTS & PHYSICAL EDUCATION CLUSTER', ['exercise', 'sports science', 'physical education', 'kinesiology', 'athletic', 'coaching']],
  ['HUMANITIES & SOCIAL SCIENCE CLUSTER', ['psychology', 'sociology', 'philosophy', 'history', 'literature', 'linguistics', 'anthropology', 'international studies', 'english']],
]

function cleanLine(value, max = 500) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, max)
}

function inferCluster(text) {
  const lower = text.toLowerCase()
  let bestCluster = 'ENGINEERING / STEM CLUSTER'
  let bestScore = 0
  for (const [cluster, keywords] of CLUSTER_KEYWORDS) {
    let score = 0
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score += keyword.includes(' ') ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      bestCluster = cluster
    }
  }
  return bestScore > 0 ? bestCluster : ''
}

function extractDurationYears(text) {
  const match = text.match(/\b([1-5])\s*[-]?\s*year\b/iu) || text.match(/\bduration\s*[:\-]\s*([1-5])\b/iu)
  if (match) return Number(match[1])
  if (/\bfifth\s+year\b|\b5th\s+year\b/iu.test(text)) return 5
  return 4
}

function buildYearLevels(duration, text) {
  const ordinal = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
  return Array.from({ length: duration }, (_, idx) => {
    const yearNum = idx + 1
    const label = ordinal[idx] || `Year ${yearNum}`
    const regex = new RegExp(`(?:${label}|Year\\s*${yearNum})\\s*[:\\-–]\\s*([^\\n]{10,400})`, 'iu')
    const found = text.match(regex)
    return {
      year: yearNum,
      label,
      overview: found ? cleanLine(found[1], 400) : '',
    }
  })
}

function extractSectionList(text, headingPattern) {
  const match = text.match(new RegExp(`(?:${headingPattern})\\s*[:\\-]?\\s*\\n?([\\s\\S]{10,1500}?)(?:\\n\\s*\\n|\\n[A-Z][A-Za-z\\s/]{2,40}:|$)`, 'iu'))
  if (!match) return []
  return match[1]
    .split(/\n|;|•|·/u)
    .map((line) => line.replace(/^\s*[-*•\d.)]+\s*/u, '').trim())
    .filter((line) => line.length >= 2 && line.length <= 160)
}

function extractCareersFromText(text) {
  const rawItems = extractSectionList(
    text,
    'career\\s+opportunities|career\\s+paths|possible\\s+careers|job\\s+opportunities|professions|allied\\s+professions'
  )
  const seen = new Set()
  const careers = []
  for (const raw of rawItems) {
    if (careers.length >= 6) break
    const salaryMatch = raw.match(/((?:PHP|₱|Php)\s?[\d,]+(?:\s*[-–to]+\s*(?:PHP|₱|Php)?\s?[\d,]+)?(?:\s*\/?\s*(?:mo|month|monthly))?)/iu)
    const salaryRange = salaryMatch ? cleanLine(salaryMatch[1], 100) : ''
    const titlePart = raw
      .replace(salaryMatch ? salaryMatch[0] : '', '')
      .split(/\s+[-–:]\s+/u)[0]
      .replace(/[()[\],]+$/u, '')
      .trim()
    const descPart = raw.includes(' - ') || raw.includes(': ')
      ? cleanLine(raw.split(/\s+[-–:]\s+/u).slice(1).join(' - '), 300)
      : ''
    if (!titlePart || titlePart.length < 2) continue
    const key = titlePart.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    careers.push({
      job_title: cleanLine(titlePart, 150),
      salary_range: salaryRange,
      description: descPart,
    })
  }
  return careers
}

export function parseCourseFromTextFallback(rawText) {
  const text = String(rawText ?? '').replace(/\r\n/g, '\n').trim()
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  // 1. Course Name
  let courseName = ''
  const labeledName = text.match(/(?:program\s+name|course\s+name|degree\s+program|program\s+title|course\s+title)\s*[:\-]\s*([^\n]{4,180})/iu)
  if (labeledName) {
    courseName = cleanLine(labeledName[1], 180)
  } else {
    const bachelorLine = lines.find((line) => /\b(?:Bachelor\s+of|BS\s+|BA\s+|AB\s+)/iu.test(line) && line.length <= 180)
    courseName = cleanLine(bachelorLine || lines[0] || '', 180)
  }

  // 2. Abbreviation
  let courseAbbreviation = ''
  const labeledAbbr = text.match(/(?:abbreviation|acronym|course\s+code|program\s+code)\s*[:\-]\s*([A-Za-z0-9-]{2,20})/iu)
  if (labeledAbbr) {
    courseAbbreviation = labeledAbbr[1].trim().toUpperCase()
  } else {
    const paren = courseName.match(/\(([A-Za-z0-9-]{2,14})\)/u)
    courseAbbreviation = paren ? paren[1].toUpperCase() : extractCourseAcronym(courseName)
  }
  // Clean parenthetical abbr out of courseName only if it's duplicated
  courseName = courseName.replace(/\s*\([A-Za-z0-9-]{2,14}\)\s*$/u, '').trim()

  // 3. Description
  let description = ''
  const labeledDesc = text.match(/(?:program\s+description|course\s+description|program\s+overview|overview|description)\s*[:\-]\s*\n?([\s\S]{20,1200}?)(?:\n\s*\n|\n[A-Z][A-Za-z\s/]{2,35}:|$)/iu)
  if (labeledDesc) {
    description = cleanLine(labeledDesc[1], 1200)
  } else {
    const paragraph = lines.find((line) => line.length >= 60 && line !== courseName)
    description = cleanLine(paragraph || lines.slice(1, 4).join(' '), 1200)
  }

  // 4. Skills / Competencies
  const skillItems = extractSectionList(
    text,
    'obtainable\\s+skills|core\\s+competencies|skills|program\\s+outcomes|competencies|key\\s+skills'
  )
  const obtainableSkills = skillItems
    .flatMap((item) => item.split(/,/u))
    .map((item) => cleanLine(item, 80))
    .filter((item) => item.length >= 2)
    .slice(0, 12)
    .join(', ')

  // 5. Duration, Year Levels, Cluster, Careers
  const programDurationYears = extractDurationYears(text)
  const yearLevels = buildYearLevels(programDurationYears, text)
  const clusterCategory = inferCluster(`${courseName} ${description} ${obtainableSkills}`)
  const careerOpportunities = extractCareersFromText(text)

  return {
    course_name: courseName,
    course_abbreviation: courseAbbreviation.slice(0, 50),
    cluster_category: PARENT_CLUSTERS.includes(clusterCategory) ? clusterCategory : '',
    description,
    obtainable_skills: obtainableSkills,
    program_duration_years: programDurationYears,
    year_levels: yearLevels,
    career_opportunities: careerOpportunities,
  }
}

async function extractWithOpenAi(rawText, apiKey, model = 'gpt-4o-mini') {
  const prompt = `Extract structured Philippine college degree course information from the following reference text.
Return STRICT JSON with these exact keys:
{
  "course_name": "Full official program name without trailing acronym in parentheses",
  "course_abbreviation": "Short acronym e.g. BSIT (max 20 chars)",
  "cluster_category": "Exact match from this list or empty string: ${PARENT_CLUSTERS.join(' | ')}",
  "description": "Clear 2-4 sentence program overview",
  "obtainable_skills": "Comma-separated list of 5-10 concrete skills/competencies",
  "program_duration_years": 4,
  "year_levels": [{"year": 1, "label": "1st Year", "overview": "..."}],
  "career_opportunities": [{"job_title": "...", "salary_range": "Only if mentioned in text, else empty string", "description": "..."}]
}
Do not invent salary numbers if not present in the source text. Reference text:
${rawText.slice(0, 14000)}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You extract structured curriculum metadata as strict JSON.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`)
  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty AI extraction response')
  return JSON.parse(content)
}

function sanitizeExtracted(raw, fallback) {
  const duration = Number.isInteger(raw?.program_duration_years) && raw.program_duration_years >= 1 && raw.program_duration_years <= 5
    ? raw.program_duration_years
    : fallback.program_duration_years
  const ordinal = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
  const rawYears = Array.isArray(raw?.year_levels) ? raw.year_levels : []
  const yearLevels = Array.from({ length: duration }, (_, idx) => {
    const match = rawYears[idx]
    return {
      year: idx + 1,
      label: cleanLine(match?.label || ordinal[idx] || `Year ${idx + 1}`, 30),
      overview: cleanLine(match?.overview || fallback.year_levels[idx]?.overview || '', 500),
    }
  })

  const rawCareers = Array.isArray(raw?.career_opportunities) ? raw.career_opportunities : fallback.career_opportunities
  const careers = rawCareers
    .filter((item) => item && typeof item.job_title === 'string' && item.job_title.trim())
    .slice(0, 8)
    .map((item) => ({
      job_title: cleanLine(item.job_title, 150),
      salary_range: cleanLine(item.salary_range || '', 100),
      description: cleanLine(item.description || '', 500),
    }))

  return {
    course_name: cleanLine(raw?.course_name || fallback.course_name, 180),
    course_abbreviation: cleanLine(raw?.course_abbreviation || fallback.course_abbreviation, 50).toUpperCase(),
    cluster_category: PARENT_CLUSTERS.includes(raw?.cluster_category) ? raw.cluster_category : fallback.cluster_category,
    description: cleanLine(raw?.description || fallback.description, 1500),
    obtainable_skills: cleanLine(raw?.obtainable_skills || fallback.obtainable_skills, 800),
    program_duration_years: duration,
    year_levels: yearLevels,
    career_opportunities: careers,
  }
}

export async function extractCourseFromSource(database, { sourceText = '', file = null } = {}, { env = process.env } = {}) {
  let combinedText = typeof sourceText === 'string' ? sourceText.trim() : ''

  if (file && file.base64) {
    const mimeType = String(file.mimeType || '').trim().toLowerCase()
    const bytes = Buffer.from(String(file.base64), 'base64')
    if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) {
      const error = new Error('Uploaded file must be 20 MB or smaller.')
      error.status = 400
      throw error
    }
    if (mimeType === 'application/pdf') {
      const parsed = await parseSourceContent(bytes, 'application/pdf', { allowPartialPdf: true })
      const pdfText = (parsed?.blocks || []).map((block) => block.text).join('\n').trim()
      combinedText = [combinedText, pdfText].filter(Boolean).join('\n\n')
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
      combinedText = [combinedText, bytes.toString('utf8').trim()].filter(Boolean).join('\n\n')
    } else {
      const error = new Error('Only PDF or plain text (.txt) source files are supported for auto-fill.')
      error.status = 400
      throw error
    }
  }

  if (combinedText.length < 20) {
    const error = new Error('Paste at least 20 characters of course reference text or upload a text/PDF document.')
    error.status = 400
    throw error
  }

  const boundedText = combinedText.slice(0, MAX_SOURCE_TEXT_LENGTH)
  const fallback = parseCourseFromTextFallback(boundedText)
  let extracted = fallback
  let extractionMethod = 'structured_parser'

  if (env.OPENAI_API_KEY) {
    try {
      const aiResult = await extractWithOpenAi(boundedText, env.OPENAI_API_KEY, env.COURSE_AUTOFILL_MODEL || 'gpt-4o-mini')
      extracted = sanitizeExtracted(aiResult, fallback)
      extractionMethod = 'ai_assisted'
    } catch {
      extracted = fallback
      extractionMethod = 'structured_parser'
    }
  }

  const duplicateCheck = database
    ? await checkCourseDuplicates(database, {
        courseName: extracted.course_name,
        courseAbbreviation: extracted.course_abbreviation,
      })
    : { hasExactDuplicate: false, hasSimilarMatch: false, exactMatches: [], similarMatches: [] }

  return {
    extracted,
    extractionMethod,
    duplicateCheck,
  }
}
