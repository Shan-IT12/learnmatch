import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconBooks } from '@tabler/icons-react'
import AdminHeader from '../../components/AdminHeader'

function AdminDashboard() {
  const navigate = useNavigate()
  const [courseCount, setCourseCount] = useState(null)
  const adminUsername = localStorage.getItem('adminUsername')

  useEffect(() => {
    const loadCourseCount = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/courses`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
        })

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/admin/login', { replace: true })
          return
        }

        if (!response.ok) return
        const data = await response.json()
        setCourseCount(Array.isArray(data.courses) ? data.courses.length : null)
      } catch {
        setCourseCount(null)
      }
    }

    loadCourseCount()
  }, [navigate])

  return (
    <div className="min-h-screen bg-orange-50/40">
      <AdminHeader currentPage="dashboard" />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-2">Administration</p>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-2">
            {adminUsername ? `Welcome, ${adminUsername}. ` : ''}Manage LearnMatch data and system resources.
          </p>
        </div>

        <section aria-labelledby="management-heading">
          <h2 id="management-heading" className="text-sm font-semibold text-gray-800 mb-4">Management</h2>
          <button
            type="button"
            onClick={() => navigate('/admin/courses')}
            className="w-full sm:max-w-xl text-left bg-white border border-orange-100 rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-orange-200 transition focus:outline-none focus:ring-2 focus:ring-orange-500 group"
          >
            <div className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                <IconBooks size={22} stroke={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">Manage Courses</span>
                  {courseCount !== null && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                      {courseCount} total
                    </span>
                  )}
                </span>
                <span className="block text-sm text-gray-500 mt-1">View and manage the LearnMatch course catalog.</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 mt-5 group-hover:text-orange-700">
                  Open Course Management <IconArrowRight size={16} stroke={2} />
                </span>
              </span>
            </div>
          </button>
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard
