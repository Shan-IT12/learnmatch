const PUBLIC_INSTITUTION_TYPES = new Set(['LUC', 'SUC'])

export function getSchoolOwnershipLabel(heiType) {
  const normalizedType = String(heiType || '').trim().toUpperCase()
  if (normalizedType === 'PRIVATE') return 'Private'
  if (PUBLIC_INSTITUTION_TYPES.has(normalizedType)) return 'Public'
  return null
}
