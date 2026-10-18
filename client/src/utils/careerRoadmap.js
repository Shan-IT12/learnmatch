export function getYearTabIndex(key, currentIndex, yearCount) {
  if (yearCount < 1) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') return (currentIndex + 1) % yearCount
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (currentIndex - 1 + yearCount) % yearCount
  if (key === 'Home') return 0
  if (key === 'End') return yearCount - 1
  return null
}
