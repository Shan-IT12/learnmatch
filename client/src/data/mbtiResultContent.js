export const RIASEC_NAMES = Object.freeze({ R: 'Realistic', I: 'Investigative', A: 'Artistic', S: 'Social', E: 'Enterprising', C: 'Conventional' })

// Mirrors server/config/recommendationConfig.js; the result tests enforce parity.
export const MBTI_TO_RIASEC = Object.freeze({
  ISTJ: ['R', 'C'], ISFJ: ['S', 'C'], INFJ: ['S', 'A'], INTJ: ['I', 'C'],
  ISTP: ['R', 'I'], ISFP: ['S', 'A'], INFP: ['A', 'S'], INTP: ['I', 'A'],
  ESTP: ['E', 'R'], ESFP: ['E', 'S'], ENFP: ['A', 'S'], ENTP: ['A', 'I'],
  ESTJ: ['C', 'E'], ESFJ: ['E', 'S'], ENFJ: ['S', 'A'], ENTJ: ['E', 'C'],
})

const content = (summary, strengths, challenges) => ({ summary, strengths, challenges })
export const MBTI_TYPE_CONTENT = Object.freeze({
  ISTJ: content('A practical, measured approach that values dependable information, clear responsibilities, and orderly progress.', ['Dependable follow-through', 'Attention to detail', 'Practical organization'], ['May take time to adjust to sudden changes', 'May overlook untested possibilities']),
  ISFJ: content('A considerate, practical style that values stability, responsibility, and attention to other people’s needs.', ['Supportive cooperation', 'Careful preparation', 'Reliability'], ['May take on too much for others', 'May hesitate to voice personal needs']),
  INFJ: content('A reflective, values-aware style that looks for meaning, patterns, and constructive ways to support people.', ['Insightful planning', 'Empathy', 'Purposeful focus'], ['May hold very high expectations', 'May need recovery time after sustained interaction']),
  INTJ: content('An independent, analytical style that values patterns, long-range planning, and well-designed systems.', ['Strategic thinking', 'Independent problem-solving', 'Long-term focus'], ['May appear reserved when evaluating ideas', 'May become impatient with inefficient processes']),
  ISTP: content('A calm, adaptable style that values practical understanding, direct experience, and independent problem-solving.', ['Practical analysis', 'Adaptability', 'Composure'], ['May postpone long-range planning', 'May explain decisions too briefly']),
  ISFP: content('A gentle, adaptable style that values personal meaning, practical experience, and individual needs.', ['Consideration for others', 'Flexibility', 'Practical awareness'], ['May avoid necessary conflict', 'May find rigid structure limiting']),
  INFP: content('An imaginative, values-guided style that looks for possibilities, personal meaning, and authentic contribution.', ['Empathy', 'Creative thinking', 'Commitment to values'], ['May struggle with rigid routines', 'May take criticism personally']),
  INTP: content('A curious, independent style that values logical consistency, conceptual understanding, and exploration.', ['Analytical curiosity', 'Original problem-solving', 'Conceptual thinking'], ['May delay decisions while exploring options', 'May overlook practical follow-through']),
  ESTP: content('An energetic, practical style that values direct action, real-time problem-solving, and engagement.', ['Resourcefulness', 'Decisive action', 'Social confidence'], ['May act before considering long-term effects', 'May lose interest in routine']),
  ESFP: content('An outgoing, adaptable style that values people, practical experiences, and positive shared activity.', ['Warm cooperation', 'Practical flexibility', 'Enthusiasm'], ['May find distant deadlines difficult', 'May avoid abstract or isolated work']),
  ENFP: content('An enthusiastic, values-aware style that looks for possibilities, connections, and meaningful collaboration.', ['Creative communication', 'Adaptability', 'Encouraging others'], ['May become scattered across possibilities', 'May find repetitive follow-through draining']),
  ENTP: content('An inventive, analytical style that enjoys possibilities, debate, and unconventional solutions.', ['Innovative thinking', 'Quick analysis', 'Adaptability'], ['May move on before details are complete', 'May challenge ideas too directly']),
  ESTJ: content('A direct, organized style that values practical evidence, clear decisions, and dependable execution.', ['Organization', 'Decisiveness', 'Practical leadership'], ['May become impatient with ambiguity', 'May need to allow different working styles']),
  ESFJ: content('A cooperative, practical style that values clear structure, dependable action, and consideration for others.', ['Supportive teamwork', 'Practical organization', 'Responsibility'], ['May be sensitive to criticism', 'May prioritize harmony too strongly']),
  ENFJ: content('A people-focused, organized style that values shared purpose, growth, and coordinated action.', ['Empathy', 'Motivating communication', 'Purposeful organization'], ['May take on too much for others', 'May find impersonal conflict difficult']),
  ENTJ: content('A strategic, decisive style that values ambitious goals, logical systems, and effective organization.', ['Strategic leadership', 'Decisiveness', 'Systems thinking'], ['May appear overly direct', 'May move faster than others are ready']),
})

const NAMES = { E: 'Extraverted', I: 'Introverted', S: 'Sensing', N: 'Intuitive', T: 'Thinking', F: 'Feeling', J: 'Judging', P: 'Perceiving' }
export const DIMENSIONS = Object.freeze([
  { key: 'EI', scoreKey: 'EI', left: 'E', right: 'I', names: ['Extraversion', 'Introversion'], meaning: ['interaction, discussion, and external activity', 'reflection, independent processing, and quieter interaction'] },
  { key: 'SN', scoreKey: 'NS', left: 'S', right: 'N', names: ['Sensing', 'Intuition'], meaning: ['concrete details, practical information, and experience', 'patterns, possibilities, connections, and abstract ideas'] },
  { key: 'TF', scoreKey: 'TF', left: 'T', right: 'F', names: ['Thinking', 'Feeling'], meaning: ['logic, consistency, and objective analysis', 'values, people, and interpersonal impact'] },
  { key: 'JP', scoreKey: 'JP', left: 'J', right: 'P', names: ['Judging', 'Perceiving'], meaning: ['planning, structure, and organization', 'flexibility, exploration, and adaptation'] },
])
export const getExpandedType = (value) => [...value].map((letter) => NAMES[letter]).join(' • ')
export function getDimensionResults(mbtiType, scores) {
  return DIMENSIONS.map((d) => {
    const serverValue = Number(scores[d.scoreKey]); const leftRaw = d.key === 'SN' ? 100 - serverValue : serverValue
    const preferred = mbtiType.includes(d.left) ? d.left : d.right; const difference = Math.abs(leftRaw - (100 - leftRaw)); const isTie = difference < 1e-9
    return { ...d, leftRaw, leftPercent: Math.round(leftRaw), rightPercent: 100 - Math.round(leftRaw), preferred, preferredName: d.names[preferred === d.left ? 0 : 1], preferredMeaning: d.meaning[preferred === d.left ? 0 : 1], isTie, strength: isTie ? 'Balanced' : difference <= 4 ? 'Slight' : difference <= 14 ? 'Moderate' : 'Clear' }
  })
}
