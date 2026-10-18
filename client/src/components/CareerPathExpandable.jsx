import { useId, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'

const toggleClass = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-orange-600 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500'

export function CourseDescription({ text = '' }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const description = String(text || '').trim()
  const isLong = description.length > 320
  const cutoff = description.lastIndexOf(' ', 320)
  const preview = description.slice(0, cutoff > 0 ? cutoff : 320).trimEnd()
  return <div className="mt-4 max-w-3xl">
    <p id={id} className="text-sm leading-7 text-gray-500">{isLong && !expanded ? `${preview}...` : description}</p>
    {isLong && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} className={`${toggleClass} mt-1`}>{expanded ? 'See less' : 'See more'}<IconChevronDown size={14} className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} /></button>}
  </div>
}

export function CourseSkills({ skills = [] }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const visibleSkills = expanded ? skills : skills.slice(0, 6)
  const remaining = Math.max(0, skills.length - 6)
  return <div className="min-w-0 flex-1 lg:border-l lg:border-gray-100 lg:pl-8">
    <div id={id} className="flex flex-wrap gap-2">
      {visibleSkills.map(skill => <span key={skill} className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs font-medium text-orange-800 transition-colors hover:border-orange-200 hover:bg-orange-100">{skill}</span>)}
      {!skills.length && <p className="text-sm text-gray-500">Skill information is not yet available.</p>}
    </div>
    {remaining > 0 && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} className={`${toggleClass} mt-2`}>{expanded ? 'See less' : `See more (+${remaining})`}<IconChevronDown size={14} className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} /></button>}
  </div>
}
