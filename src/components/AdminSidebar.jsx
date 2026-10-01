import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/axios'

function AdminSidebar() {
  const location = useLocation()

  const [pendingRequestCount, setPendingRequestCount] = useState(0)

  // ==========================================================
  // FETCH PENDING TIME-OFF REQUEST COUNT
  // ==========================================================

  const fetchPendingRequestCount = async () => {
    try {
      const response = await api.get('/time-off-requests/pending/count')

      setPendingRequestCount(response.data.count || 0)
    } catch (error) {
      console.error('Unable to load pending request count:', error)

      setPendingRequestCount(0)
    }
  }

  // ==========================================================
  // LOAD NOTIFICATION COUNT
  // ==========================================================

  useEffect(() => {
    fetchPendingRequestCount()
  }, [location.pathname])

  // ==========================================================
  // ACTIVE LINK
  // ==========================================================

  const isActive = (path) => {
    return location.pathname === path
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <aside className="admin-sidebar">
      {/* ====================================================
          LOGO
      ==================================================== */}

      <div className="sidebar-logo">
        <img src="/logo.png" alt="Qahwah House" />

        <span>Scheduling</span>
      </div>

      {/* ====================================================
          NAVIGATION
      ==================================================== */}

      <nav className="sidebar-nav">
        <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>
          Dashboard
        </Link>

        <Link
          to="/admin/schedule"
          className={isActive('/admin/schedule') ? 'active' : ''}
        >
          Weekly Schedule
        </Link>

        <Link
          to="/admin/employees"
          className={isActive('/admin/employees') ? 'active' : ''}
        >
          Employees
        </Link>

        <Link
          to="/admin/availability"
          className={isActive('/admin/availability') ? 'active' : ''}
        >
          Availability
        </Link>

        <Link
          to="/admin/requests"
          className={`sidebar-request-link ${
            isActive('/admin/requests') ? 'active' : ''
          }`}
        >
          <span>Requests</span>

          {pendingRequestCount > 0 && (
            <span className="sidebar-request-badge">
              ! {pendingRequestCount}
            </span>
          )}
        </Link>
      </nav>

      {/* ====================================================
          LOGOUT
      ==================================================== */}

      <div className="sidebar-bottom">
        <Link to="/" className="logout-link" onClick={handleLogout}>
          Sign Out
        </Link>
      </div>
    </aside>
  )
}

export default AdminSidebar
