import { getSkillFigurePresentation } from '../../../shared/skillFigureChoices'

export default function SkillAnswerChoices({ question, selectedChoice, onSelect }) {
  const presentation = getSkillFigurePresentation(question)
  return (
    <div className={presentation ? 'grid grid-cols-2 gap-3' : 'space-y-2.5'}>
      {['A', 'B', 'C', 'D'].map((key, index) => {
        const figure = presentation?.figures[index]
        const selected = selectedChoice === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(question.question_id, key)}
            aria-pressed={selected}
            aria-label={figure ? `Option ${key}: ${figure.description}` : undefined}
            className={`group flex w-full gap-3 rounded-2xl border p-3 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:p-3.5 ${figure ? 'min-h-40 flex-col items-center' : 'items-center'} ${
              selected
                ? 'border-orange-500 bg-orange-50 text-gray-900 shadow-sm ring-1 ring-orange-500'
                : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/40'
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${figure ? 'self-start' : ''} ${
              selected ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-700'
            }`} aria-hidden={figure ? true : undefined}>{key}</span>
            {figure
              ? <img src={figure.src} alt={figure.description} className="h-28 w-28 max-w-full rounded-lg bg-white object-contain sm:h-32 sm:w-32" />
              : <span className="min-w-0 flex-1 leading-relaxed">{question[`choice_${key.toLowerCase()}`]}</span>}
          </button>
        )
      })}
    </div>
  )
}
