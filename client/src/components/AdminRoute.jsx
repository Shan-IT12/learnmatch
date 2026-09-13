import { Navigate } from 'react-router-dom'

function AdminRoute({ children }) {
  return localStorage.getItem('adminToken')
    ? children
    : <Navigate to="/admin/login" replace />
}

export default AdminRoute
