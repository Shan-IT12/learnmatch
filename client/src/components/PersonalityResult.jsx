import { useId, useRef, useState } from 'react'
import { IconArrowRight, IconClick, IconSparkles } from '@tabler/icons-react'
import { MBTI_TYPE_CONTENT, getDimensionResults, getExpandedType } from '../data/mbtiResultContent'

const LETTER_PAIRS = Object.freeze([
  { pair: 'E vs I', choices: [
    { letter: 'E', name: 'Extraversion', description: 'You usually gain energy from people, interaction, and group settings.' },
    { letter: 'I', name: 'Introversion', description: 'You usually gain energy from quiet time, reflection, and smaller or more personal settings.' },
  ] },
  { pair: 'S vs N', choices: [
    { letter: 'S', name: 'Sensing', description: 'You tend to focus on facts, details, and practical information.' },
    { letter: 'N', name: 'Intuition', description: 'You tend to focus on ideas, patterns, and possibilities.' },
  ] },
  { pair: 'T vs F', choices: [
    { letter: 'T', name: 'Thinking', description: 'You often make decisions using logic, analysis, and consistency.' },
    { letter: 'F', name: 'Feeling', description: 'You often make decisions by considering people, values, and impact on others.' },
  ] },
  { pair: 'J vs P', choices: [
    { letter: 'J', name: 'Judging', description: 'You usually prefer structure, planning, and organized decisions.' },
    { letter: 'P', name: 'Perceiving', description: 'You usually prefer flexibility, openness, and adapting as things change.' },
  ] },
])

function DimensionCard({ value }) {
  const other = value.preferred === value.left ? value.right : value.left
  return <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex justify-between gap-4"><div><b>{value.names[0]} ({value.left})</b><p className="text-2xl font-black">{value.leftPercent}%</p></div><div className="text-right"><b>{value.names[1]} ({value.right})</b><p className="text-2xl font-black">{value.rightPercent}%</p></div></div>
    <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-gray-100" aria-label={`${value.names[0]} ${value.leftPercent} percent, ${value.names[1]} ${value.rightPercent} percent`}><span className="bg-orange-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${value.leftPercent}%` }} /><span className="bg-slate-300 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${value.rightPercent}%` }} /></div>
    <div className="mt-5 flex flex-wrap items-center gap-2"><b>{value.isTie ? `Result letter: ${value.preferredName} (${value.preferred})` : `You lean toward ${value.preferredName} (${value.preferred}).`}</b><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">{value.strength} preference</span></div>
    <p className="mt-2 text-sm leading-6 text-gray-600">This dimension compares {value.meaning[0]} with {value.meaning[1]}.</p>
    <div className="mt-4 border-t border-gray-100 pt-4"><b className="text-sm">Why {value.preferred} instead of {other}?</b><p className="mt-1 text-sm leading-6 text-gray-600">{value.isTie ? `Your responses showed a balanced preference between both sides. Your result for this pair is ${value.preferredName} (${value.preferred}).` : `Your responses leaned more toward ${value.preferredName}, suggesting a preference for ${value.preferredMeaning}.`}</p></div>
  </article>
}

function LetterMeaningCard({ pair, choices, mbtiType }) {
  return <article className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4"><h3 className="text-sm font-black text-gray-900">{pair}</h3><div className="mt-3 space-y-2">{choices.map(({ letter, name, description }) => { const selected = mbtiType.includes(letter); return <div key={letter} className={`rounded-xl border p-3 ${selected ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white'}`}><div className="flex items-center justify-between gap-3"><p className="font-bold text-gray-900"><span className={selected ? 'text-orange-600' : ''}>{letter}</span> — {name}</p>{selected && <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Your result</span>}</div><p className="mt-1 text-sm leading-6 text-gray-600">{description}</p></div> })}</div></article>
}

