import { useId, useRef, useState } from 'react'
import { IconArrowLeft, IconArrowRight, IconBriefcase, IconChevronDown, IconRoute, IconSchool } from '@tabler/icons-react'
import './careerPath.css'
import { getYearTabIndex } from '../utils/careerRoadmap'

const SALARY_DISCLAIMER = 'Salary figures are estimates for the Philippines and may vary by employer, experience, location, and industry.'

function CourseEnrichmentSections({ course, compact = false }) {
  const yearLevels = course?.year_levels || []
  const careers = course?.career_opportunities || []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const activeIndex = Math.min(selectedIndex, Math.max(0, yearLevels.length - 1))
  const activeYear = yearLevels[activeIndex]
  const tabRefs = useRef([])
  const id = useId()

  const selectYear = (index, focus = false) => {
    setSelectedIndex(index)
    if (focus) tabRefs.current[index]?.focus()
  }
  const handleYearKey = (event, index) => {
    const nextIndex = getYearTabIndex(event.key, index, yearLevels.length)
    if (nextIndex === null) return
    event.preventDefault()
    selectYear(nextIndex, true)
  }

  return (
    <div className={compact ? 'space-y-7' : 'space-y-10 sm:space-y-12'}>
      <section id="program-roadmap" className="scroll-mt-6" aria-labelledby={`${id}-roadmap-title`}>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">The academic journey</p><h2 id={`${id}-roadmap-title`} className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Your path through the program</h2></div>
          <p className="text-xs leading-5 text-gray-500">Select a year to explore its focus.</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_14px_45px_-34px_rgba(15,23,42,.3)]">
          {activeYear ? <>
            <div className="border-b border-gray-100 p-4 sm:p-6">
              <div role="tablist" aria-label="Program year" className="career-year-grid" style={{ '--year-count': yearLevels.length }}>
                {yearLevels.map((item, index) => {
                  const selected = index === activeIndex
                  return <button key={`${item.year}-${index}`} ref={element => { tabRefs.current[index] = element }} id={`${id}-year-${index}`} role="tab" type="button" aria-selected={selected} aria-controls={`${id}-year-panel`} tabIndex={selected ? 0 : -1} onClick={() => selectYear(index)} onKeyDown={event => handleYearKey(event, index)} className={`career-year-tab group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-4 text-center outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:min-h-28 ${selected ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm shadow-orange-100' : 'border-transparent bg-gray-50/80 text-gray-500 hover:border-orange-200 hover:bg-orange-50/60 hover:text-orange-700'}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition-colors sm:h-11 sm:w-11 sm:text-lg ${selected ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'border border-gray-200 bg-white text-gray-500 group-hover:border-orange-200 group-hover:text-orange-600'}`}>{String(item.year).padStart(2, '0')}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide sm:text-xs">{item.label || `Year ${item.year}`}</span>
                    <span aria-hidden="true" className={`absolute bottom-0 h-0.5 w-8 rounded-full transition-colors ${selected ? 'bg-orange-500' : 'bg-transparent'}`} />
                  </button>
                })}
              </div>
            </div>
            <div id={`${id}-year-panel`} role="tabpanel" aria-labelledby={`${id}-year-${activeIndex}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
              <div key={activeIndex} className="career-year-content grid gap-6 p-6 sm:p-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-9 lg:p-10">
                <div className="flex items-center gap-4 md:block">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-100 sm:h-20 sm:w-20 md:mb-4"><IconSchool size={32} stroke={1.4} className="text-orange-600" /></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Program stage</p><p className="mt-1 text-xl font-bold text-gray-950">{activeYear.label || `Year ${activeYear.year}`}</p><p className="mt-1 text-xs text-gray-500">Year {activeYear.year}{course?.program_duration_years ? ` of ${course.program_duration_years}` : ''}</p></div>
                </div>
                <div className="flex min-w-0 flex-col justify-center md:border-l md:border-gray-100 md:pl-9">
                  <div className="mb-3 flex items-center gap-2 text-orange-600"><IconRoute size={17} stroke={1.8} /><h3 className="text-xs font-bold uppercase tracking-[0.12em]">What you can explore</h3></div>
                  <p className="max-w-3xl text-base leading-8 text-gray-700 sm:text-lg sm:leading-8">{activeYear.overview || 'An overview for this year is not yet available.'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-8">
              <button type="button" onClick={() => selectYear(activeIndex - 1)} disabled={activeIndex === 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"><IconArrowLeft size={15} /> Previous year</button>
              <span className="hidden text-xs font-medium text-gray-400 sm:block">{activeIndex + 1} / {yearLevels.length} years</span>
              <button type="button" onClick={() => selectYear(activeIndex + 1)} disabled={activeIndex === yearLevels.length - 1} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm shadow-orange-200 hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4">Next year <IconArrowRight size={15} /></button>
            </div>
          </> : <p className="p-6 text-sm text-gray-500">A year-by-year roadmap is not yet available for this program.</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-400">A general program guide. Subjects and progression may vary by school.</p>
      </section>

      <section id="career-opportunities" className="scroll-mt-6" aria-labelledby={`${id}-careers-title`}>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Beyond the classroom</p><h2 id={`${id}-careers-title`} className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Where could this take you?</h2></div>
          <p className="text-xs text-gray-500">Open a career to learn more.</p>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {careers.map((career, index) => <details key={career.career_id || `${career.career_title}-${index}`} className="career-opportunity group overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition duration-200 hover:border-orange-200 hover:shadow-[0_12px_30px_-20px_rgba(234,88,12,.4)] open:border-orange-200">
            <summary className="cursor-pointer list-none p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 sm:p-6">
              <div className="mb-5 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-orange-600 transition-colors group-hover:bg-orange-100"><IconBriefcase size={20} stroke={1.6} /></span><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Career {String(index + 1).padStart(2, '0')}</span></div>
              <h3 className="text-lg font-bold leading-6 text-gray-950">{career.career_title}</h3>
              {career.estimated_monthly_salary_php?.display && <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Estimated monthly salary</p><p className="text-sm font-semibold leading-6 text-orange-700">{career.estimated_monthly_salary_php.display}</p></div>}
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-orange-600"><span className="group-open:hidden">Explore this role</span><span className="hidden group-open:inline">Close details</span><IconChevronDown size={17} className="transition-transform duration-200 group-open:rotate-180" /></div>
            </summary>
            <div className="career-year-content border-t border-orange-100 bg-orange-50/30 px-5 py-5 sm:px-6"><p className="text-sm leading-7 text-gray-600">{career.philippines_description || 'A role description is not yet available.'}</p></div>
          </details>)}
        </div>
        {careers.length === 0 && <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Career information is not yet available for this program.</p>}
        <p className="mt-4 max-w-3xl text-xs leading-5 text-gray-400">{SALARY_DISCLAIMER}</p>
      </section>
    </div>
  )
}

export default CourseEnrichmentSections
