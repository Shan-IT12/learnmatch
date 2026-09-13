import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import OnboardingProfile from './pages/onboarding/OnboardingProfile'
import OnboardingInterests from './pages/onboarding/OnboardingInterests'
import OnboardingSkills from './pages/onboarding/OnboardingSkills'
import OnboardingPersonality from './pages/onboarding/OnboardingPersonality'
import Results from './pages/Results'
import CollegeSetup from './pages/college/CollegeSetup' 
import CollegeDashboard from './pages/college/CollegeDashboard'
import SemesterCheckin from './pages/college/SemesterCheckin'
import SummaryDashboard from './pages/SummaryDashboard'
import CareerPath from './pages/CareerPath'
import Feedback from './pages/Feedback'
import AdminLogin from "./pages/AdminLogin";
import ManageCourses from './pages/admin/ManageCourses'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminRoute from './components/AdminRoute'
import CourseSearch from './pages/CourseSearch'
import PublicCourseDetails from './pages/PublicCourseDetails'
import './App.css'


function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/courses/search" element={<CourseSearch />} />
      <Route path="/courses/:courseCode" element={<PublicCourseDetails />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/onboarding/profile" element={<OnboardingProfile />} />
      <Route path="/onboarding/interests" element={<OnboardingInterests />} />
      <Route path="/onboarding/skills" element={<OnboardingSkills />} />
      <Route path="/onboarding/personality" element={<OnboardingPersonality />} />
      <Route path="/college/setup" element={<CollegeSetup />} />
      <Route path="/college" element={<CollegeDashboard />} />
      <Route path="/college/checkin" element={<SemesterCheckin />} />
      <Route path="/results" element={<Results />} />
      <Route path="/dashboard/summary" element={<SummaryDashboard />} />
      <Route path="/results/career-path/:courseId" element={<CareerPath />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/courses" element={<AdminRoute><ManageCourses /></AdminRoute>} />
    </Routes>
  )
}

export default App
