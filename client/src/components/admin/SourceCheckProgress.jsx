import { useEffect, useState } from 'react'

export default function SourceCheckProgress({ sourceCount }) {
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  return <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 p-4">
    <p role="status" aria-live="polite" className="text-sm font-medium text-gray-900">Checking {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}{sourceCount > 1 ? ' in order' : ''}…</p>
    <progress aria-label="Source checking in progress" className="mt-3 h-2 w-full accent-orange-500" />
    <p className="mt-2 text-sm text-gray-700" aria-live="off">Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s</p>
    <p className="mt-1 text-xs text-gray-600">Waiting for results. Completion percentage is unavailable. Each scanned PDF may need up to 60 seconds for AI analysis, plus download and input checks.</p>
    {elapsed >= 60 && <p role="status" className="mt-2 text-xs text-gray-700">Still waiting for the server. Multiple sources can take longer. You can cancel without losing your draft inputs.</p>}
  </div>
}
