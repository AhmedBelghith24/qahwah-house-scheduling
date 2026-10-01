import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import EmployeeSidebar from '../../components/EmployeeSidebar'

function MySchedule() {
  const [weekStart, setWeekStart] = useState(getCurrentMonday())
  const [schedule, setSchedule] = useState(null)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // =======================================================
  // LOAD SCHEDULE
  // =======================================================

  useEffect(() => {
    fetchSchedule()
  }, [weekStart])

  // =======================================================
  // GET CURRENT MONDAY
  // =======================================================

  function getCurrentMonday() {
    const today = new Date()

    const day = today.getDay()

    const difference = today.getDate() - day + (day === 0 ? -6 : 1)

    const monday = new Date(today)

    monday.setDate(difference)
    monday.setHours(0, 0, 0, 0)

    return formatDateForApi(monday)
  }

  // =======================================================
  // DATE FOR API
  // =======================================================

  function formatDateForApi(date) {
    const year = date.getFullYear()

    const month = String(date.getMonth() + 1).padStart(2, '0')

    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  // =======================================================
  // SAFE DATE
  // =======================================================

  function createLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day)
  }

  // =======================================================
  // ADD DAYS
  // =======================================================

  function addDays(dateString, amount) {
    const date = createLocalDate(dateString)

    date.setDate(date.getDate() + amount)

    return formatDateForApi(date)
  }

  // =======================================================
  // LOAD SCHEDULE
  // =======================================================

  async function fetchSchedule() {
    try {
      setLoading(true)
      setMessage('')

      const response = await api.get(`/schedules/my/week/${weekStart}`)

      setSchedule(response.data.schedule || response.data || null)
    } catch (error) {
      if (error.response?.status === 404) {
        setSchedule(null)
      } else {
        console.error('Unable to load employee schedule:', error)

        setSchedule(null)

        setMessage(
          error.response?.data?.message || 'Unable to load your schedule.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // =======================================================
  // WEEK NAVIGATION
  // =======================================================

  function previousWeek() {
    setWeekStart(addDays(weekStart, -7))
  }

  function nextWeek() {
    setWeekStart(addDays(weekStart, 7))
  }

  function currentWeek() {
    setWeekStart(getCurrentMonday())
  }

  // =======================================================
  // FORMAT DATE
  // =======================================================

  function formatDate(dateString, options = {}) {
    if (!dateString) return ''

    const date = createLocalDate(dateString)

    return date.toLocaleDateString('en-US', options)
  }

  // =======================================================
  // FORMAT TIME
  // =======================================================

  function formatTime(time) {
    if (!time) return ''

    const [hourString, minuteString] = time.split(':')

    let hour = Number(hourString)

    const minute = minuteString || '00'

    const period = hour >= 12 ? 'PM' : 'AM'

    hour = hour % 12 || 12

    return `${hour}:${minute} ${period}`
  }

  // =======================================================
  // TIME TO MINUTES
  // =======================================================

  function timeToMinutes(time) {
    if (!time) return 0

    const [hours, minutes] = time.split(':').map(Number)

    return hours * 60 + minutes
  }

  // =======================================================
  // WEEK DAYS
  // =======================================================

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index)

      return {
        date,

        dayName: formatDate(date, {
          weekday: 'long',
        }),

        shortDay: formatDate(date, {
          weekday: 'short',
        }),

        displayDate: formatDate(date, {
          month: 'short',
          day: 'numeric',
        }),
      }
    })
  }, [weekStart])

  // =======================================================
  // SHIFTS
  // =======================================================

  const shifts = useMemo(() => {
    if (!schedule?.shifts) {
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

  // =======================================================
  // SHIFTS BY DAY
  // =======================================================

  function getShiftsForDay(date) {
    return shifts.filter((shift) => shift.date === date)
  }

  // =======================================================
  // WEEKLY HOURS
  // =======================================================

  const weeklyHours = useMemo(() => {
    const minutes = shifts.reduce((total, shift) => {
      const start = timeToMinutes(shift.startTime)

      const end = timeToMinutes(shift.endTime)

      return total + Math.max(0, end - start)
    }, 0)

    return (minutes / 60).toFixed(1)
  }, [shifts])

  // =======================================================
  // NEXT SHIFT
  // =======================================================

  const nextShift = useMemo(() => {
    const now = new Date()

    const upcoming = shifts
      .map((shift) => {
        const [year, month, day] = shift.date.split('-').map(Number)

        const [hour, minute] = shift.startTime.split(':').map(Number)

        const startDate = new Date(year, month - 1, day, hour, minute)

        return {
          ...shift,
          startDate,
        }
      })
      .filter((shift) => shift.startDate >= now)
      .sort((a, b) => a.startDate - b.startDate)

    return upcoming[0] || null
  }, [shifts])

  // =======================================================
  // WEEK RANGE
  // =======================================================

  const weekEnd = addDays(weekStart, 6)

  const weekRange = `${formatDate(weekStart, {
    month: 'long',
    day: 'numeric',
  })} - ${formatDate(weekEnd, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="employee-schedule-layout">
      {/* ==============================
          SHARED SIDEBAR
      ============================== */}

      <EmployeeSidebar />

      {/* ==============================
          MAIN
      ============================== */}

      <main className="employee-schedule-main">
        {/* ============================
            PAGE HEADER
        ============================ */}

        <section className="employee-schedule-header">
          <div>
            <span className="employee-schedule-label">EMPLOYEE SCHEDULE</span>

            <h1>My Schedule</h1>

            <p>View your published work schedule and upcoming shifts.</p>
          </div>

          <div className="employee-schedule-week-range">
            <span>SELECTED WEEK</span>

            <strong>{weekRange}</strong>
          </div>
        </section>

        {/* ============================
            WEEK CONTROLS
        ============================ */}

        <section className="employee-schedule-controls">
          <button
            type="button"
            onClick={previousWeek}
            className="employee-schedule-nav-button"
          >
            ← Previous Week
          </button>

          <button
            type="button"
            onClick={currentWeek}
            className="employee-schedule-today-button"
          >
            Current Week
          </button>

          <button
            type="button"
            onClick={nextWeek}
            className="employee-schedule-nav-button"
          >
            Next Week →
          </button>
        </section>

        {/* ============================
            ERROR
        ============================ */}

        {message && <div className="employee-dashboard-message">{message}</div>}

        {/* ============================
            LOADING
        ============================ */}

        {loading ? (
          <section className="employee-schedule-loading">
            <div className="employee-schedule-loader" />

            <p>Loading your schedule...</p>
          </section>
        ) : (
          <>
            {/* ========================
                SUMMARY
            ======================== */}

            <section className="employee-schedule-summary">
              <article className="employee-schedule-summary-card">
                <span>WEEKLY HOURS</span>

                <strong>{weeklyHours}</strong>

                <p>Scheduled hours</p>
              </article>

              <article className="employee-schedule-summary-card">
                <span>TOTAL SHIFTS</span>

                <strong>{shifts.length}</strong>

                <p>This week</p>
              </article>

              <article className="employee-schedule-summary-card">
                <span>NEXT SHIFT</span>

                <strong>
                  {nextShift
                    ? formatDate(nextShift.date, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </strong>

                <p>
                  {nextShift
                    ? `${formatTime(nextShift.startTime)} - ${formatTime(
                        nextShift.endTime,
                      )}`
                    : 'No upcoming shift'}
                </p>
              </article>
            </section>

            {/* ========================
                SCHEDULE
            ======================== */}

            <section className="employee-my-schedule-card">
              <div className="employee-my-schedule-heading">
                <div>
                  <span>WEEKLY SCHEDULE</span>

                  <h2>{weekRange}</h2>
                </div>

                {schedule && (
                  <div className="employee-published-badge">
                    <i />
                    Published
                  </div>
                )}
              </div>

              {!schedule || shifts.length === 0 ? (
                <div className="employee-schedule-empty">
                  <div className="employee-schedule-empty-icon">◷</div>

                  <h3>No published schedule</h3>

                  <p>
                    There is no published schedule available for this week yet.
                  </p>
                </div>
              ) : (
                <div className="employee-schedule-days">
                  {weekDays.map((day) => {
                    const dayShifts = getShiftsForDay(day.date)

                    const working = dayShifts.length > 0

                    return (
                      <article
                        key={day.date}
                        className={
                          working
                            ? 'employee-schedule-day working'
                            : 'employee-schedule-day'
                        }
                      >
                        <div className="employee-schedule-day-header">
                          <div>
                            <strong>{day.shortDay}</strong>

                            <span>{day.displayDate}</span>
                          </div>

                          {working && <span className="employee-working-dot" />}
                        </div>

                        {working ? (
                          <div className="employee-schedule-day-shifts">
                            {dayShifts.map((shift, index) => (
                              <div
                                key={shift._id || `${day.date}-${index}`}
                                className="employee-schedule-shift"
                              >
                                <span>SHIFT</span>

                                <strong>{formatTime(shift.startTime)}</strong>

                                <small>to</small>

                                <strong>{formatTime(shift.endTime)}</strong>

                                {shift.assignedRole && (
                                  <p>{shift.assignedRole}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="employee-schedule-day-off">
                            <span>Day Off</span>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default MySchedule
