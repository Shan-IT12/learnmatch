import { courseMatchingRubric } from '../../data/courseMatchingRubric'
import DraftCourseExample from './DraftCourseExample'
import DraftDisclosure, { DraftGuidance } from './DraftDisclosure'
import { FieldError, RequiredMark, PublicationRequiredMark } from '../FormValidation'
import { resizeCourseYears } from '../../utils/courseDraftForm'

const riasecNames = { R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional' }
const domainHelp = { Verbal: 'reading and communication', Numerical: 'working with numbers', 'Abstract/Logical': 'patterns and logical reasoning', Spatial: 'shapes and spatial relationships', 'Scientific Reasoning': 'evaluating scientific information', 'Practical/Applied': 'hands-on application' }
const weightLabels = Object.fromEntries(courseMatchingRubric.levels.map(level => [level.value, level.label]))
const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'

export default function CourseDraftFields({ form, setForm, options, errors, showGuidance = false, showRequirements = false, part = 'all', collapsible = showGuidance }) {
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const updateProfile = (key, index, field, value) => setForm((current) => ({ ...current,
    [key]: current[key].map((entry, i) => i === index ? { ...entry, [field]: value } : entry),
  }))
  return <>
    {part !== 'profiles' && <div data-validation-field={showGuidance ? 'program_duration_years' : undefined} className={showGuidance ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'space-y-4'}>
    <label className="block text-sm text-gray-700">
      Abbreviation {showRequirements && <PublicationRequiredMark />}
      <input className={inputClass} placeholder={showGuidance ? "Ex. BSIT" : undefined} aria-describedby={showGuidance ? "draft-abbreviation-help" : undefined} value={form.course_abbreviation} maxLength={50} onChange={(e) => set('course_abbreviation', e.target.value)} />
      {showGuidance && <span id="draft-abbreviation-help" className="sr-only">Use the recognized short name from a reference. Required before publication; do not invent one.</span>}
    </label>
    <div data-validation-field="program_duration_years">
      <label className="block text-sm text-gray-700">Program duration {showRequirements && <RequiredMark />}
        <select required={showRequirements} aria-required={showRequirements || undefined} className={inputClass} aria-describedby={showGuidance ? "draft-duration-help" : undefined} value={form.program_duration_years} aria-invalid={Boolean(errors.program_duration_years)} onChange={(e) => setForm((current) => resizeCourseYears(current, e.target.value))}>
          <option value="">Select duration</option>
          {Array.from({ length: options?.max_duration_years || 5 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i ? 'years' : 'year'}</option>)}
        </select>
      </label>
      <FieldError>{errors.program_duration_years}</FieldError>
      <p id={showGuidance ? "draft-duration-help" : undefined} className={showGuidance ? "sr-only" : "mt-1 text-xs text-gray-500"}>{showGuidance ? "Choose the source-stated duration in whole years (1-5). For example, select 4 only if the curriculum specifies four years." : "Only the existing one-to-five-year structure is supported in this phase."}</p>
    </div>
    {form.year_levels.map((year, index) => <div key={year.year} className={showGuidance ? 'min-w-0 border-t border-gray-100 py-3 md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-[minmax(8rem,0.5fr)_minmax(0,1.5fr)]' : 'rounded-lg border border-gray-100 p-3'}>
      <label className="block text-sm">Year {year.year} label {showRequirements && <RequiredMark />}<input className={inputClass} maxLength={30} required placeholder={showGuidance ? "Ex. 1st Year" : undefined} aria-describedby={showGuidance ? `year-${year.year}-label-help` : undefined} value={year.label} onChange={(e) => set('year_levels', form.year_levels.map((entry, i) => i === index ? { ...entry, label: e.target.value } : entry))} />{showGuidance && <span id={`year-${year.year}-label-help`} className="sr-only">Name this year level; keep the levels in order.</span>}</label>
      <label className="mt-2 block text-sm">Year {year.year} overview {showRequirements && <PublicationRequiredMark />}<textarea className={inputClass} maxLength={5000} placeholder={showGuidance ? "Ex. Foundation subjects and introductory laboratory work, if listed in the curriculum." : undefined} aria-describedby={showGuidance ? `year-${year.year}-overview-help` : undefined} value={year.overview} onChange={(e) => set('year_levels', form.year_levels.map((entry, i) => i === index ? { ...entry, overview: e.target.value } : entry))} />{showGuidance && <span id={`year-${year.year}-overview-help`} className="sr-only">Summarize the source-supported subjects or activities for this year. Required before publication.</span>}</label>
    </div>)}
    </div>}
    {part !== 'details' && <section data-validation-field="matching_profiles" className="space-y-4">
      {!showGuidance && <><h2 className="font-semibold text-gray-900">Course matching profiles</h2><p className="mt-1 text-xs text-gray-600">Enter approved weights explicitly. Obtainable skills above do not create matching weights. Personality and personal-factor scoring continue to inherit from the selected cluster.</p></>}
      <FieldError>{errors.matching_profiles}</FieldError>
      {[['skill_profile', 'skill_domain', 1], ['riasec_profile', 'riasec_type', 0]].map(([key, nameKey, minimum]) => <DraftDisclosure key={key} enabled={collapsible} title={minimum ? 'Skill Profile' : 'RIASEC Profile'} hasError={Boolean(errors.matching_profiles)} actions={showGuidance && minimum ? <DraftCourseExample kind="matching" /> : undefined}>
        {showGuidance && <div className="mb-4 space-y-2">
          <p className="text-sm text-gray-600">{minimum ? 'Select supported skill domains, then enter each weight and its evidence together.' : 'Complete all six dimensions with a relevance weight and supporting evidence.'} Weights describe course relevance, not student grades.</p>
          <DraftGuidance>
            <p>Use reviewed evidence from the description, obtainable skills or career paths; do not guess weights. A cluster alone does not justify High. Obtainable skills do not create matching weights; personality and personal-factor scoring inherit from the selected cluster.</p>
            <p id={`${key}-scale-help`}>High = 3: core or dominant. Medium = 2: frequently relevant, but not the main focus. Low = 1: secondary or minor. {minimum ? 'Not relevant = 0 in the rubric: no meaningful supporting evidence. Leave unsupported domains unselected; selected skills require 1-3.' : 'Not relevant = 0: no meaningful supporting evidence. Complete all six RIASEC entries.'}</p>
            <p>Documented in <a className="text-orange-700 underline" href={courseMatchingRubric.source.url} target="_blank" rel="noopener noreferrer">Master Prompt, {minimum ? 'pages 2-3 (skill rubric)' : 'page 3 (RIASEC rubric)'}</a>.</p>
            <p>Evidence is required before publication. Cite the reference section or page and explain how the supported outcome relates to the assigned weight.</p>
            {minimum && <ul className="list-disc pl-5">{Object.entries(domainHelp).map(([domain, help]) => <li key={domain}><strong>{domain}:</strong> {help}</li>)}</ul>}
          </DraftGuidance>
        </div>}
        {minimum === 1 && <fieldset aria-describedby={showGuidance ? "draft-skill-domains-help" : undefined} className="mb-4"><legend className="text-sm font-medium">Skill domains (select at least one) {showRequirements && <RequiredMark />}</legend>
          {showGuidance && <p id="draft-skill-domains-help" className="mt-1 text-xs text-gray-500">Leave unsupported domains unselected; selected skill weights must be 1-3.</p>}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{(options?.skill_domains || []).map((domain) => <label key={domain} className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" aria-invalid={Boolean(errors.matching_profiles && !form.skill_profile.length)} checked={form.skill_profile.some((row) => row.skill_domain === domain)} onChange={(e) => set('skill_profile', e.target.checked ? [...form.skill_profile, { skill_domain: domain, weight: '', evidence: '' }] : form.skill_profile.filter((row) => row.skill_domain !== domain))} />{domain}
          </label>)}</div>
        </fieldset>}
        <fieldset className="space-y-1"><legend className={showGuidance ? 'sr-only' : 'text-sm font-medium'}>{minimum ? 'Skill weights' : 'RIASEC weights'}</legend>
        {form[key].map((row, index) => <div key={row[nameKey]} className={showGuidance ? 'grid min-w-0 grid-cols-1 gap-4 border-t border-gray-100 py-4 md:grid-cols-[minmax(10rem,0.65fr)_minmax(0,1.35fr)]' : 'rounded-lg border border-gray-100 p-3'}>
          <label className="block text-sm">{showGuidance && !minimum ? `${row[nameKey]} - ${riasecNames[row[nameKey]]}` : row[nameKey]} weight {showRequirements && <RequiredMark />}
            <select required={showRequirements} aria-required={showRequirements || undefined} aria-invalid={Boolean(errors.matching_profiles && (row.weight === '' || !Number.isInteger(Number(row.weight)) || Number(row.weight) < minimum || Number(row.weight) > 3))} className={inputClass} aria-describedby={showGuidance ? `${key}-scale-help` : undefined} value={row.weight} onChange={(e) => updateProfile(key, index, 'weight', e.target.value)}>
              <option value="">Select weight</option>
              {Array.from({ length: 4 - minimum }, (_, i) => <option key={i + minimum} value={i + minimum}>{showGuidance ? `${i + minimum} - ${weightLabels[i + minimum]}` : i + minimum}</option>)}
            </select>
          </label>
          <label className="block text-sm">{showGuidance && !minimum ? `${row[nameKey]} - ${riasecNames[row[nameKey]]}` : row[nameKey]} evidence {showRequirements && <PublicationRequiredMark />}<textarea className={inputClass} maxLength={5000} placeholder={showGuidance ? "Ex. Curriculum, section/page; explain how the stated outcome supports this weight." : undefined} aria-describedby={showGuidance ? `${key}-scale-help` : undefined} value={row.evidence ?? ''} onChange={(e) => updateProfile(key, index, 'evidence', e.target.value)} /></label>
        </div>)}
      </fieldset></DraftDisclosure>)}
    </section>}
  </>
}
