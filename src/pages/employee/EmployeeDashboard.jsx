import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import EmployeeSidebar from '../../components/EmployeeSidebar'

function EmployeeDashboard() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [schedule, setSchedule] = useState(null)
  const [availabilityRecords, setAvailabilityRecords] = useState([])
  const [timeOffRequests, setTimeOffRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // ==========================================================
  // CURRENT USER
  // ==========================================================

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch {
      return null
    }
  }, [])

  // ==========================================================
  // CURRENT MONDAY
  // ==========================================================

  const getCurrentMonday = () => {
    const today = new Date()

    const day = today.getDay()

    const difference = day === 0 ? -6 : 1 - day

    const monday = new Date(today)

    monday.setDate(today.getDate() + difference)

    const year = monday.getFullYear()

    const month = String(monday.getMonth() + 1).padStart(2, '0')

    const date = String(monday.getDate()).padStart(2, '0')

    return `${year}-${month}-${date}`
  }

  const weekStart = useMemo(() => getCurrentMonday(), [])

  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      setMessage('')

      const [scheduleResponse, availabilityResponse, timeOffResponse] =
        await Promise.allSettled([
          api.get(`/schedules/my/week/${weekStart}`),

          api.get('/availability/me'),

          api.get('/time-off-requests/me'),
        ])

      // ==========================================
      // SCHEDULE
      // ==========================================

      if (scheduleResponse.status === 'fulfilled') {
        setSchedule(
          scheduleResponse.value.data.schedule || scheduleResponse.value.data,
        )
      } else {
        setSchedule(null)

        if (scheduleResponse.reason?.response?.status !== 404) {
          console.error('Schedule error:', scheduleResponse.reason)
        }
      }

      // ==========================================
      // AVAILABILITY
      // ==========================================

      if (availabilityResponse.status === 'fulfilled') {
        const data = availabilityResponse.value.data

        setAvailabilityRecords(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.availability)
              ? data.availability
              : Array.isArray(data?.records)
                ? data.records
                : [],
        )
      } else {
        console.error('Availability error:', availabilityResponse.reason)

        setAvailabilityRecords([])
      }

      // ==========================================
      // TIME OFF
      // ==========================================

      if (timeOffResponse.status === 'fulfilled') {
        const data = timeOffResponse.value.data

        setTimeOffRequests(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.requests)
              ? data.requests
              : Array.isArray(data?.timeOffRequests)
                ? data.timeOffRequests
                : [],
        )
      } else {
        console.error('Time off error:', timeOffResponse.reason)

        setTimeOffRequests([])
      }
    } catch (error) {
      console.error('Dashboard error:', error)

      setMessage('Unable to load dashboard information.')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (dateString) => {
    if (!dateString) {
      return ''
    }

    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  const formatTime = (time) => {
    if (!time) {
      return ''
    }

    const [hours, minutes] = time.split(':').map(Number)

    const date = new Date()

    date.setHours(hours, minutes, 0, 0)

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // ==========================================================
  // TIME TO MINUTES
  // ==========================================================

  const timeToMinutes = (time) => {
    if (!time) {
      return 0
    }

    const [hours, minutes] = time.split(':').map(Number)

    return hours * 60 + minutes
  }

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
  // SORTED SHIFTS
  // ==========================================================

  const shifts = useMemo(() => {
    if (!schedule || !Array.isArray(schedule.shifts)) {
      return []
    }

    return [...schedule.shifts].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)

      if (dateCompare !== 0) {
        return dateCompare
      }

      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    })
  }, [schedule])

  // ==========================================================
  // WEEKLY HOURS
  // ==========================================================

  const weeklyHours = useMemo(() => {
    const totalMinutes = shifts.reduce((total, shift) => {
      const start = timeToMinutes(shift.startTime)

      const end = timeToMinutes(shift.endTime)

      return total + Math.max(end - start, 0)
    }, 0)

    return totalMinutes / 60
  }, [shifts])

  // ==========================================================
  // NEXT SHIFT
  // ==========================================================

  const nextShift = useMemo(() => {
    if (shifts.length === 0) {
      return null
    }

    const now = new Date()

    return (
      shifts.find((shift) => {
        const [year, month, day] = shift.date.split('-').map(Number)

        const [hours, minutes] = shift.endTime.split(':').map(Number)

        const shiftEnd = new Date(year, month - 1, day, hours, minutes)

        return shiftEnd > now
      }) || null
    )
  }, [shifts])

  // ==========================================================
  // CURRENT WEEK AVAILABILITY
  // ==========================================================

  const currentAvailability = useMemo(() => {
    return (
      availabilityRecords.find((record) => record.weekStart === weekStart) ||
      null
    )
  }, [availabilityRecords, weekStart])

  // ==========================================================
  // AVAILABLE DAYS COUNT
  // ==========================================================

  const availableDaysCount = useMemo(() => {
    if (
      !currentAvailability ||
      !Array.isArray(currentAvailability.availability)
    ) {
      return 0
    }

    return currentAvailability.availability.filter((day) => day.available)
      .length
  }, [currentAvailability])

  // ==========================================================
  // LATEST TIME OFF
  // ==========================================================

  const latestTimeOff = useMemo(() => {
    if (timeOffRequests.length === 0) {
      return null
    }

    return [...timeOffRequests].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date)

      const dateB = new Date(b.createdAt || b.date)

      return dateB - dateA
    })[0]
  }, [timeOffRequests])

  // ==========================================================
  // EMPLOYEE NAME
  // ==========================================================

  const firstName = user?.firstName || user?.employee?.firstName || 'Employee'

  // ==========================================================
  // GREETING
  // ==========================================================

  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 18
        ? 'Good afternoon'
        : 'Good evening'

  // ==========================================================
  // DAYS
  // ==========================================================

  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="employee-dashboard-layout">
      {/* ====================================================
          SHARED SIDEBAR
      ==================================================== */}

      <EmployeeSidebar />

      {/* ====================================================
          MAIN
      ==================================================== */}

      <main className="employee-dashboard-main">
        {/* ==================================================
            WELCOME
        ================================================== */}

        <section className="employee-welcome">
          <div>
            <span className="employee-welcome-label">EMPLOYEE DASHBOARD</span>

            <h1>
              {greeting}, {firstName}.
            </h1>

            <p>Here's your schedule and activity for this week.</p>
          </div>

          <div className="employee-current-week">
            <span>CURRENT WEEK</span>

            <strong>
              {formatDate(weekStart)}

              {' — '}

              {formatDate(addDays(weekStart, 6))}
            </strong>
          </div>
        </section>

        {/* ==================================================
            PUBLISHED SCHEDULE NOTICE
        ================================================== */}

        {!loading && schedule && (
          <section className="employee-published-notice">
            <div className="employee-published-notice-icon">✓</div>

            <div className="employee-published-notice-content">
              <span className="employee-published-notice-label">
                SCHEDULE PUBLISHED
              </span>

              <h2>Your schedule is ready</h2>

              <p>
                Your schedule for{' '}
                <strong>
                  {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
                </strong>{' '}
                has been published.
              </p>

              <div className="employee-published-notice-details">
                <div>
                  <span>Shifts</span>

                  <strong>{shifts.length}</strong>
                </div>

                <div>
                  <span>Hours</span>

                  <strong>{weeklyHours} hrs</strong>
                </div>

                {nextShift && (
                  <div>
                    <span>Next Shift</span>

                    <strong>{formatDate(nextShift.date)}</strong>

                    <small>
                      {formatTime(nextShift.startTime)} –{' '}
                      {formatTime(nextShift.endTime)}
                    </small>
                  </div>
                )}
              </div>
            </div>

            <Link
              to="/employee/schedule"
              className="employee-published-notice-button"
            >
              View My Schedule
              <span>→</span>
            </Link>
          </section>
        )}

        {/* ==================================================
            MESSAGE
        ================================================== */}

        {message && <div className="employee-dashboard-message">{message}</div>}

        {/* ==================================================
            SUMMARY CARDS
        ================================================== */}

        <section className="employee-dashboard-stats">
          {/* NEXT SHIFT */}

          <article className="employee-stat-card">
            <div className="employee-stat-icon">↗</div>

            <div>
              <span className="employee-stat-label">NEXT SHIFT</span>

              {loading ? (
                <strong>Loading...</strong>
              ) : nextShift ? (
                <>
                  <strong>{formatDate(nextShift.date)}</strong>

                  <p>
                    {formatTime(nextShift.startTime)}

                    {' – '}

                    {formatTime(nextShift.endTime)}
                  </p>
                </>
              ) : (
                <>
                  <strong>No upcoming shift</strong>

                  <p>Nothing scheduled</p>
                </>
              )}
            </div>
          </article>

          {/* WEEKLY HOURS */}

          <article className="employee-stat-card">
            <div className="employee-stat-icon">◷</div>

            <div>
              <span className="employee-stat-label">WEEKLY HOURS</span>

              <strong>{loading ? '—' : `${weeklyHours} hrs`}</strong>

              <p>Scheduled this week</p>
            </div>
          </article>

          {/* SHIFTS */}

          <article className="employee-stat-card">
            <div className="employee-stat-icon">✓</div>

            <div>
              <span className="employee-stat-label">SHIFTS</span>

              <strong>{loading ? '—' : shifts.length}</strong>

              <p>This week</p>
            </div>
          </article>
        </section>

        {/* ==================================================
            MY SCHEDULE
        ================================================== */}

        <section className="employee-week-card">
          <div className="employee-section-header">
            <div>
              <span className="employee-section-label">THIS WEEK</span>

              <h2>My Schedule</h2>
            </div>

            <Link to="/employee/schedule" className="employee-view-all">
              View Full Schedule
              <span>→</span>
            </Link>
          </div>

          {loading ? (
            <div className="employee-week-empty">Loading your schedule...</div>
          ) : shifts.length === 0 ? (
            <div className="employee-week-empty">
              <div className="employee-empty-icon">◷</div>

              <h3>No schedule published</h3>

              <p>Your published schedule for this week will appear here.</p>
            </div>
          ) : (
            <div className="employee-week-days">
              {days.map((dayName, index) => {
                const date = addDays(weekStart, index)

                const dayShifts = shifts.filter((shift) => shift.date === date)

                return (
                  <div
                    className={`employee-week-day ${
                      dayShifts.length > 0 ? 'working' : 'off'
                    }`}
                    key={dayName}
                  >
                    <div className="employee-week-day-heading">
                      <strong>{dayName.slice(0, 3)}</strong>

                      <span>{formatDate(date).split(',')[1]?.trim()}</span>
                    </div>

                    {dayShifts.length > 0 ? (
                      <div className="employee-week-shifts">
                        {dayShifts.map((shift) => (
                          <div
                            className="employee-week-shift"
                            key={
                              shift._id ||
                              `${shift.date}-${shift.startTime}-${shift.endTime}`
                            }
                          >
                            <span>Shift</span>

                            <strong>{formatTime(shift.startTime)}</strong>

                            <small>to</small>

                            <strong>{formatTime(shift.endTime)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="employee-day-off">
                        <span>Day Off</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ==================================================
            AVAILABILITY + TIME OFF
        ================================================== */}

        <section className="employee-requests-section">
          <div className="employee-section-header">
            <div>
              <span className="employee-section-label">MY ACTIVITY</span>

              <h2>Availability & Time Off</h2>
            </div>
          </div>

          <div className="employee-request-grid">
            {/* ==============================================
                AVAILABILITY
            ============================================== */}

            <article className="employee-request-card">
              <div className="employee-request-card-top">
                <div className="employee-request-icon">◫</div>

                <span className="employee-request-type">AVAILABILITY</span>
              </div>

              {loading ? (
                <div className="employee-request-none">
                  <strong>Loading...</strong>
                </div>
              ) : currentAvailability ? (
                <>
                  <div className="employee-request-information">
                    <span>Current Week</span>

                    <strong>{formatDate(currentAvailability.weekStart)}</strong>

                    <small>
                      {availableDaysCount}{' '}
                      {availableDaysCount === 1 ? 'day' : 'days'} available
                    </small>
                  </div>

                  <div className="employee-request-status-row">
                    <span className="employee-request-status approved">
                      <i />
                      Saved
                    </span>

                    <span className="employee-request-latest">
                      Used for scheduling
                    </span>
                  </div>
                </>
              ) : (
                <div className="employee-request-none">
                  <strong>Availability not set</strong>

                  <p>Set your availability for this week.</p>
                </div>
              )}

              <Link
                to="/employee/availability"
                className="employee-request-link"
              >
                {currentAvailability ? 'View Availability' : 'Set Availability'}

                <span>→</span>
              </Link>
            </article>

            {/* ==============================================
                TIME OFF
            ============================================== */}

            <article className="employee-request-card">
              <div className="employee-request-card-top">
                <div className="employee-request-icon">◷</div>

                <span className="employee-request-type">TIME OFF</span>
              </div>

              {loading ? (
                <div className="employee-request-none">
                  <strong>Loading...</strong>
                </div>
              ) : latestTimeOff ? (
                <>
                  <div className="employee-request-information">
                    <span>Requested Date</span>

                    <strong>{formatDate(latestTimeOff.date)}</strong>

                    {latestTimeOff.allDay ? (
                      <small>All Day</small>
                    ) : (
                      latestTimeOff.startTime &&
                      latestTimeOff.endTime && (
                        <small>
                          {formatTime(latestTimeOff.startTime)}

                          {' – '}

                          {formatTime(latestTimeOff.endTime)}
                        </small>
                      )
                    )}
                  </div>

                  <div className="employee-request-status-row">
                    <span
                      className={`employee-request-status ${
                        latestTimeOff.status?.toLowerCase() || 'pending'
                      }`}
                    >
                      <i />

                      {latestTimeOff.status || 'Pending'}
                    </span>

                    <span className="employee-request-latest">
                      Latest request
                    </span>
                  </div>
                </>
              ) : (
                <div className="employee-request-none">
                  <strong>No requests yet</strong>

                  <p>You haven't submitted any time-off requests.</p>
                </div>
              )}

              <Link to="/employee/requests" className="employee-request-link">
                View Time Off
                <span>→</span>
              </Link>
            </article>
          </div>
        </section>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section className="employee-quick-section">
          <div className="employee-section-header">
            <div>
              <span className="employee-section-label">SELF SERVICE</span>

              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="employee-quick-grid">
            {/* AVAILABILITY */}

            <Link to="/employee/availability" className="employee-quick-card">
              <div className="employee-quick-icon">◫</div>

              <div className="employee-quick-content">
                <h3>My Availability</h3>

                <p>Set or update when you're available to work.</p>
              </div>

              <span className="employee-quick-arrow">→</span>
            </Link>

            {/* TIME OFF */}

            <Link to="/employee/requests" className="employee-quick-card">
              <div className="employee-quick-icon">◷</div>

              <div className="employee-quick-content">
                <h3>Request Time Off</h3>

                <p>Submit and review your time-off requests.</p>
              </div>

              <span className="employee-quick-arrow">→</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default EmployeeDashboard
