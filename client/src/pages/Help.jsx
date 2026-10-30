import { Link } from 'react-router-dom'
import PublicInformationLayout from '../components/PublicInformationLayout'

const groups = [
  ['getting-started', 'Getting Started', [
    ['How do I create an account?', <>Choose <Link to="/register">Get Started</Link>, enter your email, username, and password, and confirm your password. Read the Terms & Conditions and Privacy Notice, check the required agreement box, and select Register. Your password needs at least eight characters, an uppercase letter, and a number.</>],
    ['How do I verify my email?', 'Enter the six-digit code sent to your registration email. The code expires after ten minutes. If needed, use Resend Code on the verification screen and check your spam folder. Too many incorrect attempts or repeated requests can temporarily limit verification; follow the displayed message. Never share the code.'],
    ['How do I log in or recover my password?', <>Use <Link to="/login">Log In</Link> with your account credentials. If you forgot your password, use <Link to="/forgot-password">Forgot Password</Link>, request a code at your account email, verify the code, and set a new password. Contact support if you cannot complete recovery; do not send your password or code.</>],
  ]],
  ['assessments', 'Assessments', [
    ['How do I complete the assessments?', 'Follow the dashboard assessment steps: save or review optional Personal Factors, choose interests, answer Academic Skills questions, then rate Personality statements. Use the question navigation to review answers, and use the displayed Next or submit action to finish each step.'],
    ['Does progress save, and can I resume?', 'Interests, Academic Skills, and Personality drafts save in your browser and automatically to your account as you answer. Return to the assessment from your dashboard to resume saved progress. Browser-only answers can be lost when signing out, clearing storage, or switching devices, and unsynced answers may not be available elsewhere. Watch for save errors and complete the step using its Next or submit action before leaving. Personal Factors require Save Personal Factors or Save Changes.'],
    ['Can I retake an assessment?', 'Use the assessment retake action available from your dashboard after completing your assessment. A retake starts a new attempt. Submitted answers are locked; review previous saved results in Assessment History. Your saved Personal Factors are reused unless you edit and save them.'],
    ['Are Personal Factors required?', 'No. You can leave a factor unanswered or choose Prefer not to answer. Undisclosed factors are excluded from matching and are not treated as No. If you select Yes, complete the requested impact details and, for accessibility, areas and difficulty levels, or change your choice before saving. Accepting registration Terms does not require these disclosures.'],
    ['Can I leave assessment questions unanswered?', 'Academic Skills and Personality require an answer to every question before submission. Interests requires at least one activity or No interests or hobbies; you may select up to ten interests. Prefer not to answer applies to optional Personal Factors, not to the required assessment questions.'],
  ]],
  ['recommendations', 'Recommendations', [
    ['How are courses recommended?', <>A predefined Weighted Scoring Model combines your academic skills, interests, personality, and disclosed Personal Factors. The weights vary by course cluster. The <Link to="/about" target="_blank" rel="noopener noreferrer">About page</Link> explains each part of the process.</>],
    ['What do scores and explanations mean?', 'The results show your top three courses and component scores. A higher compatibility score means a stronger match within this model; it is not a probability of admission or success. When enabled and available, AI explains computed results. It does not set the ranking, and its explanation may contain errors.'],
    ['Can I rely on a recommendation to choose my course?', 'Use results as a starting point for exploration. Consider your own goals, speak with a guidance counselor, and confirm course requirements and offerings directly with schools. LearnMatch does not guarantee admission, academic success, employment, or career outcomes.'],
    ['Where can I find saved results and history?', 'Open Assessment History from your dashboard to review completed saved attempts, their top three recommendations, and available explanations. Unfinished drafts are progress records, not completed history entries. College alignment tracking has its own check-ins and history for the program you set up.'],
  ]],
  ['account-privacy', 'Account & Privacy', [
    ['How do I update my profile?', 'Open Profile from the student account menu, choose Edit Profile, make your changes, and save. Personal Factors use structured choices and remain optional. Profile edits do not rewrite an earlier saved recommendation; use a new assessment attempt for updated results.'],
    ['Where can I read the Privacy Notice and Terms?', <>Read the <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link> and <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms & Conditions</Link> without signing in. Both are linked in the footer and registration. Settings also provides these links.</>],
    ['How can I permanently delete my account?', <>Self-service Delete Account is implemented in this local version; its availability on the live service has not been verified. Where available, open Settings from the student account menu, choose Delete Account in the Danger Zone, enter your current password, explicitly confirm, and submit. Only a confirmed success means deletion completed. It removes your student records from the active database and signs you out. For an unknown result, do not resubmit until support verifies your account status. If the option is unavailable, contact support. The <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link> explains limits for backups, exports, and provider copies. Automatic inactivity deletion is not enabled.</>],
    ['What should I do if something goes wrong?', 'Read the error message and follow any wait or retry instructions. For a saving problem, check your connection before leaving the page. For an unknown deletion outcome, contact support before trying again. Report the page, steps, approximate time, and error message. If attaching a screenshot, remove private information first.'],
  ]],
]

export default function Help() {
  return <PublicInformationLayout title="Help Center" eyebrow="A little guidance" introduction="Find your next step, understand your results, or get help with your account.">
    <nav aria-label="Help topics" className="mb-8 flex flex-wrap gap-2">{groups.map(([id, title]) => <a key={id} href={`#${id}`} className="lm-action border border-orange-100 bg-white/80">{title}</a>)}<a href="#contact-support" className="lm-action border border-orange-100 bg-white/80">Contact Support</a></nav>
    <div className="space-y-9">{groups.map(([id, title, questions]) => <section id={id} key={id} className="scroll-mt-6" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="mb-4 text-xl font-bold tracking-tight">{title}</h2>
      <div className="overflow-hidden rounded-3xl border border-orange-100 bg-white/85">{questions.map(([question, answer]) => <details key={question} className="group border-b border-orange-100 last:border-b-0">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold leading-6 text-gray-900 transition hover:bg-orange-50 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-orange-600 sm:px-6">{question}</summary>
        <p className="public-document px-5 pb-5 text-sm leading-7 text-gray-600 sm:px-6">{answer}</p>
      </details>)}</div>
    </section>)}</div>
    <section id="contact-support" aria-labelledby="contact-title" className="mt-9 scroll-mt-6 rounded-3xl border border-orange-200 bg-orange-50/80 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800">Contact Support</p><h2 id="contact-title" className="mt-3 text-2xl font-bold tracking-tight">Need a hand?</h2>
      <p className="mt-3 text-sm leading-7 text-gray-700">Email the LearnMatch Research Team to report technical problems or ask about access, correction, objection, or deletion of your information.</p>
      <a href="mailto:learnmatch1@gmail.com" className="public-text-link mt-4 inline-block break-all">learnmatch1@gmail.com</a>
      <p className="mt-4 text-sm leading-7 text-gray-600">Include the page, what you were trying to do, and the error message. Do not send passwords, verification codes, or unnecessary sensitive information. A support email does not automatically change or delete your records.</p>
    </section>
  </PublicInformationLayout>
}
