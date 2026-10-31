import { Link } from 'react-router-dom'
import PublicInformationLayout from '../components/PublicInformationLayout'

const steps = [
  ['Interests Assessment', 'Choose activities you enjoy from the interest groups, or select No interests or hobbies. These choices help compare your interests with course profiles.'],
  ['Academic Skills Assessment', 'Answer questions across verbal, numerical, abstract/logical, spatial, scientific reasoning, and practical/applied skills. Your answers provide a snapshot of the skills measured by these questions.'],
  ['Personality Assessment', 'Rate statements about your preferences. LearnMatch summarizes them into personality dimensions and an MBTI-style result to support reflection. This is not a clinical diagnosis.'],
  ['Personal Factors', 'Answer Yes or No for accessibility, health, finances, and family or work responsibilities. All five answers are required. Yes requires an impact level and, for accessibility, areas and difficulty levels. Choose No when the circumstance does not apply to you.'],
  ['Weighted Scoring Model', 'Predefined weights combine academic skills, interests, personality, and all five Personal Factor answers into compatibility scores. Weights vary by course cluster. AI does not calculate these rankings.'],
  ['Course Recommendations', 'Explore your top three course matches, score breakdowns, course details, and saved assessment results. When enabled and available, AI-generated explanations describe the computed results in everyday language; they can contain mistakes.'],
]

export default function About() {
  return <PublicInformationLayout title="About LearnMatch" eyebrow="Understand your options" introduction="Course guidance that starts with getting to know yourself.">
    <section className="rounded-3xl border border-orange-100 bg-white/80 p-6 leading-7 text-gray-700 sm:p-8">
      <h2 className="mb-3 text-xl font-bold text-gray-950">Built for a decision that matters</h2>
      <p>LearnMatch is a school capstone project developed to help senior high school students explore college courses and help college students reflect on their current program. It brings interests, academic skills, personality, and personal circumstances into one guided experience.</p>
      <p className="mt-3">The project aims to make course exploration easier to understand and discuss with teachers, guidance counselors, and family. It provides educational guidance and does not guarantee admission, academic success, employment, or career outcomes.</p>
    </section>
    <section className="mt-9" aria-labelledby="about-matching">
      <h2 id="about-matching" className="mb-5 text-2xl font-bold tracking-tight">How course matching works</h2>
      <ol className="grid gap-4 sm:grid-cols-2">{steps.map(([title, description], index) => <li key={title} className="rounded-3xl border border-orange-100 bg-white/75 p-6">
        <span className="text-sm font-bold text-orange-700">0{index + 1}</span><h3 className="mb-2 mt-3 text-lg font-bold">{title}</h3><p className="text-sm leading-7 text-gray-600">{description}</p>
      </li>)}</ol>
    </section>
    <section className="mt-8 rounded-3xl border border-orange-200/70 bg-orange-50/70 p-6 leading-7 text-gray-700 sm:p-8">
      <h2 className="mb-3 text-xl font-bold text-gray-950">Reflection beyond the first recommendation</h2>
      <p>Optional college alignment tracking lets college students record a selected program and academic terms, complete check-ins, and review alignment results over time. A GWA can be provided where requested. These results support reflection; they are not an official academic evaluation.</p>
      <p className="mt-3">For practical steps, visit the <Link to="/help" target="_blank" rel="noopener noreferrer" className="public-text-link">Help Center</Link>. The <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="public-text-link">Privacy Notice</Link> explains what is saved, administrator access, research use, and data shared with service providers.</p>
    </section>
  </PublicInformationLayout>
}
