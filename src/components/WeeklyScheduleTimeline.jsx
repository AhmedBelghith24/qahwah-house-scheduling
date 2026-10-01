import { useMemo, useState } from 'react'

function WeeklyScheduleTimeline({ schedule, weekStart }) {
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]

  const [selectedDay, setSelectedDay] = useState('Monday')

  // ==========================================================
  // DATE HELPERS
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

  const formatDate = (dateString) => {
    if (!dateString) return ''

    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const timeToMinutes = (time) => {
    if (!time) return 0

    const [hours, minutes] = time.split(':').map(Number)

    return hours * 60 + minutes
  }

  const formatTime = (time) => {
    if (!time) return ''

    const [hour, minute] = time.split(':').map(Number)

    const date = new Date()

    date.setHours(hour)
    date.setMinutes(minute)

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatHour = (hour) => {
    if (hour === 12) {
      return '12 PM'
    }

    if (hour > 12) {
      return `${hour - 12} PM`
    }

    return `${hour} AM`
  }

  // ==========================================================
  // SELECTED DAY
  // ==========================================================

  const selectedDayIndex = days.indexOf(selectedDay)

  const selectedDate = addDays(weekStart, selectedDayIndex)

  // ==========================================================
  // STORE HOURS
  // ==========================================================

  const openHour = 8

  const closeHour =
    selectedDay === 'Friday' || selectedDay === 'Saturday' ? 22 : 21

  const openMinutes = openHour * 60

  const closeMinutes = closeHour * 60

  const totalMinutes = closeMinutes - openMinutes

  // ==========================================================
  // HOURS ACROSS TOP
  // ==========================================================

  const hourMarkers = useMemo(() => {
    const markers = []

    for (let hour = openHour; hour <= closeHour; hour++) {
      markers.push(hour)
    }

    return markers
  }, [selectedDay, closeHour])

  // ==========================================================
  // SHIFTS FOR SELECTED DAY
  // ==========================================================

  const dayShifts = useMemo(() => {
    if (!schedule?.shifts) {
      return []
    }

    return schedule.shifts
      .filter((shift) => shift.date === selectedDate)
      .sort((a, b) => {
        const nameA = `${a.employeeId?.firstName || ''} ${
          a.employeeId?.lastName || ''
        }`

        const nameB = `${b.employeeId?.firstName || ''} ${
          b.employeeId?.lastName || ''
        }`

        return nameA.localeCompare(nameB)
      })
  }, [schedule, selectedDate])

  // ==========================================================
  // GROUP MULTIPLE SHIFTS FOR SAME EMPLOYEE
  // ==========================================================

  const employeeRows = useMemo(() => {
    const grouped = {}

    dayShifts.forEach((shift) => {
      const employee = shift.employeeId

      if (!employee) return

      const id = employee._id

      if (!grouped[id]) {
        grouped[id] = {
          employee,
          shifts: [],
          totalHours: 0,
        }
      }

      grouped[id].shifts.push(shift)

      const start = timeToMinutes(shift.startTime)

      const end = timeToMinutes(shift.endTime)

      grouped[id].totalHours += (end - start) / 60
    })

    return Object.values(grouped).sort((a, b) => {
      const firstA = Math.min(
        ...a.shifts.map((shift) => timeToMinutes(shift.startTime)),
      )

      const firstB = Math.min(
        ...b.shifts.map((shift) => timeToMinutes(shift.startTime)),
      )

      return firstA - firstB
    })
  }, [dayShifts])

  // ==========================================================
  // SHIFT POSITION
  // ==========================================================

  const getShiftStyle = (shift) => {
    let start = timeToMinutes(shift.startTime)

    let end = timeToMinutes(shift.endTime)

    start = Math.max(start, openMinutes)

    end = Math.min(end, closeMinutes)

    const left = ((start - openMinutes) / totalMinutes) * 100

    const width = ((end - start) / totalMinutes) * 100

    return {
      left: `${left}%`,
      width: `${width}%`,
    }
  }

  // ==========================================================
  // SHIFT LENGTH
  // ==========================================================

  const getShiftHours = (shift) => {
    const start = timeToMinutes(shift.startTime)

    const end = timeToMinutes(shift.endTime)

    return (end - start) / 60
  }

  // ==========================================================
  // INITIALS
  // ==========================================================

  const getInitials = (employee) => {
    const first = employee?.firstName?.[0] || ''

    const last = employee?.lastName?.[0] || ''

    return (first + last).toUpperCase()
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="weekly-timeline-section">
      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="timeline-section-header">
        <div>
          <span className="timeline-eyebrow">VISUAL OVERVIEW</span>

          <h2>Weekly Timeline</h2>

          <p>See who is working and when throughout each day.</p>
        </div>

        <div className="timeline-date-badge">{formatDate(selectedDate)}</div>
      </div>

      {/* ====================================================
          DAY TABS
      ==================================================== */}

      <div className="timeline-day-tabs">
        {days.map((day, index) => {
          const date = addDays(weekStart, index)

          const shifts = schedule.shifts.filter((shift) => shift.date === date)

          return (
            <button
              type="button"
              key={day}
              className={`timeline-day-tab ${
                selectedDay === day ? 'active' : ''
              }`}
              onClick={() => setSelectedDay(day)}
            >
              <span>{day.slice(0, 3)}</span>

              <small>{formatDate(date)}</small>

              <span className="timeline-tab-count">{shifts.length}</span>
            </button>
          )
        })}
      </div>

      {/* ====================================================
          TIMELINE CARD
      ==================================================== */}

      <div className="timeline-card">
        {/* DAY TITLE */}

        <div className="timeline-card-heading">
          <div>
            <h3>{selectedDay}</h3>

            <span>{formatDate(selectedDate)}</span>
          </div>

          <div className="timeline-hours-summary">
            <span>Store Hours</span>

            <strong>
              {formatHour(openHour)}
              {' – '}
              {formatHour(closeHour)}
            </strong>
          </div>
        </div>

        {employeeRows.length === 0 ? (
          <div className="timeline-empty">
            <div className="timeline-empty-icon">—</div>

            <h3>No shifts scheduled</h3>

            <p>There are no employees scheduled for {selectedDay}.</p>
          </div>
        ) : (
          <div className="timeline-scroll">
            <div className="timeline-content">
              {/* ============================================
                  TIME HEADER
              ============================================ */}

              <div className="timeline-time-header">
                <div className="timeline-employee-column timeline-employee-heading">
                  Employee
                </div>

                <div className="timeline-hours">
                  {hourMarkers.map((hour) => {
                    const position =
                      ((hour * 60 - openMinutes) / totalMinutes) * 100

                    return (
                      <div
                        key={hour}
                        className="timeline-hour-label"
                        style={{
                          left: `${position}%`,
                        }}
                      >
                        {formatHour(hour)}
                      </div>
                    )
                  })}
                </div>

                <div className="timeline-total-heading">Hours</div>
              </div>

              {/* ============================================
                  EMPLOYEE ROWS
              ============================================ */}

              <div className="timeline-employee-rows">
                {employeeRows.map(({ employee, shifts, totalHours }) => (
                  <div className="timeline-employee-row" key={employee._id}>
                    {/* EMPLOYEE */}

                    <div className="timeline-employee-info">
                      <div className="timeline-avatar">
                        {getInitials(employee)}
                      </div>

                      <div className="timeline-employee-name">
                        <strong>
                          {employee.firstName} {employee.lastName}
                        </strong>

                        <span>
                          {shifts.length}{' '}
                          {shifts.length === 1 ? 'shift' : 'shifts'}
                        </span>
                      </div>
                    </div>

                    {/* TRACK */}

                    <div className="timeline-track">
                      {/* GRID */}

                      {hourMarkers.map((hour) => {
                        const position =
                          ((hour * 60 - openMinutes) / totalMinutes) * 100

                        return (
                          <span
                            key={hour}
                            className="timeline-grid-line"
                            style={{
                              left: `${position}%`,
                            }}
                          />
                        )
                      })}

                      {/* SHIFT BLOCKS */}

                      {shifts.map((shift) => {
                        const hours = getShiftHours(shift)

                        return (
                          <div
                            key={shift._id}
                            className="timeline-shift-block"
                            style={getShiftStyle(shift)}
                            title={`${employee.firstName} ${employee.lastName}: ${formatTime(
                              shift.startTime,
                            )} – ${formatTime(shift.endTime)}`}
                          >
                            <div className="timeline-shift-main-time">
                              {formatTime(shift.startTime)}

                              <span>–</span>

                              {formatTime(shift.endTime)}
                            </div>

                            <div className="timeline-shift-hours">
                              {hours} hrs
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* TOTAL */}

                    <div className="timeline-row-total">
                      <strong>{totalHours}</strong>

                      <span>hrs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            LEGEND
        ================================================== */}

        {employeeRows.length > 0 && (
          <div className="timeline-footer">
            <div className="timeline-legend">
              <span className="timeline-legend-block" />

              <span>Scheduled shift</span>
            </div>

            <span className="timeline-footer-note">
              {employeeRows.length}{' '}
              {employeeRows.length === 1 ? 'employee' : 'employees'} scheduled
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

export default WeeklyScheduleTimeline
