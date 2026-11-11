import { useEffect, useState } from 'react'
import { readActiveAttempt } from '../utils/assessmentSession'
import { getAttemptResumeRoute } from '../utils/assessmentNavigation'

export default function useAssessmentResume() {
  const token = localStorage.getItem('token')
  const [resume, setResume] = useState({ loading: true, route: null, error: '' })
  useEffect(() => {
    let active = true
    readActiveAttempt(import.meta.env.VITE_API_URL, token, sessionStorage)
      .then(attempt => { if (active) setResume({ loading: false, route: getAttemptResumeRoute(attempt), error: '' }) })
      .catch(() => { if (active) setResume({ loading: false, route: null, error: 'Could not check your unfinished assessment. Please refresh before starting another.' }) })
    return () => { active = false }
  }, [token])
  return resume
}
