import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import RouteMetadata from './components/RouteMetadata'
import SkipNavigation from './components/SkipNavigation'
import Landing from './pages/Landing'
import AdminRoute from './components/AdminRoute'
import PageTransition from './components/PageTransition'
import StudentEntryRoute from './components/StudentEntryRoute'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'))
const OnboardingProfile = lazy(() => import('./pages/onboarding/OnboardingProfile'))
const OnboardingInterests = lazy(() => import('./pages/onboarding/OnboardingInterests'))
const OnboardingSkills = lazy(() => import('./pages/onboarding/OnboardingSkills'))
const OnboardingPersonality = lazy(() => import('./pages/onboarding/OnboardingPersonality'))
const Results = lazy(() => import('./pages/Results'))
const AssessmentHistory = lazy(() => import('./pages/AssessmentHistory'))
const AssessmentHistoryResult = lazy(() => import('./pages/AssessmentHistoryResult'))
const CollegeSetup = lazy(() => import('./pages/college/CollegeSetup'))
const CollegeSetupReview = lazy(() => import('./pages/college/CollegeSetupReview'))
const CollegeDashboard = lazy(() => import('./pages/college/CollegeDashboard'))
const SemesterCheckin = lazy(() => import('./pages/college/SemesterCheckin'))
const CompletedCheckin = lazy(() => import('./pages/college/CompletedCheckin'))
const SummaryDashboard = lazy(() => import('./pages/SummaryDashboard'))
const CareerPath = lazy(() => import('./pages/CareerPath'))
const Feedback = lazy(() => import('./pages/Feedback'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const ManageCourses = lazy(() => import('./pages/admin/ManageCourses'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'))
const AdminFeedbackDetail = lazy(() => import('./pages/admin/AdminFeedbackDetail'))
const CourseSearch = lazy(() => import('./pages/CourseSearch'))
const PublicCourseDetails = lazy(() => import('./pages/PublicCourseDetails'))
const SchoolLocator = lazy(() => import('./pages/SchoolLocator'))
const PrivacyNotice = lazy(() => import('./pages/PrivacyNotice'))
const Terms = lazy(() => import('./pages/Terms'))
const About = lazy(() => import('./pages/About'))
const Help = lazy(() => import('./pages/Help'))
const StudentSettings = lazy(() => import('./pages/StudentSettings'))

function App() {
  const location = useLocation()
  useEffect(() => {
    if (!['/about', '/help', '/terms', '/privacy'].includes(location.pathname) && !(location.pathname === '/' && location.hash)) return
    const frame = requestAnimationFrame(() => {
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null
      if (target) target.scrollIntoView()
      else window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.hash])
  return (
    <><RouteMetadata /><SkipNavigation /><PageTransition><Suspense fallback={<main id="main-content" tabIndex={-1} className="p-8" aria-busy="true"><p role="status">Loading page...</p></main>}><Routes>
      <Route path="/" element={<StudentEntryRoute><Landing /></StudentEntryRoute>} />
      <Route path="/courses/search" element={<CourseSearch />} />
      <Route path="/courses/:courseCode" element={<PublicCourseDetails />} />
      <Route path="/schools/:courseCode" element={<SchoolLocator />} />
      <Route path="/login" element={<StudentEntryRoute><Login /></StudentEntryRoute>} />
      <Route path="/register" element={<Register />} />
      <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
      <Route path="/privacy" element={<PrivacyNotice />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/about" element={<About />} />
      <Route path="/help" element={<Help />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<StudentSettings />} />
      <Route path="/profile/edit" element={<ProfileEdit />} />
      <Route path="/onboarding/profile" element={<OnboardingProfile />} />
      <Route path="/onboarding/interests" element={<OnboardingInterests />} />
      <Route path="/onboarding/skills" element={<OnboardingSkills />} />
      <Route path="/onboarding/personality" element={<OnboardingPersonality />} />
      <Route path="/college/setup" element={<CollegeSetup />} />
      <Route path="/college/setup/review" element={<CollegeSetupReview />} />
      <Route path="/college" element={<CollegeDashboard />} />
      <Route path="/college/checkin" element={<SemesterCheckin />} />
      <Route path="/college/checkin/results/:checkinId" element={<CompletedCheckin />} />
      <Route path="/results" element={<Results />} />
      <Route path="/assessment-history" element={<AssessmentHistory />} />
      <Route path="/assessment-history/:recommendationId" element={<AssessmentHistoryResult />} />
      <Route path="/dashboard/summary" element={<SummaryDashboard />} />
      <Route path="/results/career-path" element={<CareerPath />} />
      <Route path="/results/career-path/:courseCode" element={<CareerPath />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
      <Route path="/admin/courses" element={<AdminRoute><ManageCourses /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
      <Route path="/admin/feedback" element={<AdminRoute><AdminFeedback /></AdminRoute>} />
      <Route path="/admin/feedback/:feedbackId" element={<AdminRoute><AdminFeedbackDetail /></AdminRoute>} />
      <Route path="*" element={<main id="main-content" tabIndex={-1} className="p-8"><h1 className="text-3xl font-bold">Page not found</h1><Link to="/" className="public-text-link">Return to LearnMatch</Link></main>} />
    </Routes></Suspense></PageTransition></>
  )
}

export default App
