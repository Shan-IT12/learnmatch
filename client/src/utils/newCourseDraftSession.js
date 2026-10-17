const VERSION = 1

// Use the authenticated account ID only as a storage namespace, never store its
// token. Authentication and all source/review validation remain server-side.
export function newCourseDraftSessionKey(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { adminId } = JSON.parse(atob(payload))
    return Number.isInteger(adminId) && adminId > 0 ? `learnmatch:add-course:${adminId}:v${VERSION}` : null
  } catch { return null }
}

export function readNewCourseDraftSession(storage, key, defaults) {
  try {
    if (!key) return null
    const saved = JSON.parse(storage.getItem(key))
    if (saved?.version !== VERSION || !saved.form || !Array.isArray(saved.sources) || saved.sources.length > 3) return null
    const form = Object.fromEntries(Object.entries(defaults).map(([field, fallback]) => [field, Object.hasOwn(saved.form, field) ? saved.form[field] : fallback]))
    if (Object.entries(defaults).some(([field, fallback]) => Array.isArray(fallback) ? !Array.isArray(form[field]) : typeof form[field] !== typeof fallback && !(field === 'program_duration_years' && typeof form[field] === 'number'))) return null
    if (saved.sources.some(source => !source || typeof source.client_id !== 'string' || ['title', 'url', 'notes'].some(field => typeof source[field] !== 'string') || !Array.isArray(source.supported_fields))) return null
    for (const field of ['year_levels', 'skill_profile', 'riasec_profile', 'career_opportunities']) {
      if (form[field].some(row => !row || typeof row !== 'object' || Array.isArray(row))) return null
    }
    return { form, sources: saved.sources, active: saved.active === true }
  } catch { return null }
}

export function writeNewCourseDraftSession(storage, key, form, sources, active) {
  try {
    if (!key) return false
    storage.setItem(key, JSON.stringify({ version: VERSION, active, form, sources }))
    return true
  } catch { return false }
}

export function clearNewCourseDraftSession(storage, key) {
  try { if (key) storage.removeItem(key) } catch { /* Storage may be unavailable. */ }
}
