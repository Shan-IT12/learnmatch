import { useId, useState } from 'react'

// Visibility is local UI state. Keep the report subtree mounted and never update
// source/review state or invoke checking when the admin hides or shows results.
export default function SourceCheckResults({ children, initialExpanded = true, flat = false }) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const contentId = useId()
  return <div className={flat ? 'mt-3 border-t border-gray-100 pt-3 text-sm' : 'mt-3 rounded-lg bg-gray-50 p-3 text-sm'}>
    <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(current => !current)} className={flat ? 'rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500' : 'text-orange-700 underline'}>
      {expanded ? 'Hide results' : 'Show results'}
    </button>
    <div id={contentId} hidden={!expanded} className="mt-2">{children}</div>
  </div>
}
