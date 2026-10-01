import { Link, useLocation } from 'react-router-dom'

function EmployeeSidebar() {
  const location = useLocation()

  // ==========================================================
  // CURRENT USER
  // ==========================================================

  let user = null

  try {
    user = JSON.parse(localStorage.getItem('user'))
  } catch {
    user = null
  }

  const firstName = user?.firstName || user?.employee?.firstName || 'Employee'

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

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <aside className="employee-dashboard-sidebar">
      {/* ====================================================
          LOGO
      ==================================================== */}

      <div className="employee-sidebar-logo">
        <img src="/logo.png" alt="Qahwah House" />
      </div>

      {/* ====================================================
          NAVIGATION
      ==================================================== */}

      <nav className="employee-sidebar-nav">
        <Link
          to="/employee"
          className={`employee-sidebar-link ${
            isActive('/employee') ? 'active' : ''
          }`}
        >
          Dashboard
        </Link>

        <Link
          to="/employee/schedule"
          className={`employee-sidebar-link ${
            isActive('/employee/schedule') ? 'active' : ''
          }`}
        >
          My Schedule
        </Link>

        <Link
          to="/employee/availability"
          className={`employee-sidebar-link ${
            isActive('/employee/availability') ? 'active' : ''
          }`}
        >
          My Availability
        </Link>

        <Link
          to="/employee/requests"
          className={`employee-sidebar-link ${
            isActive('/employee/requests') ? 'active' : ''
          }`}
        >
          Time Off
        </Link>
      </nav>

      {/* ====================================================
          PROFILE + LOGOUT
      ==================================================== */}

      <div className="employee-sidebar-bottom">
        <div className="employee-sidebar-profile">
          <div className="employee-sidebar-avatar">
            {firstName.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{firstName}</strong>

            <span>Employee</span>
          </div>
        </div>

        <Link to="/" className="employee-logout-link" onClick={handleLogout}>
          Sign Out
        </Link>
      </div>
    </aside>
  )
}

export default EmployeeSidebar
