const prefix = 'learnmatch:student-position:'
const permittedPage = /^\/(?:dashboard(?:\/summary)?|profile(?:\/edit)?|settings|onboarding\/(?:profile|interests|skills|personality)|college(?:\/setup|\/checkin(?:\/results\/\d+)?)?|results(?:\/career-path(?:\/[^/?#]+)?)?|assessment-history(?:\/\d+)?|courses\/(?:search|[^/?#]+)|schools\/[^/?#]+)$/
const queryKeys = new Set(['returnTo', 'source', 'saved', 'resultsReturnTo', 'via', 'action', 'q', 'cluster', 'page'])

export function resumableStudentPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(char => char.charCodeAt(0) < 32)) return null
  try {
    const url = new URL(value, 'https://learnmatch.local')
    if (url.origin !== 'https://learnmatch.local' || !permittedPage.test(url.pathname)) return null
    const params = new URLSearchParams()
    for (const [key, item] of url.searchParams) if (queryKeys.has(key) && item.length <= 200) params.set(key, item)
    // Returning to results must read saved recommendations, never generate again.
    if (url.pathname === '/results') params.set('saved', '1')
    const search = params.toString()
    return url.pathname + (search ? `?${search}` : '')
  } catch { return null }
}

function read(storage, userId) {
  if (!userId) return {}
  try {
    const value = JSON.parse(storage.getItem(prefix + userId) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

function update(storage, userId, change) {
  if (!userId) return
  try { storage.setItem(prefix + userId, JSON.stringify(change(read(storage, userId)))) } catch { /* Navigation still works with restricted storage. */ }
}

export function lastStudentPath(storage, userId) {
  return resumableStudentPath(read(storage, userId).lastPath)
}

const offset = value => Number.isFinite(value) && value >= 0 ? value : 0
export function readStudentPosition(storage, userId, path) {
  const position = read(storage, userId).pages?.[path]
  if (!position || typeof position !== 'object') return null
  return { x: offset(position.x), y: offset(position.y), assessmentY: offset(position.assessmentY) }
}

export function saveStudentPosition(storage, userId, path, position) {
  const safePath = resumableStudentPath(path)
  if (!safePath) return
  update(storage, userId, record => ({ ...record, lastPath: safePath, pages: Object.fromEntries([
    ...Object.entries(record.pages || {}).filter(([key]) => key !== safePath).slice(-19),
    [safePath, { x: offset(position.x), y: offset(position.y), assessmentY: offset(position.assessmentY) }],
  ]) }))
}

export function readStudentView(storage, userId, name, fallback) {
  return read(storage, userId).views?.[name] ?? fallback
}

export function saveStudentView(storage, userId, name, value) {
  update(storage, userId, record => ({ ...record, views: { ...record.views, [name]: value } }))
}

export function readStudentQuestionPosition(storage, userId, step, attemptId) {
  const position = read(storage, userId).questions?.[step]
  return Number(position?.attemptId) === Number(attemptId) && Number.isInteger(position?.currentIndex) && position.currentIndex >= 0 ? position.currentIndex : null
}

export function saveStudentQuestionPosition(storage, userId, step, attemptId, currentIndex) {
  if (!attemptId || !Number.isInteger(currentIndex) || currentIndex < 0) return
  update(storage, userId, record => ({ ...record, questions: { ...record.questions, [step]: { attemptId, currentIndex } } }))
}
