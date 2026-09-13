// 40-item MBTI-style personality assessment.
// Each item leans toward one pole of its dichotomy (E/I, S/N, T/F, J/P).
// See "LearnMatch_MBTI_Question_Bank.pdf" for sources and full methodology.

export const mbtiQuestions = [
  // Extraversion (E) vs. Introversion (I)
  { id: 1, dimension: 'EI', pole: 'E', responseFamily: 'agreement', text: "I feel energized after spending time in a group setting." },
  { id: 2, dimension: 'EI', pole: 'I', responseFamily: 'agreement', text: "I need quiet time alone to recharge after a busy day." },
  { id: 3, dimension: 'EI', pole: 'E', responseFamily: 'agreement', text: "I enjoy being the center of attention in social situations." },
  { id: 4, dimension: 'EI', pole: 'I', responseFamily: 'preference', text: "I prefer one-on-one conversations over group discussions." },
  { id: 5, dimension: 'EI', pole: 'E', responseFamily: 'frequency', text: "I think out loud and process ideas by talking them through." },
  { id: 6, dimension: 'EI', pole: 'I', responseFamily: 'frequency', text: "I process my thoughts internally before sharing them." },
  { id: 7, dimension: 'EI', pole: 'E', responseFamily: 'agreement', text: "Meeting new people excites me more than it drains me." },
  { id: 8, dimension: 'EI', pole: 'I', responseFamily: 'agreement', text: "I find large social gatherings tiring after a while." },
  { id: 9, dimension: 'EI', pole: 'E', responseFamily: 'frequency', text: "I tend to speak up quickly in group settings." },
  { id: 10, dimension: 'EI', pole: 'I', responseFamily: 'comfort', text: "I'm comfortable spending a weekend with little to no social contact." },

  // Sensing (S) vs. Intuition (N)
  { id: 11, dimension: 'SN', pole: 'S', responseFamily: 'agreement', text: "I focus on facts and concrete details rather than abstract ideas." },
  { id: 12, dimension: 'SN', pole: 'N', responseFamily: 'agreement', text: "I enjoy thinking about future possibilities more than present realities." },
  { id: 13, dimension: 'SN', pole: 'S', responseFamily: 'agreement', text: "I trust information I can see, hear, or verify directly." },
  { id: 14, dimension: 'SN', pole: 'N', responseFamily: 'frequency', text: "I often notice patterns and connections others might miss." },
  { id: 15, dimension: 'SN', pole: 'S', responseFamily: 'preference', text: "I prefer step-by-step instructions over open-ended tasks." },
  { id: 16, dimension: 'SN', pole: 'N', responseFamily: 'agreement', text: "I like exploring new ideas even if they're not practical yet." },
  { id: 17, dimension: 'SN', pole: 'S', responseFamily: 'frequency', text: "I pay close attention to details in my everyday tasks." },
  { id: 18, dimension: 'SN', pole: 'N', responseFamily: 'agreement', text: "I get bored easily with repetitive, routine work." },
  { id: 19, dimension: 'SN', pole: 'S', responseFamily: 'frequency', text: "I rely on past experience to guide my decisions." },
  { id: 20, dimension: 'SN', pole: 'N', responseFamily: 'frequency', text: "I enjoy imagining how things could be different or better." },

  // Thinking (T) vs. Feeling (F)
  { id: 21, dimension: 'TF', pole: 'T', responseFamily: 'agreement', text: "I make decisions based on logic rather than emotions." },
  { id: 22, dimension: 'TF', pole: 'F', responseFamily: 'frequency', text: "I consider how a decision will affect others' feelings before deciding." },
  { id: 23, dimension: 'TF', pole: 'T', responseFamily: 'agreement', text: "I value fairness based on consistent rules over personal circumstances." },
  { id: 24, dimension: 'TF', pole: 'F', responseFamily: 'agreement', text: "I find it easy to empathize with people going through difficulties." },
  { id: 25, dimension: 'TF', pole: 'T', responseFamily: 'frequency', text: "I stay calm and objective during conflicts." },
  { id: 26, dimension: 'TF', pole: 'F', responseFamily: 'agreement', text: "I prioritize harmony in a group over being right." },
  { id: 27, dimension: 'TF', pole: 'T', responseFamily: 'frequency', text: "I give honest feedback even if it might upset someone." },
  { id: 28, dimension: 'TF', pole: 'F', responseFamily: 'frequency', text: "I tend to consider people's emotions as much as the facts." },
  { id: 29, dimension: 'TF', pole: 'T', responseFamily: 'agreement', text: "I analyze situations more than I feel my way through them." },
  { id: 30, dimension: 'TF', pole: 'F', responseFamily: 'agreement', text: "I'm sensitive to the emotional tone of a room or conversation." },

  // Judging (J) vs. Perceiving (P)
  { id: 31, dimension: 'JP', pole: 'J', responseFamily: 'agreement', text: "I like having a clear plan before starting a task." },
  { id: 32, dimension: 'JP', pole: 'P', responseFamily: 'preference', text: "I prefer to keep my options open rather than commit early." },
  { id: 33, dimension: 'JP', pole: 'J', responseFamily: 'agreement', text: "I feel satisfied when I complete tasks ahead of schedule." },
  { id: 34, dimension: 'JP', pole: 'P', responseFamily: 'agreement', text: "I work best under the pressure of a last-minute deadline." },
  { id: 35, dimension: 'JP', pole: 'J', responseFamily: 'agreement', text: "I like organizing my day with a to-do list or schedule." },
  { id: 36, dimension: 'JP', pole: 'P', responseFamily: 'agreement', text: "I enjoy being spontaneous and adapting as things come up." },
  { id: 37, dimension: 'JP', pole: 'J', responseFamily: 'preference', text: "I prefer clear rules and structure over flexibility." },
  { id: 38, dimension: 'JP', pole: 'P', responseFamily: 'frequency', text: "I often start multiple things before finishing one." },
  { id: 39, dimension: 'JP', pole: 'J', responseFamily: 'agreement', text: "I feel uneasy when things are left unfinished or undecided." },
  { id: 40, dimension: 'JP', pole: 'P', responseFamily: 'comfort', text: "I'm comfortable improvising instead of following a strict plan." },
]

