import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import WeeklyScheduleTimeline from '../../components/WeeklyScheduleTimeline'
import AdminSidebar from '../../components/AdminSidebar'

function AdminDashboard() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [employees, setEmployees] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ==========================================================
  // CURRENT MONDAY
  // ==========================================================

  const getCurrentMonday = () => {
    const today = new Date()

    const day = today.getDay()

    const difference = day === 0 ? -6 : 1 - day

    const monday = new Date(today)

    monday.setHours(12, 0, 0, 0)

    monday.setDate(today.getDate() + difference)

    const year = monday.getFullYear()

    const month = String(monday.getMonth() + 1).padStart(2, '0')

    const date = String(monday.getDate()).padStart(2, '0')

    return `${year}-${month}-${date}`
  }

  const weekStart = getCurrentMonday()

  // ==========================================================
  // ADD DAYS
  // ==========================================================

  const addDays = (dateString, amount) => {
    const [year, month, day] = dateString.split('-').map(Number)

    const date = new Date(year, month - 1, day)

    date.setDate(date.getDate() + amount)

    const newYear = date.getFullYear()

    const newMonth = String(date.getMonth() + 1).padStart(2, '0')

    const newDay = String(date.getDate()).padStart(2, '0')

    return `${newYear}-${newMonth}-${newDay}`
  }

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (dateString, includeYear = false) => {
    if (!dateString) {
      return ''
    }

    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',

      ...(includeYear
        ? {
            year: 'numeric',
          }
        : {}),
    })
  }

  // ==========================================================
  // FETCH DASHBOARD DATA
  // ==========================================================

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)

      setError('')

      // ====================================================
      // EMPLOYEES
      // ====================================================

      try {
        const response = await api.get('/employees')

        const employeeData = Array.isArray(response.data)
          ? response.data
          : response.data.employees || []

        const activeEmployees = employeeData.filter(
          (employee) => employee.status === 'Active',
        )

        setEmployees(activeEmployees)
      } catch (error) {
        console.error('Unable to load employees:', error)

        setEmployees([])
      }

      // ====================================================
      // PUBLISHED SCHEDULE
      // ====================================================

      try {
        const response = await api.get(`/schedules/published/week/${weekStart}`)

        setSchedule(response.data.schedule)
      } catch (error) {
        if (error.response?.status === 404) {
          setSchedule(null)
        } else {
          console.error('Unable to load published schedule:', error)

          setSchedule(null)

          setError(
            error.response?.data?.message ||
              'Unable to load the published schedule.',
          )
        }
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [weekStart])

  // ==========================================================
  // EMPLOYEES SCHEDULED
  // ==========================================================

  const employeesScheduled = useMemo(() => {
    if (!schedule?.shifts) {
      return 0
    }

    const ids = new Set()

    schedule.shifts.forEach((shift) => {
      const employeeId = shift.employeeId?._id || shift.employeeId

      if (employeeId) {
        ids.add(String(employeeId))
      }
    })

    return ids.size
  }, [schedule])

  // ==========================================================
  // TOTAL SCHEDULED HOURS
  // ==========================================================

  const totalScheduledHours = useMemo(() => {
    if (!schedule?.shifts) {
      return 0
    }

    let total = 0

    schedule.shifts.forEach((shift) => {
      if (!shift.startTime || !shift.endTime) {
        return
      }

      const [startHour, startMinute] = shift.startTime.split(':').map(Number)

      const [endHour, endMinute] = shift.endTime.split(':').map(Number)

      const start = startHour * 60 + startMinute

      const end = endHour * 60 + endMinute

      if (end > start) {
        total += (end - start) / 60
      }
    })

    return total
  }, [schedule])

  // ==========================================================
  // WEEK END
  // ==========================================================

  const weekEnd = addDays(weekStart, 6)

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="admin-layout">
      {/* ====================================================
          SHARED ADMIN SIDEBAR
      ==================================================== */}

      <AdminSidebar />

      {/* ====================================================
          MAIN
      ==================================================== */}

      <main className="admin-main">
        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="admin-topbar">
          <div>
            <h1>Dashboard</h1>

            <p>Manage your team and view the published weekly schedule.</p>
          </div>

          <div className="admin-profile">
            <div className="admin-avatar">A</div>

            <div>
              <strong>Admin</strong>

              <span>Manager</span>
            </div>
          </div>
        </header>

        {/* ==================================================
            SUMMARY
        ================================================== */}

        <section className="dashboard-cards">
          {/* EMPLOYEES */}

          <div className="dashboard-card">
            <span className="card-label">Active Employees</span>

            <strong>{employees.length}</strong>

            <p>Current team members</p>
          </div>

          {/* SCHEDULED EMPLOYEES */}

          <div className="dashboard-card">
            <span className="card-label">Employees Scheduled</span>

            <strong>{employeesScheduled}</strong>

            <p>Working this week</p>
          </div>

          {/* TOTAL HOURS */}

          <div className="dashboard-card">
            <span className="card-label">Scheduled Hours</span>

            <strong>{totalScheduledHours}</strong>

            <p>Total employee hours</p>
          </div>

          {/* STATUS */}

          <div className="dashboard-card">
            <span className="card-label">Schedule</span>

            {schedule ? (
              <strong className="status-published">Published</strong>
            ) : (
              <strong className="status-draft">Not Published</strong>
            )}

            <p>Current week</p>
          </div>
        </section>

        {/* ==================================================
            WEEKLY SCHEDULE SECTION
        ================================================== */}

        <section className="dashboard-section dashboard-timeline-section">
          {/* =================================================
              HEADER
          ================================================= */}

          <div className="section-heading dashboard-timeline-heading">
            <div>
              <span className="dashboard-section-label">CURRENT WEEK</span>

              <h2>This Week&apos;s Schedule</h2>

              <p>
                {formatDate(weekStart)}

                {' – '}

                {formatDate(weekEnd, true)}
              </p>
            </div>

            <div className="dashboard-schedule-actions">
              {schedule && (
                <span className="dashboard-published-badge">✓ Published</span>
              )}

              <Link to="/admin/schedule" className="outline-button">
                View Full Schedule
              </Link>
            </div>
          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && <div className="dashboard-schedule-error">{error}</div>}

          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (
            <div className="dashboard-loading-state">
              <div className="empty-calendar">☕</div>

              <h3>Loading schedule...</h3>

              <p>Getting this week&apos;s published schedule.</p>
            </div>
          )}

          {/* =================================================
              NO PUBLISHED SCHEDULE
          ================================================= */}

          {!loading && !schedule && (
            <div className="empty-state">
              <div className="empty-calendar">☕</div>

              <h3>No published schedule yet</h3>

              <p>
                Generate and publish this week&apos;s schedule to see the
                timeline here.
              </p>

              <Link to="/admin/schedule" className="primary-button">
                Create Schedule
              </Link>
            </div>
          )}

          {/* =================================================
              TIMELINE
          ================================================= */}

          {!loading && schedule && (
            <div className="dashboard-timeline-wrapper">
              <WeeklyScheduleTimeline
                schedule={schedule}
                weekStart={weekStart}
              />
            </div>
          )}
        </section>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section className="dashboard-section dashboard-quick-section">
          <div className="section-heading">
            <div>
              <h2>Quick Actions</h2>

              <p>Common management tasks</p>
            </div>
          </div>

          <div className="quick-actions">
            <Link to="/admin/employees">+ Add Employee</Link>

            <Link to="/admin/schedule">Manage Weekly Schedule</Link>

            <Link to="/admin/availability">View Availability</Link>

            <Link to="/admin/requests">Review Requests</Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard
