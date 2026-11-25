import { deriveFactorApplicability } from '../utils/profilePersonalFactors'
import { accessibilityAreas, difficultyLevels, healthWellbeingAreas, impactOptions } from './PersonalFactorsForm'

const impactLabels = Object.fromEntries(impactOptions)
const areaLabels = Object.fromEntries(accessibilityAreas)
const healthAreaLabels = Object.fromEntries(healthWellbeingAreas)
const difficultyLabels = Object.fromEntries(difficultyLevels)
const factorRows = [
  ['physical', 'Physical / Accessibility'],
  ['health', 'Health & Well-being'],
  ['financial', 'Financial Constraints'],
  ['family', 'Family Responsibilities'],
  ['work', 'Work Responsibilities'],
]

export default function PersonalFactorsSummary({ profile }) {
  const applicability = deriveFactorApplicability(profile || {})
  const summarize = (factor) => {
    if (applicability[factor] === 'no') return 'No'
    if (applicability[factor] === 'prefer_not_to_say') return 'Prefer not to say'
    if (applicability[factor] !== 'yes') return 'Not provided'
    const raw = profile?.[`factor_${factor}_impact`]
    if (raw === '' || raw === null || raw === undefined) return 'Not provided'
    return impactLabels[Number(raw)] || 'Not provided'
  }
  return <dl className="divide-y divide-gray-100">{factorRows.map(([factor, label]) => <div key={factor} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-6">
    <dt className="text-sm font-medium text-gray-600">{label}</dt>
    <dd className="text-sm font-semibold text-gray-900">{summarize(factor)}</dd>
    {factor === 'physical' && applicability.physical === 'yes' && profile?.physical_accessibility_areas?.length > 0 && <dd className="mt-2 space-y-1 text-sm text-gray-500 sm:col-span-2">{profile.physical_accessibility_areas.map(area => <p key={area}>{areaLabels[area] || area}: {difficultyLabels[profile.physical_accessibility_difficulties?.[area]] || 'Not provided'}</p>)}</dd>}
    {factor === 'health' && applicability.health === 'yes' && profile?.health_wellbeing_areas?.length > 0 && <dd className="mt-2 space-y-1 text-sm text-gray-500 sm:col-span-2">{profile.health_wellbeing_areas.map(area => <p key={area}>{healthAreaLabels[area] || area}</p>)}</dd>}
  </div>)}</dl>
}