export const responseFamilies = Object.freeze({
  agreement: Object.freeze(['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']),
  frequency: Object.freeze(['Almost never', 'Rarely', 'Sometimes', 'Often', 'Almost always']),
  comfort: Object.freeze(['Very uncomfortable', 'Somewhat uncomfortable', 'Neutral', 'Comfortable', 'Very comfortable']),
})

export const preferenceResponses = Object.freeze({
  4: Object.freeze(['Strongly prefer group discussions', 'Slightly prefer group discussions', 'No clear preference', 'Slightly prefer one-on-one conversations', 'Strongly prefer one-on-one conversations']),
  15: Object.freeze(['Strongly prefer open-ended tasks', 'Slightly prefer open-ended tasks', 'No clear preference', 'Slightly prefer step-by-step instructions', 'Strongly prefer step-by-step instructions']),
  32: Object.freeze(['Strongly prefer committing early', 'Slightly prefer committing early', 'No clear preference', 'Slightly prefer keeping options open', 'Strongly prefer keeping options open']),
  37: Object.freeze(['Strongly prefer flexibility', 'Slightly prefer flexibility', 'No clear preference', 'Slightly prefer clear rules and structure', 'Strongly prefer clear rules and structure']),
})

export function getResponseChoices(question) {
  const labels = question.responseFamily === 'preference'
    ? preferenceResponses[question.id]
    : responseFamilies[question.responseFamily]

  return labels.map((label, index) => ({ value: index + 1, label }))
}
