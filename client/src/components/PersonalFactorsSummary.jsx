import { deriveFactorApplicability } from '../utils/profilePersonalFactors'
import { accessibilityAreas, difficultyLevels, impactOptions } from './PersonalFactorsForm'

const impactLabels = Object.fromEntries(impactOptions)
const areaLabels = Object.fromEntries(accessibilityAreas)
const difficultyLabels = Object.fromEntries(difficultyLevels)
const factorRows = [
  ['physical', 'Physical / Accessibility'],
  ['health', 'Health'],
  ['financial', 'Financial'],
  ['family', 'Family Responsibilities'],
  ['work', 'Work Responsibilities'],
]

export default function PersonalFactorsSummary({ profile }) {
  const applicability = deriveFactorApplicability(profile || {})
  const summarize = (factor) => {
    if (applicability[factor] === 'no') return 'No'
    if (applicability[factor] !== 'yes') return 'Not provided'
    return impactLabels[Number(profile?.[`factor_${factor}_impact`])] || 'Not provided'
  }
  return <dl className="divide-y divide-gray-100">{factorRows.map(([factor, label]) => <div key={factor} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-6">
    <dt className="text-sm font-medium text-gray-600">{label}</dt>
    <dd className="text-sm font-semibold text-gray-900">{summarize(factor)}</dd>
    {factor === 'physical' && applicability.physical === 'yes' && profile?.physical_accessibility_areas?.length > 0 && <dd className="mt-2 space-y-1 text-sm text-gray-500 sm:col-span-2">{profile.physical_accessibility_areas.map(area => <p key={area}>{areaLabels[area] || area}: {difficultyLabels[profile.physical_accessibility_difficulties?.[area]] || 'Not provided'}</p>)}</dd>}
  </div>)}</dl>
}
