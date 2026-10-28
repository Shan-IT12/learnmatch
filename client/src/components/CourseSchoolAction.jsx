import { useEffect, useId, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || ''

export default function CourseSchoolAction({ courseCode, onClick, className, children }) {
  const [availability, setAvailability] = useState(null)
  const [retry, setRetry] = useState(0)
  const noteId = useId()
  const status = availability?.courseCode === courseCode && availability?.retry === retry
    ? availability.status : 'loading'

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let active = true
    fetch(`${apiUrl}/api/public/courses/${encodeURIComponent(courseCode)}/schools`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('School availability unavailable')
        const data = await response.json()
        if (!Array.isArray(data.schools)) throw new Error('Invalid school availability')
        if (active) setAvailability({ courseCode, retry, status: data.schools.length ? 'available' : 'empty' })
      })
      .catch(() => {
        if (active) setAvailability({ courseCode, retry, status: 'error' })
      })
      .finally(() => clearTimeout(timeout))
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [courseCode, retry])

  return <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
    <button
      type="button"
      disabled={status !== 'available'}
      aria-describedby={status !== 'available' ? noteId : undefined}
      onClick={onClick}
      className={`${className} shrink-0 self-start whitespace-nowrap disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:hover:bg-gray-100`}
    >{children}</button>
    {status !== 'available' && <p id={noteId} role="status" className="max-w-lg text-xs leading-5 text-gray-500">
      {status === 'empty' ? 'No verified SJDM school offering is currently listed for this course. Schools outside SJDM may offer it; check directly with those institutions.'
        : status === 'loading' ? 'Checking school availability in SJDM…'
        : <>School availability could not be checked. <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-orange-500">Try again</button></>}
    </p>}
  </div>
}
