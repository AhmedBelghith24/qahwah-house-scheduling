import { Navigate } from 'react-router-dom'

function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')

  // Not logged in
  if (!token || !storedUser) {
    return <Navigate to="/" replace />
  }

  let user

  try {
    user = JSON.parse(storedUser)
  } catch {
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    return <Navigate to="/" replace />
  }

  // Logged in, but wrong account type
  if (allowedRole && user.role !== allowedRole) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />
    }

    if (user.role === 'employee') {
      return <Navigate to="/employee" replace />
    }

    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
