import { getDisplayCourseAbbreviation, parseCourseName } from '../utils/courseName'

function CourseName({
  name,
  abbreviation = '',
  as: Component = 'span',
  className = '',
  mainClassName = '',
  secondaryClassName = 'mt-1 text-sm font-medium text-gray-500',
}) {
  const { baseName, specialization } = parseCourseName(name)
  const displayAbbreviation = getDisplayCourseAbbreviation(name, abbreviation)
  const abbreviationSuffix = displayAbbreviation ? ` (${displayAbbreviation})` : ''

  if (!specialization) {
    return <Component className={className}>{baseName}{abbreviationSuffix}</Component>
  }

  return (
    <Component className={className} title={name}>
      <span className={`block ${mainClassName}`}>{baseName}{abbreviationSuffix}</span>
      <span className={`block ${secondaryClassName}`}>{specialization}</span>
    </Component>
  )
}

export default CourseName
