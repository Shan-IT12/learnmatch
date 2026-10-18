import { useState } from 'react'
import { IconArrowRight, IconBook2, IconSchool } from '@tabler/icons-react'

export default function CollegeProgramRoadmap({ years = [], currentYear, currentTerm, duration }) {
  const [selected, setSelected] = useState(null)
  const activeYear = years.find(item => Number(item.year) === selected) || years.find(item => Number(item.year) === currentYear) || years[0]
  return <section aria-labelledby="college-roadmap-title" className="college-panel">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-3"><div><p className="college-eyebrow">The bigger picture</p><h2 id="college-roadmap-title" className="college-heading">Your course roadmap</h2><p className="mt-2 text-sm leading-6 text-gray-500">See where you are and explore what comes next. Select a year to view its focus.</p></div>{duration && <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">{duration}-year program</span>}</div>
    {activeYear ? <>
      <div role="group" aria-label="Explore program years" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(var(--roadmap-years),minmax(0,1fr))]" style={{ '--roadmap-years': years.length }}>
        {years.map(item => {
          const year = Number(item.year)
          const isSelected = item === activeYear
          const isCurrent = year === currentYear
          return <button key={year} type="button" aria-pressed={isSelected} aria-controls="college-year-overview" onClick={() => setSelected(year)} className={`college-year-button flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${isSelected ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm shadow-orange-100' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/40'}`}><div className="flex w-full items-center justify-between gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{String(year).padStart(2, '0')}</span>{isCurrent && <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold text-orange-700">You are here</span>}</div><div className="mt-4"><p className="font-bold">{item.label || `Year ${year}`}</p><p className="mt-1 text-xs text-gray-500">{isCurrent ? currentTerm : year < currentYear ? 'Earlier year' : 'Upcoming year'}</p></div></button>
        })}
      </div>
      <div id="college-year-overview" className="mt-5 grid gap-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-5 sm:p-7 md:grid-cols-[10rem_minmax(0,1fr)]">
        <div><span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm"><IconSchool size={23} stroke={1.6} /></span><h3 className="text-lg font-bold text-gray-950">{activeYear.label || `Year ${activeYear.year}`}</h3><p className="mt-1 text-xs text-gray-500">{Number(activeYear.year) === currentYear ? 'Your current program year' : 'Program overview'}</p></div>
        <div className="md:border-l md:border-gray-200 md:pl-7"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-orange-700"><IconBook2 size={16} />What to explore</p><p key={activeYear.year} className="motion-enter text-base leading-8 text-gray-600">{activeYear.overview || 'An overview for this year is not yet available.'}</p></div>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-400"><IconArrowRight size={15} className="mt-0.5 shrink-0" />This is a general course guide. Subjects and progression may vary by institution.</p>
    </> : <p className="rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">The roadmap for this course is currently unavailable.</p>}
  </section>
}
