import { useEffect, useMemo, useState } from 'react'

import api from '../../api/axios'

import WeeklyScheduleTimeline from '../../components/WeeklyScheduleTimeline'
import AdminSidebar from '../../components/AdminSidebar'

function WeeklySchedule() {
  const [weekStart, setWeekStart] = useState('')

  const [schedule, setSchedule] = useState(null)

  const [coverageIssues, setCoverageIssues] = useState([])

  const [employees, setEmployees] = useState([])

  const [loading, setLoading] = useState(false)

  const [generating, setGenerating] = useState(false)

  const [publishing, setPublishing] = useState(false)
  // ==========================================================
  // PUBLISH VALIDATION
  // ==========================================================

  const [showPublishModal, setShowPublishModal] = useState(false)

  const [publishWarnings, setPublishWarnings] = useState([])

  const [publishErrors, setPublishErrors] = useState([])

  const [publishStep, setPublishStep] = useState('confirm')

  const [savingShift, setSavingShift] = useState(false)

  const [message, setMessage] = useState('')

  const [messageType, setMessageType] = useState('')

  // ==========================================================
  // SHIFT EDITOR
  // ==========================================================

  const [showShiftEditor, setShowShiftEditor] = useState(false)

  const [editingShift, setEditingShift] = useState(null)

  const [overrideWarnings, setOverrideWarnings] = useState([])

  const [shiftForm, setShiftForm] = useState({
    employeeId: '',
    date: '',
    startTime: '08:00',
    endTime: '16:00',
    assignedRole: '',
  })

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

  // ==========================================================
  // INITIAL WEEK
  // ==========================================================

  useEffect(() => {
    setWeekStart(getCurrentMonday())

    fetchEmployees()
  }, [])

  // ==========================================================
  // WEEK CHANGE
  // ==========================================================

  useEffect(() => {
    if (!weekStart) {
      return
    }

    fetchSchedule()
  }, [weekStart])

  // ==========================================================
  // FETCH EMPLOYEES
  // ==========================================================

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees')

      const employeeData = Array.isArray(response.data)
        ? response.data
        : response.data.employees || []

      setEmployees(
        employeeData.filter((employee) => employee.status === 'Active'),
      )
    } catch (error) {
      console.error('Unable to load employees:', error)
    }
  }

  // ==========================================================
  // FETCH SCHEDULE
  // ==========================================================
  //
  // IMPORTANT:
  //
  // The backend now returns:
  //
  // {
  //   schedule,
  //   coverageIssues
  // }
  //
  // This means coverage survives refreshes and navigation.
  // ==========================================================

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await api.get(`/schedules/week/${weekStart}`)

      setSchedule(response.data.schedule)

      setCoverageIssues(response.data.coverageIssues || [])
    } catch (error) {
      if (error.response?.status === 404) {
        setSchedule(null)

        setCoverageIssues([])

        return
      }

      console.error(error)

      setMessage(error.response?.data?.message || 'Unable to load schedule.')

      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // GENERATE SCHEDULE
  // ==========================================================

  const generateSchedule = async () => {
    try {
      setGenerating(true)

      setMessage('')

      setCoverageIssues([])

      const response = await api.post('/schedules/generate', {
        weekStart,
      })

      setSchedule(response.data.schedule)

      const issues = response.data.coverageIssues || []

      setCoverageIssues(issues)

      if (issues.length > 0) {
        setMessage(
          'Optimized draft generated. Some periods still need additional coverage.',
        )

        setMessageType('warning')
      } else {
        setMessage('Optimized draft schedule generated with full coverage.')

        setMessageType('success')
      }
    } catch (error) {
      console.error(error)

      setMessage(
        error.response?.data?.message || 'Unable to generate schedule.',
      )

      setMessageType('error')
    } finally {
      setGenerating(false)
    }
  }

  // ==========================================================
  // OPEN PUBLISH REVIEW
  // ==========================================================

  const openPublishReview = () => {
    if (!schedule?._id) {
      return
    }

    setPublishWarnings([])
    setPublishErrors([])
    setPublishStep('confirm')
    setShowPublishModal(true)
  }

  // ==========================================================
  // CLOSE PUBLISH REVIEW
  // ==========================================================

  const closePublishReview = () => {
    if (publishing) {
      return
    }

    setShowPublishModal(false)
    setPublishWarnings([])
    setPublishErrors([])
    setPublishStep('confirm')
  }

  // ==========================================================
  // PUBLISH
  // ==========================================================
  //
  // overrideWarnings = false
  //    Normal publish attempt.
  //
  // overrideWarnings = true
  //    Manager explicitly confirmed coverage shortages.
  //
  // IMPORTANT:
  // This only overrides COVERAGE WARNINGS.
  // Backend hard validation still blocks publishing.
  // ==========================================================

  const publishSchedule = async (overrideWarnings = false) => {
    if (!schedule?._id) {
      return
    }

    try {
      setPublishing(true)

      setMessage('')
      setPublishErrors([])

      const response = await api.patch(`/schedules/${schedule._id}/publish`, {
        overrideWarnings,
      })

      // ====================================================
      // PUBLISHED SUCCESSFULLY
      // ====================================================

      setSchedule(response.data.schedule)

      setCoverageIssues(response.data.coverageIssues || [])

      setPublishWarnings([])
      setPublishErrors([])
      setPublishStep('confirm')
      setShowPublishModal(false)

      setMessage(response.data.message || 'Schedule published successfully.')

      setMessageType('success')
    } catch (error) {
      console.error(error)

      // ====================================================
      // COVERAGE WARNING
      //
      // Backend returns HTTP 409 when the schedule is valid
      // but still contains coverage shortages.
      // ====================================================

      if (
        error.response?.status === 409 &&
        error.response?.data?.requiresOverride
      ) {
        setPublishWarnings(error.response.data.warnings || [])

        setPublishErrors([])

        setPublishStep('warning')

        return
      }

      // ====================================================
      // HARD VALIDATION ERROR
      //
      // These cannot be overridden.
      // ====================================================

      if (
        error.response?.status === 400 &&
        error.response?.data?.validationFailed
      ) {
        setPublishErrors(error.response.data.errors || [])

        setPublishWarnings([])

        setPublishStep('error')

        return
      }

      // ====================================================
      // NORMAL ERROR
      // ====================================================

      setShowPublishModal(false)

      setMessage(error.response?.data?.message || 'Unable to publish schedule.')

      setMessageType('error')
    } finally {
      setPublishing(false)
    }
  }

  // ==========================================================
  // CONFIRM COVERAGE OVERRIDE
  // ==========================================================

  const confirmPublishWithWarnings = async () => {
    await publishSchedule(true)
  }

  // ==========================================================
  // OPEN ADD SHIFT
  // ==========================================================

  const openAddShift = (date) => {
    setEditingShift(null)

    setOverrideWarnings([])

    setShiftForm({
      employeeId: '',
      date,
      startTime: '08:00',
      endTime: '16:00',
      assignedRole: '',
    })

    setShowShiftEditor(true)
  }

  // ==========================================================
  // OPEN EDIT SHIFT
  // ==========================================================

  const openEditShift = (shift) => {
    setEditingShift(shift)

    setOverrideWarnings([])

    setShiftForm({
      employeeId: shift.employeeId?._id || '',

      date: shift.date,

      startTime: shift.startTime,

      endTime: shift.endTime,

      assignedRole: shift.assignedRole || '',
    })

    setShowShiftEditor(true)
  }
  // ==========================================================
  // CLOSE EDITOR
  // ==========================================================

  const closeShiftEditor = () => {
    if (savingShift) {
      return
    }

    setShowShiftEditor(false)

    setEditingShift(null)

    setOverrideWarnings([])
  }

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleShiftChange = (event) => {
    const { name, value } = event.target

    setShiftForm((previous) => ({
      ...previous,

      [name]: value,
    }))

    setOverrideWarnings([])
  }
  // ==========================================================
  // SAVE SHIFT
  // ==========================================================
  // ==========================================================
  // SAVE SHIFT
  // ==========================================================

  const saveShift = async (event, override = false) => {
    if (event) {
      event.preventDefault()
    }

    if (!schedule?._id) {
      return
    }

    if (
      !shiftForm.employeeId ||
      !shiftForm.date ||
      !shiftForm.startTime ||
      !shiftForm.endTime
    ) {
      setMessage('Please complete all required shift fields.')

      setMessageType('error')

      return
    }

    try {
      setSavingShift(true)

      setMessage('')

      // ====================================================
      // BUILD PAYLOAD
      // ====================================================

      const payload = {
        ...shiftForm,
        override,
      }

      let response

      // ====================================================
      // EDIT EXISTING SHIFT
      // ====================================================

      if (editingShift) {
        response = await api.put(
          `/schedules/${schedule._id}/shifts/${editingShift._id}`,
          payload,
        )
      }

      // ====================================================
      // ADD NEW SHIFT
      // ====================================================
      else {
        response = await api.post(`/schedules/${schedule._id}/shifts`, payload)
      }

      // ====================================================
      // UPDATE SCHEDULE
      // ====================================================

      setSchedule(response.data.schedule)

      // ====================================================
      // UPDATE COVERAGE
      // ====================================================

      setCoverageIssues(response.data.coverageIssues || [])

      // ====================================================
      // CLOSE EDITOR
      // ====================================================

      setShowShiftEditor(false)

      setEditingShift(null)

      setOverrideWarnings([])

      // ====================================================
      // SUCCESS MESSAGE
      // ====================================================

      if (response.data.overridden) {
        setMessage(
          editingShift
            ? 'Shift updated successfully with manager override.'
            : 'Shift added successfully with manager override.',
        )
      } else {
        setMessage(
          editingShift
            ? 'Shift updated successfully.'
            : 'Shift added successfully.',
        )
      }

      setMessageType('success')
    } catch (error) {
      console.error(error)

      // ====================================================
      // MANAGER OVERRIDE REQUIRED
      // ====================================================

      if (
        error.response?.status === 409 &&
        error.response?.data?.requiresOverride
      ) {
        setOverrideWarnings(error.response.data.warnings || [])

        return
      }

      // ====================================================
      // NORMAL ERROR
      // ====================================================

      setMessage(error.response?.data?.message || 'Unable to save shift.')

      setMessageType('error')
    } finally {
      setSavingShift(false)
    }
  }

  // ==========================================================
  // CONFIRM MANAGER OVERRIDE
  // ==========================================================

  const confirmShiftOverride = async () => {
    await saveShift(null, true)
  }
  // ==========================================================
  // DELETE SHIFT
  // ==========================================================

  const deleteShift = async (shift) => {
    if (!schedule?._id) {
      return
    }

    const employeeName = `${shift.employeeId?.firstName || ''} ${
      shift.employeeId?.lastName || ''
    }`.trim()

    const confirmed = window.confirm(
      `Delete ${employeeName || 'this employee'}'s shift?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setMessage('')

      const response = await api.delete(
        `/schedules/${schedule._id}/shifts/${shift._id}`,
      )

      // ====================================================
      // UPDATE SCHEDULE
      // ====================================================

      setSchedule(response.data.schedule)

      // ====================================================
      // UPDATE COVERAGE
      //
      // Deleting a shift may create new uncovered periods.
      // ====================================================

      setCoverageIssues(response.data.coverageIssues || [])

      setMessage('Shift deleted successfully.')

      setMessageType('success')
    } catch (error) {
      console.error(error)

      setMessage(error.response?.data?.message || 'Unable to delete shift.')

      setMessageType('error')
    }
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    localStorage.removeItem('token')

    localStorage.removeItem('user')
  }

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
    if (!dateString) {
      return ''
    }

    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',

      day: 'numeric',
    })
  }

  const formatTime = (time) => {
    if (!time) {
      return ''
    }

    const [hour, minute] = time.split(':').map(Number)

    const date = new Date()

    date.setHours(hour)

    date.setMinutes(minute)

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
  // CALCULATE HOURS
  // ==========================================================

  const calculateHours = (startTime, endTime) => {
    const start = timeToMinutes(startTime)

    const end = timeToMinutes(endTime)

    return (end - start) / 60
  }

  // ==========================================================
  // EMPLOYEE HOURS
  // ==========================================================

  const employeeHours = useMemo(() => {
    if (!schedule) {
      return []
    }

    const grouped = {}

    schedule.shifts.forEach((shift) => {
      const employee = shift.employeeId

      if (!employee) {
        return
      }

      if (!grouped[employee._id]) {
        grouped[employee._id] = {
          employee,

          hours: 0,
        }
      }

      grouped[employee._id].hours += calculateHours(
        shift.startTime,
        shift.endTime,
      )
    })

    return Object.values(grouped)
  }, [schedule])

  // ==========================================================
  // SHIFTS FOR DATE
  // ==========================================================

  const getShiftsForDate = (date) => {
    if (!schedule) {
      return []
    }

    return schedule.shifts
      .filter((shift) => shift.date === date)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  }

  // ==========================================================
  // GROUP COVERAGE ISSUES
  // ==========================================================
  //
  // Backend sends 30-minute periods.
  //
  // Example:
  //
  // 18:00 - 18:30 needs 1
  // 18:30 - 19:00 needs 1
  // 19:00 - 19:30 needs 1
  //
  // Frontend combines them into:
  //
  // 18:00 - 19:30 needs 1
  // ==========================================================

  const getGroupedCoverageForDate = (date) => {
    const issues = coverageIssues
      .filter((issue) => issue.date === date)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

    if (issues.length === 0) {
      return []
    }

    const grouped = []

    issues.forEach((issue) => {
      const employeesNeeded = Math.max(0, issue.required - issue.scheduled)

      const last = grouped[grouped.length - 1]

      const isConsecutive = last && last.endTime === issue.startTime

      const sameNeed = last && last.employeesNeeded === employeesNeeded

      if (isConsecutive && sameNeed) {
        last.endTime = issue.endTime
      } else {
        grouped.push({
          startTime: issue.startTime,

          endTime: issue.endTime,

          employeesNeeded,
        })
      }
    })

    return grouped
  }

  // ==========================================================
  // TOTAL COVERAGE PERIODS
  // ==========================================================

  const totalCoveragePeriods = useMemo(() => {
    if (!weekStart || coverageIssues.length === 0) {
      return 0
    }

    let total = 0

    days.forEach((dayName, index) => {
      const date = addDays(weekStart, index)

      total += getGroupedCoverageForDate(date).length
    })

    return total
  }, [coverageIssues, weekStart])

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="admin-layout">
      {/* ====================================================
          SIDEBAR
      ==================================================== */}

      <AdminSidebar />

      {/* ====================================================
          MAIN
      ==================================================== */}

      <main className="schedule-main">
        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="schedule-page-header">
          <div>
            <h1>Weekly Schedule</h1>

            <p>Generate, edit, review and publish employee schedules.</p>
          </div>

          {schedule && (
            <span
              className={`schedule-status ${schedule.status.toLowerCase()}`}
            >
              {schedule.status}
            </span>
          )}
        </div>

        {/* ==================================================
            MESSAGE
        ================================================== */}

        {message && (
          <div className={`schedule-message ${messageType}`}>{message}</div>
        )}

        {/* ==================================================
            CONTROLS
        ================================================== */}

        <div className="schedule-controls">
          <div className="week-selector">
            <label>Week Starting</label>

            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </div>

          <div className="schedule-control-buttons">
            <button
              className="generate-schedule-button"
              onClick={generateSchedule}
              disabled={generating || !weekStart}
            >
              {generating
                ? 'Generating...'
                : schedule
                  ? 'Regenerate Schedule'
                  : 'Generate Schedule'}
            </button>

            {schedule && schedule.status === 'Draft' && (
              <button
                className="publish-schedule-button"
                onClick={openPublishReview}
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : 'Publish Schedule'}
              </button>
            )}
          </div>
        </div>

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && <div className="schedule-empty">Loading schedule...</div>}

        {/* ==================================================
            NO SCHEDULE
        ================================================== */}

        {!loading && !schedule && (
          <div className="schedule-empty">
            <h2>No schedule yet</h2>

            <p>
              Generate a draft schedule using approved employee availability and
              time-off requests.
            </p>
          </div>
        )}

        {/* ==================================================
            SCHEDULE
        ================================================== */}

        {!loading && schedule && (
          <>
            {/* ============================================
                  SUMMARY
              ============================================ */}

            <div className="schedule-summary">
              <div className="schedule-summary-card">
                <span>Total Shifts</span>

                <strong>{schedule.shifts.length}</strong>
              </div>

              <div className="schedule-summary-card">
                <span>Employees Scheduled</span>

                <strong>{employeeHours.length}</strong>
              </div>

              <div
                className={`schedule-summary-card coverage-summary-card ${
                  totalCoveragePeriods > 0 ? 'needs-coverage' : 'full-coverage'
                }`}
              >
                <span>Coverage</span>

                <strong>
                  {totalCoveragePeriods > 0
                    ? `⚠ ${totalCoveragePeriods} ${
                        totalCoveragePeriods === 1 ? 'period' : 'periods'
                      }`
                    : '✓ Full'}
                </strong>
              </div>

              <div className="schedule-summary-card">
                <span>Status</span>

                <strong>{schedule.status}</strong>
              </div>
            </div>

            {/* ============================================
                  VISUAL WEEKLY TIMELINE
              ============================================ */}

            <WeeklyScheduleTimeline schedule={schedule} weekStart={weekStart} />

            {/* ============================================
                  WEEK
              ============================================ */}

            <div className="schedule-week">
              {days.map((dayName, index) => {
                const date = addDays(weekStart, index)

                const dayShifts = getShiftsForDate(date)

                const groupedCoverage = getGroupedCoverageForDate(date)

                const hasCoverageIssue = groupedCoverage.length > 0

                return (
                  <div
                    className={`schedule-day ${
                      hasCoverageIssue
                        ? 'has-coverage-issue'
                        : 'fully-covered-day'
                    }`}
                    key={dayName}
                  >
                    {/* ==================================
                            DAY HEADER
                        ================================== */}

                    <div className="schedule-day-header">
                      <div>
                        <h3>{dayName}</h3>

                        <span>{formatDate(date)}</span>
                      </div>

                      <div className="schedule-day-header-actions">
                        <span className="shift-count">
                          {dayShifts.length} shifts
                        </span>

                        {schedule.status === 'Draft' && (
                          <button
                            type="button"
                            className="add-shift-button"
                            onClick={() => openAddShift(date)}
                          >
                            + Add Shift
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ==================================
                            COVERAGE
                        ================================== */}

                    <div
                      className={`day-coverage-status ${
                        hasCoverageIssue ? 'coverage-needed' : 'coverage-good'
                      }`}
                    >
                      {hasCoverageIssue ? (
                        <>
                          <div className="day-coverage-title">
                            <span className="coverage-status-icon">!</span>

                            <strong>Coverage Needed</strong>
                          </div>

                          <div className="day-coverage-periods">
                            {groupedCoverage.map((issue, issueIndex) => (
                              <div
                                className="day-coverage-period"
                                key={`${issue.startTime}-${issue.endTime}-${issueIndex}`}
                              >
                                <span className="coverage-period-time">
                                  {formatTime(issue.startTime)}

                                  {' – '}

                                  {formatTime(issue.endTime)}
                                </span>

                                <span className="coverage-period-need">
                                  Needs <strong>{issue.employeesNeeded}</strong>{' '}
                                  {issue.employeesNeeded === 1
                                    ? 'employee'
                                    : 'employees'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="day-coverage-title">
                          <span className="coverage-check">✓</span>

                          <strong>Fully Covered</strong>
                        </div>
                      )}
                    </div>

                    {/* ==================================
                            SHIFTS
                        ================================== */}

                    <div className="schedule-day-shifts">
                      {dayShifts.length === 0 ? (
                        <p className="no-shifts">No shifts</p>
                      ) : (
                        dayShifts.map((shift) => (
                          <div className="schedule-shift" key={shift._id}>
                            {/* ========================
                                      EMPLOYEE
                                  ======================== */}

                            <div className="schedule-shift-employee">
                              <div className="schedule-avatar">
                                {shift.employeeId?.firstName?.[0]}

                                {shift.employeeId?.lastName?.[0]}
                              </div>

                              <div>
                                <strong>
                                  {shift.employeeId?.firstName}{' '}
                                  {shift.employeeId?.lastName}
                                </strong>

                                <span>
                                  {calculateHours(
                                    shift.startTime,
                                    shift.endTime,
                                  )}{' '}
                                  hrs
                                </span>
                              </div>
                            </div>

                            {/* ========================
                                      TIME
                                  ======================== */}

                            <div className="schedule-shift-time">
                              {formatTime(shift.startTime)}

                              {' – '}

                              {formatTime(shift.endTime)}
                            </div>

                            {/* ========================
                                      ROLE
                                  ======================== */}

                            {shift.assignedRole && (
                              <span className="schedule-role">
                                {shift.assignedRole}
                              </span>
                            )}

                            {/* ========================
                                      ACTIONS
                                  ======================== */}

                            {schedule.status === 'Draft' && (
                              <div className="schedule-shift-actions">
                                <button
                                  type="button"
                                  className="edit-shift-button"
                                  onClick={() => openEditShift(shift)}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="delete-shift-button"
                                  onClick={() => deleteShift(shift)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ============================================
                  EMPLOYEE HOURS
              ============================================ */}

            <div className="employee-hours-section">
              <div className="employee-hours-header">
                <div>
                  <h2>Employee Hours</h2>

                  <p>Scheduled hours for this week.</p>
                </div>
              </div>

              <div className="employee-hours-list">
                {employeeHours.length === 0 ? (
                  <p className="no-shifts">No employees have been scheduled.</p>
                ) : (
                  employeeHours.map(({ employee, hours }) => (
                    <div className="employee-hours-row" key={employee._id}>
                      <div>
                        <strong>
                          {employee.firstName} {employee.lastName}
                        </strong>

                        <span>{employee.email}</span>
                      </div>

                      <div className="hours-number">{hours} / 40 hrs</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ====================================================
          ADD / EDIT SHIFT MODAL
      ==================================================== */}

      {showShiftEditor && (
        <div className="shift-modal-overlay" onMouseDown={closeShiftEditor}>
          <div
            className="shift-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* ==============================================
                MODAL HEADER
            ============================================== */}

            <div className="shift-modal-header">
              <div>
                <h2>{editingShift ? 'Edit Shift' : 'Add Shift'}</h2>

                <p>{formatDate(shiftForm.date)}</p>
              </div>

              <button
                type="button"
                className="shift-modal-close"
                onClick={closeShiftEditor}
              >
                ×
              </button>
            </div>

            {/* ==============================================
                FORM
            ============================================== */}

            <form className="shift-editor-form" onSubmit={saveShift}>
              {/* ============================================
                  EMPLOYEE
              ============================================ */}

              <div className="shift-form-field">
                <label>Employee</label>

                <select
                  name="employeeId"
                  value={shiftForm.employeeId}
                  onChange={handleShiftChange}
                  required
                >
                  <option value="">Select employee</option>

                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.firstName} {employee.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* ============================================
                  DATE
              ============================================ */}

              <div className="shift-form-field">
                <label>Date</label>

                <input
                  type="date"
                  name="date"
                  value={shiftForm.date}
                  onChange={handleShiftChange}
                  min={weekStart}
                  max={addDays(weekStart, 6)}
                  required
                />
              </div>

              {/* ============================================
                  TIMES
              ============================================ */}

              <div className="shift-form-time-row">
                <div className="shift-form-field">
                  <label>Start Time</label>

                  <input
                    type="time"
                    name="startTime"
                    value={shiftForm.startTime}
                    onChange={handleShiftChange}
                    step="1800"
                    required
                  />
                </div>

                <div className="shift-form-field">
                  <label>End Time</label>

                  <input
                    type="time"
                    name="endTime"
                    value={shiftForm.endTime}
                    onChange={handleShiftChange}
                    step="1800"
                    required
                  />
                </div>
              </div>

              {/* ============================================
                  OPTIONAL ROLE
              ============================================ */}

              <div className="shift-form-field">
                <label>
                  Station
                  <span> (optional)</span>
                </label>

                <select
                  name="assignedRole"
                  value={shiftForm.assignedRole}
                  onChange={handleShiftChange}
                >
                  <option value="">No station assigned</option>

                  <option value="Cashier">Cashier</option>

                  <option value="Espresso Station">Espresso Station</option>

                  <option value="Yemeni Station">Yemeni Station</option>

                  <option value="Pickup Station">Pickup Station</option>
                </select>
              </div>

              {/* ============================================
                  HOURS PREVIEW
              ============================================ */}

              {shiftForm.startTime &&
                shiftForm.endTime &&
                timeToMinutes(shiftForm.endTime) >
                  timeToMinutes(shiftForm.startTime) && (
                  <div className="shift-duration-preview">
                    Shift length
                    <strong>
                      {calculateHours(shiftForm.startTime, shiftForm.endTime)}{' '}
                      hours
                    </strong>
                  </div>
                )}
              {/* ============================================
    MANAGER OVERRIDE WARNING
============================================ */}

              {overrideWarnings.length > 0 && (
                <div className="shift-override-warning">
                  <div className="shift-override-warning-header">
                    <span className="shift-override-icon">⚠</span>

                    <div>
                      <h3>Manager Confirmation Required</h3>

                      <p>
                        This shift conflicts with the employee's availability or
                        approved time off.
                      </p>
                    </div>
                  </div>

                  <div className="shift-override-warning-list">
                    {overrideWarnings.map((warning, index) => (
                      <div
                        className="shift-override-warning-item"
                        key={`${warning.type || 'warning'}-${index}`}
                      >
                        <strong>
                          {warning.title || 'Scheduling Conflict'}
                        </strong>

                        <span>
                          {warning.message ||
                            'This shift has a scheduling conflict.'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="shift-override-warning-question">
                    Do you want to schedule this employee anyway?
                  </p>

                  <div className="shift-override-warning-actions">
                    <button
                      type="button"
                      className="shift-override-cancel"
                      onClick={() => setOverrideWarnings([])}
                      disabled={savingShift}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="shift-override-confirm"
                      onClick={confirmShiftOverride}
                      disabled={savingShift}
                    >
                      {savingShift ? 'Saving...' : 'Schedule Anyway'}
                    </button>
                  </div>
                </div>
              )}
              {/* ============================================
                  ACTIONS
              ============================================ */}

              <div className="shift-modal-actions">
                <button
                  type="button"
                  className="shift-cancel-button"
                  onClick={closeShiftEditor}
                  disabled={savingShift}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="shift-save-button"
                  disabled={savingShift}
                >
                  {savingShift
                    ? 'Saving...'
                    : editingShift
                      ? 'Save Changes'
                      : 'Add Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ====================================================
    PUBLISH REVIEW MODAL
==================================================== */}

      {showPublishModal && (
        <div
          className="publish-review-overlay"
          onMouseDown={closePublishReview}
        >
          <div
            className="publish-review-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* ==============================================
          CONFIRMATION
      ============================================== */}

            {publishStep === 'confirm' && (
              <>
                <div className="publish-review-header">
                  <div className="publish-review-icon">✓</div>

                  <div>
                    <span>FINAL REVIEW</span>

                    <h2>Publish Schedule?</h2>

                    <p>
                      The schedule will be validated before employees can see
                      it.
                    </p>
                  </div>
                </div>

                <div className="publish-review-summary">
                  <div>
                    <span>Week</span>

                    <strong>
                      {formatDate(weekStart)} –{' '}
                      {formatDate(addDays(weekStart, 6))}
                    </strong>
                  </div>

                  <div>
                    <span>Total Shifts</span>

                    <strong>{schedule?.shifts?.length || 0}</strong>
                  </div>

                  <div>
                    <span>Employees</span>

                    <strong>{employeeHours.length}</strong>
                  </div>

                  <div>
                    <span>Coverage</span>

                    <strong
                      className={
                        totalCoveragePeriods > 0
                          ? 'publish-coverage-warning'
                          : 'publish-coverage-good'
                      }
                    >
                      {totalCoveragePeriods > 0
                        ? `${totalCoveragePeriods} ${
                            totalCoveragePeriods === 1 ? 'period' : 'periods'
                          } need coverage`
                        : 'Full Coverage'}
                    </strong>
                  </div>
                </div>

                {totalCoveragePeriods > 0 && (
                  <div className="publish-review-notice">
                    <span>!</span>

                    <p>
                      This draft currently has coverage shortages. Publishing
                      will run the final server validation before continuing.
                    </p>
                  </div>
                )}

                <div className="publish-review-actions">
                  <button
                    type="button"
                    className="publish-review-cancel"
                    onClick={closePublishReview}
                    disabled={publishing}
                  >
                    Go Back
                  </button>

                  <button
                    type="button"
                    className="publish-review-confirm"
                    onClick={() => publishSchedule(false)}
                    disabled={publishing}
                  >
                    {publishing ? 'Validating...' : 'Validate & Publish'}
                  </button>
                </div>
              </>
            )}

            {/* ==============================================
          COVERAGE WARNINGS
      ============================================== */}

            {publishStep === 'warning' && (
              <>
                <div className="publish-review-header warning">
                  <div className="publish-review-icon warning">!</div>

                  <div>
                    <span>COVERAGE WARNING</span>

                    <h2>Coverage Shortages Found</h2>

                    <p>
                      The schedule passed the hard validation rules, but some
                      periods do not have the required two employees.
                    </p>
                  </div>
                </div>

                <div className="publish-warning-summary">
                  <strong>{publishWarnings.length}</strong>

                  <div>
                    <span>
                      30-minute coverage{' '}
                      {publishWarnings.length === 1 ? 'shortage' : 'shortages'}
                    </span>

                    <p>
                      Review these periods before deciding whether to publish.
                    </p>
                  </div>
                </div>

                <div className="publish-warning-list">
                  {publishWarnings.map((warning, index) => (
                    <div
                      className="publish-warning-item"
                      key={`${warning.date || 'coverage'}-${
                        warning.startTime || index
                      }-${index}`}
                    >
                      <div className="publish-warning-item-top">
                        <strong>{warning.day || 'Coverage Shortage'}</strong>

                        <span>
                          Needs {warning.missing || 1}{' '}
                          {warning.missing === 1 ? 'employee' : 'employees'}
                        </span>
                      </div>

                      <p>
                        {warning.startTime && warning.endTime
                          ? `${formatTime(warning.startTime)} – ${formatTime(
                              warning.endTime,
                            )}`
                          : warning.message}
                      </p>

                      {warning.scheduled !== undefined &&
                        warning.required !== undefined && (
                          <small>
                            {warning.scheduled} of {warning.required} employees
                            scheduled
                          </small>
                        )}
                    </div>
                  ))}
                </div>

                <div className="publish-warning-question">
                  <strong>Publish anyway?</strong>

                  <p>
                    Employees will be able to see this schedule even though
                    these periods are understaffed.
                  </p>
                </div>

                <div className="publish-review-actions">
                  <button
                    type="button"
                    className="publish-review-cancel"
                    onClick={closePublishReview}
                    disabled={publishing}
                  >
                    Go Back & Fix
                  </button>

                  <button
                    type="button"
                    className="publish-anyway-button"
                    onClick={confirmPublishWithWarnings}
                    disabled={publishing}
                  >
                    {publishing ? 'Publishing...' : 'Publish Anyway'}
                  </button>
                </div>
              </>
            )}

            {/* ==============================================
          HARD VALIDATION ERRORS
      ============================================== */}

            {publishStep === 'error' && (
              <>
                <div className="publish-review-header error">
                  <div className="publish-review-icon error">×</div>

                  <div>
                    <span>VALIDATION FAILED</span>

                    <h2>Schedule Cannot Be Published</h2>

                    <p>Fix the scheduling problems below before publishing.</p>
                  </div>
                </div>

                <div className="publish-error-summary">
                  <strong>{publishErrors.length}</strong>

                  <div>
                    <span>
                      {publishErrors.length === 1
                        ? 'problem needs'
                        : 'problems need'}{' '}
                      to be fixed
                    </span>

                    <p>These rules cannot be overridden.</p>
                  </div>
                </div>

                <div className="publish-error-list">
                  {publishErrors.map((errorItem, index) => (
                    <div
                      className="publish-error-item"
                      key={`publish-error-${index}`}
                    >
                      <strong>{errorItem.title || 'Scheduling Problem'}</strong>

                      <p>
                        {errorItem.message ||
                          'This schedule contains an invalid shift.'}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="publish-review-actions single">
                  <button
                    type="button"
                    className="publish-review-fix"
                    onClick={closePublishReview}
                    disabled={publishing}
                  >
                    Go Back & Fix Schedule
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default WeeklySchedule
