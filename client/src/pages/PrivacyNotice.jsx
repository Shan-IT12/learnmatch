import { Link, useLocation, useNavigate } from 'react-router-dom'
import HeaderBrand from '../components/HeaderBrand'
import PublicFooter from '../components/PublicFooter'

export default function PrivacyNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const background = location.state?.privacyBackground
  const returnToForm = () => {
    navigate(-1)
  }
  return <div className="min-h-screen bg-[#fcfaf7] text-gray-900">
    <nav aria-label="Privacy page navigation" className="border-b border-gray-200 bg-white px-5 py-5 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
        <Link to="/" aria-label="LearnMatch home" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"><HeaderBrand /></Link>
        {background ? <button type="button" onClick={returnToForm} autoFocus className="lm-action">{background.pathname === '/register' ? 'Back to registration' : 'Back to assessment'}</button> : <Link to="/" className="lm-action">Back to LearnMatch</Link>}
      </div>
    </nav>
    <main id="privacy-notice" className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">LearnMatch Privacy Notice</h1>
        <p className="mt-3 text-sm text-gray-600">Notice version 1.0 · Reviewed <time dateTime="2026-10-21">21 October 2026</time></p>
        <p className="mt-5 leading-7 text-gray-700">LearnMatch is a school capstone project for senior high school and college students. The LearnMatch Research Team uses information to provide course recommendations, assessment history, and optional college alignment tracking. Thesis analysis and defense use aggregate statistics only.</p>
      </header>
      <div className="space-y-7 rounded-3xl border border-gray-200 bg-white p-5 text-sm leading-7 text-gray-700 sm:p-8 sm:text-base">
        <section aria-labelledby="privacy-information">
          <h2 id="privacy-information" className="mb-3 text-lg font-bold text-gray-950">Information we collect and save</h2>
          <p>We save your username, email address, account verification and recovery information, and password hash. We also save assessment answers, scores, personality results, course recommendations, explanations, assessment history, and unfinished assessment drafts.</p>
          <p className="mt-3">Current Personal Factors collection uses structured choices about physical or accessibility difficulties, health-related needs, financial concerns, and family or work responsibilities. If you answer Yes, we ask about impact and, for physical or accessibility difficulties, the relevant areas and difficulty levels. Every Personal Factor is optional. You can leave a question unanswered or choose “Prefer not to answer.” Undisclosed and unclear historical factors are excluded from matching.</p>
          <p className="mt-3">The current form does not collect an Others free-text response or send that text for AI classification. Older records may still contain retired Others text and classifications, along with earlier profile details. Removing those fields from current collection has not erased historical records.</p>
          <p className="mt-3">If you use college alignment tracking, we save your selected program, academic term and tracking information, check-in answers, alignment results, and GWA if you provide it.</p>
          <p className="mt-3">Submitted feedback includes your rating, category, and any comment. Feedback is linked to your account and can be identified by project administrators. Avoid including unnecessary identifying or sensitive details in comments.</p>
        </section>
        <section aria-labelledby="privacy-drafts">
          <h2 id="privacy-drafts" className="mb-3 text-lg font-bold text-gray-950">Drafts and browser storage</h2>
          <p>Interests, Academic Skills, and Personality drafts are saved automatically in your browser and to your account as you answer, before you complete the assessment. Personal Factors are saved when you select Save Personal Factors or Save Changes.</p>
          <p className="mt-3">Browser storage also holds sign-in information, assessment progress, and feedback prompt information. Signing out or signing into an account clears LearnMatch’s student drafts and feedback caches on that browser. This does not delete records saved on the server.</p>
        </section>
        <section aria-labelledby="privacy-access">
          <h2 id="privacy-access" className="mb-3 text-lg font-bold text-gray-950">Administrator access and research</h2>
          <p>Authorized project administrators can view account details, assessment summaries, saved recommendations, college tracking summaries, and identifiable feedback to operate and evaluate LearnMatch. Although thesis analysis and defense use aggregate statistics, operational records remain linked to accounts.</p>
        </section>
        <section aria-labelledby="privacy-ai">
          <h2 id="privacy-ai" className="mb-3 text-lg font-bold text-gray-950">Recommendations and AI explanations</h2>
          <p>A predefined Weighted Scoring Model calculates course compatibility and rankings. When AI explanations are enabled, the OpenAI explanation service receives course names and categories, computed ranks and scores, and selected score summaries to explain existing recommendations.</p>
          <p className="mt-3">For college alignment explanations, OpenAI may receive the computed alignment status and score, check-in phase, dimension scores, and GWA if supplied. These explanation payloads do not include your username, email address, raw assessment answers, or detailed Personal Factor disclosures. They are derived from your results and should not be treated as anonymous. AI explains computed results; it does not determine course rankings or college alignment status.</p>
        </section>
        <section aria-labelledby="privacy-providers">
          <h2 id="privacy-providers" className="mb-3 text-lg font-bold text-gray-950">Service providers and optional location sharing</h2>
          <p>LearnMatch uses website hosting and database infrastructure to process requests and store information needed to operate the service. Account verification and recovery emails are sent through Resend, which receives the recipient’s email address and message content.</p>
          <p className="mt-3">If you request directions and allow location access, your current coordinates and the selected school’s coordinates are sent through LearnMatch to OpenRouteService, operated by HeiGIT. Maps load tiles from OpenStreetMap, which receives your IP address, browser request metadata, and the requested map area. Map requests can occur without granting location permission. You can browse schools without sharing your current location.</p>
        </section>
        <section aria-labelledby="privacy-records">
          <h2 id="privacy-records" className="mb-3 text-lg font-bold text-gray-950">Saved records</h2>
          <p>Retention periods have not yet been finalized. Saved histories and older profile information, including free text collected by earlier versions, have not been automatically erased. LearnMatch currently has no self-service Delete Account feature.</p>
        </section>
        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact" className="mb-3 text-lg font-bold text-gray-950">Contact the LearnMatch Research Team</h2>
          <p>For privacy questions and requests about your information, including access, correction, objection, or deletion, email <a href="mailto:learnmatch1@gmail.com" className="break-all rounded font-semibold text-orange-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">learnmatch1@gmail.com</a>.</p>
          <p className="mt-3">This email is a channel for questions and requests. Sending an email does not automatically delete or change saved information. Briefly describe your concern without sending passwords, verification codes, or unnecessary sensitive information.</p>
        </section>
      </div>
    </main>
    <PublicFooter />
  </div>
}