export default function PersonalityResult({ result, onContinue }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const tabRefs = useRef([])
  const explorerId = useId()
  const info = MBTI_TYPE_CONTENT[result.mbtiType]
  const dimensions = getDimensionResults(result.mbtiType, result.scores)
  const activeDimension = dimensions[activeIndex]
  const handleTabKey = (event, index) => {
    const targetIndex = event.key === 'ArrowRight' ? (index + 1) % dimensions.length
      : event.key === 'ArrowLeft' ? (index + dimensions.length - 1) % dimensions.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? dimensions.length - 1 : null
    if (targetIndex === null) return
    event.preventDefault()
    setActiveIndex(targetIndex)
    tabRefs.current[targetIndex]?.focus()
  }
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
    <section className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-[#fffdf9] to-white p-6 shadow-sm sm:p-9">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-orange-100/50 blur-2xl" />
      <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600"><IconSparkles size={16} aria-hidden="true" />Your Personality Type</p>
      <h1 className="sr-only">{result.mbtiType}</h1>
      <p className="relative mt-4 flex items-center gap-2 text-sm text-gray-500"><IconClick size={16} aria-hidden="true" />Select a letter to explore your result</p>
      <div role="tablist" aria-label="Explore your personality letters" className="relative mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        {dimensions.map((value, index) => <button
          key={value.key}
          ref={element => { tabRefs.current[index] = element }}
          type="button"
          role="tab"
          aria-label={`${value.preferred} ${value.preferredName}`}
          id={`${explorerId}-tab-${index}`}
          aria-controls={`${explorerId}-panel`}
          aria-selected={activeIndex === index}
          tabIndex={activeIndex === index ? 0 : -1}
          onClick={() => setActiveIndex(index)}
          onKeyDown={event => handleTabKey(event, index)}
          className={`min-w-0 rounded-2xl border px-2 py-4 text-center transition duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 sm:py-5 ${activeIndex === index ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200/60' : 'border-orange-100 bg-white/90 text-gray-900 hover:-translate-y-1 hover:border-orange-300 hover:bg-orange-50 motion-reduce:transform-none'}`}
        >
          <span className="block text-4xl font-black sm:text-5xl">{value.preferred}</span>
          <span className={`mt-2 block text-[10px] font-semibold sm:text-xs ${activeIndex === index ? 'text-orange-50' : 'text-gray-500'}`}>{['Energy', 'Focus', 'Decisions', 'Lifestyle'][index]}</span>
        </button>)}
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-700 sm:text-base">{getExpandedType(result.mbtiType)}</p>
      <p className="mt-5 max-w-3xl leading-7 text-gray-700">Your answers suggest {info.summary.toLowerCase()}</p>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-500">This result reflects your responses in the personality assessment and is intended for educational and career guidance. It is not a clinical diagnosis.</p>
    </section>
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold tracking-tight sm:text-2xl">Why This Is Your Result</h2><span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{activeIndex + 1} of 4</span></div>
      <p className="mt-2 text-sm leading-6 text-gray-500">Each letter reflects which side of a personality pair your answers leaned toward. Select a letter above to compare each pair.</p>
      <div role="tabpanel" id={`${explorerId}-panel`} aria-labelledby={`${explorerId}-tab-${activeIndex}`} tabIndex={0} className="mt-5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        <DimensionCard value={activeDimension} />
      </div>
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => { const next = (activeIndex + 1) % dimensions.length; setActiveIndex(next); tabRefs.current[next]?.focus() }} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Explore {dimensions[(activeIndex + 1) % dimensions.length].preferredName}<IconArrowRight size={16} aria-hidden="true" /></button></div>
    </section>
    <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7"><h2 className="text-xl font-black">What the letters mean</h2><p className="mt-2 text-sm leading-6 text-gray-600">Your result shows which side was stronger in each pair.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{LETTER_PAIRS.map(({ pair, choices }) => <LetterMeaningCard key={pair} pair={pair} choices={choices} mbtiType={result.mbtiType} />)}</div></section>
    <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Your Personality Summary</h2><p className="mt-3 text-sm leading-7 text-gray-600">Taken together, your four result letters suggest these common tendencies:</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{dimensions.map((value) => <li key={value.key} className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">You may tend to emphasize {value.preferredMeaning}.</li>)}</ul></section>
    <section className="mt-6 grid gap-5 md:grid-cols-2"><ListCard title="Common Strengths" items={info.strengths} color="bg-orange-500" /><ListCard title="Possible Challenges" items={info.challenges} color="bg-gray-400" /></section>
    <section className="mt-10 rounded-2xl border border-orange-100 bg-orange-50/40 p-6"><h2 className="text-xl font-black">How this relates to LearnMatch</h2><p className="mt-3 text-sm leading-7 text-gray-700">Your personality result helps LearnMatch understand the kinds of environments and approaches you may prefer. It is considered together with your Interests, Academic Skills, and Personal Factors, so it does not determine your recommended course by itself.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{['Interests', 'Academic Skills', 'Personality', 'Personal Factors'].map((x) => <span key={x} className="rounded-xl border border-orange-100 bg-white px-3 py-2 text-center text-xs font-bold">{x}</span>)}</div></section>
    <button type="button" onClick={onContinue} className="mt-8 w-full rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Continue to Recommendations</button>
  </div>
}

function ListCard({ title, items, color }) { return <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">{title}</h2><ul className="mt-4 space-y-3">{items.map((item) => <li key={item} className="flex gap-3 text-sm text-gray-700"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />{item}</li>)}</ul></article> }
