const seenInMemory = new Set()

export function collegeCompletionNoticeKey(userId, collegeInfo) {
  if (!userId || !collegeInfo?.courseId) return null
  const completion = collegeInfo.trackingCycleId
    ? ['cycle', collegeInfo.trackingCycleId]
    : ['term', collegeInfo.termId || null, collegeInfo.courseId, collegeInfo.academicYear || null, collegeInfo.yearLevel, collegeInfo.semester]
  return `learnmatch:college-completion:${JSON.stringify([String(userId), ...completion])}`
}

export function hasSeenCollegeCompletion(storage, key) {
  if (!key) return true
  try { return storage.getItem(key) === 'seen' || seenInMemory.has(key) }
  catch { return seenInMemory.has(key) }
}

export function markCollegeCompletionSeen(storage, key) {
  if (!key) return
  seenInMemory.add(key)
  try { storage.setItem(key, 'seen') } catch { /* Keep this visit quiet if browser storage is unavailable. */ }
}
