import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import EmployeeSidebar from '../../components/EmployeeSidebar'

const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const createEmptyAvailability = () =>
  days.map((day) => ({
    day,
    available: false,
    startTime: '',
    endTime: '',
  }))

function MyAvailability() {
  const [weekStart, setWeekStart] = useState(getCurrentMonday())

  const [availability, setAvailability] = useState(createEmptyAvailability())

  const [previousRecords, setPreviousRecords] = useState([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ==========================================================
  // DATE HELPERS
  // ==========================================================

  function formatDateForApi(date) {
    const year = date.getFullYear()

    const month = String(date.getMonth() + 1).padStart(2, '0')

    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  function createLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day)
  }

  function getCurrentMonday() {
    const today = new Date()

    today.setHours(0, 0, 0, 0)

    const day = today.getDay()

    const difference = day === 0 ? -6 : 1 - day

    const monday = new Date(today)

    monday.setDate(today.getDate() + difference)

    monday.setHours(0, 0, 0, 0)

    return formatDateForApi(monday)
  }

  function addDays(dateString, amount) {
    const date = createLocalDate(dateString)

    date.setDate(date.getDate() + amount)

    return formatDateForApi(date)
  }

  function formatDate(dateString, options = {}) {
    if (!dateString) {
      return ''
    }

    return createLocalDate(dateString).toLocaleDateString('en-US', options)
  }

  // ==========================================================
  // IS PAST WEEK
  //
  // Previous weeks become read-only as soon as the next
  // Monday begins.
  // ==========================================================

  const isPastWeek = useMemo(() => {
    const selectedMonday = createLocalDate(weekStart)

    const currentMonday = createLocalDate(getCurrentMonday())

    return selectedMonday < currentMonday
  }, [weekStart])

  // ==========================================================
  // LOAD AVAILABILITY
  // ==========================================================

  useEffect(() => {
    fetchMyAvailability()
  }, [])

  const fetchMyAvailability = async () => {
    try {
      setLoading(true)

      const response = await api.get('/availability/me')

      const records = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.availability)
          ? response.data.availability
          : Array.isArray(response.data?.records)
            ? response.data.records
            : []

      setPreviousRecords(records)

      const currentWeekRecord = records.find(
        (record) => record.weekStart === getCurrentMonday(),
      )

      if (currentWeekRecord) {
        setAvailability(currentWeekRecord.availability)
      } else {
        setAvailability(createEmptyAvailability())
      }
    } catch (error) {
      console.error(error)

      setMessageType('error')

      setMessage(
        error.response?.data?.message || 'Unable to load your availability.',
      )
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // SELECTED RECORD
  // ==========================================================

  const selectedRecord = previousRecords.find(
    (record) => record.weekStart === weekStart,
  )

  // ==========================================================
  // LOAD SELECTED WEEK
  // ==========================================================

  const loadWeek = (selectedWeek, records = previousRecords) => {
    setWeekStart(selectedWeek)

    setMessage('')
    setMessageType('')

    const existingRecord = records.find(
      (record) => record.weekStart === selectedWeek,
    )

    if (existingRecord) {
      setAvailability(existingRecord.availability)
    } else {
      setAvailability(createEmptyAvailability())
    }
  }

  // ==========================================================
  // WEEK NAVIGATION
  // ==========================================================

  const previousWeek = () => {
    loadWeek(addDays(weekStart, -7))
  }

  const nextWeek = () => {
    loadWeek(addDays(weekStart, 7))
  }

  const currentWeek = () => {
    loadWeek(getCurrentMonday())
  }

  // ==========================================================
  // TOGGLE DAY
  // ==========================================================

  const toggleDay = (index) => {
    if (isPastWeek) {
      return
    }

    setMessage('')
    setMessageType('')

    setAvailability((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        const newAvailable = !item.available

        return {
          ...item,

          available: newAvailable,

          startTime: newAvailable ? item.startTime : '',

          endTime: newAvailable ? item.endTime : '',
        }
      }),
    )
  }

  // ==========================================================
  // CHANGE TIME
  // ==========================================================

  const handleTimeChange = (index, field, value) => {
    if (isPastWeek) {
      return
    }

    setMessage('')
    setMessageType('')

    setAvailability((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
  }

  // ==========================================================
  // COPY TIME TO AVAILABLE DAYS
  // ==========================================================

  const copyTimeToAvailableDays = (sourceIndex) => {
    if (isPastWeek) {
      return
    }

    const source = availability[sourceIndex]

    if (!source.available || !source.startTime || !source.endTime) {
      setMessageType('error')

      setMessage('Enter a start and end time first.')

      return
    }

    setAvailability((current) =>
      current.map((item) =>
        item.available
          ? {
              ...item,

              startTime: source.startTime,

              endTime: source.endTime,
            }
          : item,
      ),
    )

    setMessageType('success')

    setMessage('Time copied to all available days.')
  }

  // ==========================================================
  // SAVE / REMOVE
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMessage('')
    setMessageType('')

    // --------------------------------------------------------
    // PAST WEEK
    // --------------------------------------------------------

    if (isPastWeek) {
      setMessageType('error')

      setMessage('Availability for a completed week can no longer be changed.')

      return
    }

    if (!weekStart) {
      setMessageType('error')

      setMessage('Please select a week first.')

      return
    }

    const availableDays = availability.filter((day) => day.available)

    // --------------------------------------------------------
    // VALIDATE AVAILABLE DAYS
    //
    // Zero available days is allowed now.
    // The backend interprets that as deleting this week.
    // --------------------------------------------------------

    for (const day of availability) {
      if (day.available && (!day.startTime || !day.endTime)) {
        setMessageType('error')

        setMessage(`Please enter a start and end time for ${day.day}.`)

        return
      }

      if (day.available && day.startTime >= day.endTime) {
        setMessageType('error')

        setMessage(`${day.day} end time must be after start time.`)

        return
      }
    }

    try {
      setSaving(true)

      const response = await api.post('/availability/me', {
        weekStart,
        availability,
      })

      // ======================================================
      // ALL DAYS UNMARKED
      //
      // Backend deleted the MongoDB record.
      // Remove it from React state immediately as well.
      // ======================================================

      if (response.data?.deleted || availableDays.length === 0) {
        setPreviousRecords((current) =>
          current.filter((record) => record.weekStart !== weekStart),
        )

        setAvailability(createEmptyAvailability())

        setMessageType('success')

        setMessage(
          selectedRecord
            ? 'Availability removed successfully.'
            : 'No availability is set for this week.',
        )

        return
      }

      // ======================================================
      // NORMAL SAVE / UPDATE
      // ======================================================

      const savedRecord = response.data

      setPreviousRecords((current) => {
        const exists = current.some((record) => record.weekStart === weekStart)

        if (exists) {
          return current.map((record) =>
            record.weekStart === weekStart ? savedRecord : record,
          )
        }

        return [savedRecord, ...current]
      })

      setAvailability(savedRecord.availability)

      setMessageType('success')

      setMessage(
        selectedRecord
          ? 'Availability updated successfully.'
          : 'Availability saved successfully.',
      )
    } catch (error) {
      console.error(error)

      setMessageType('error')

      setMessage(
        error.response?.data?.message || 'Unable to save availability.',
      )
    } finally {
      setSaving(false)
    }
  }

  // ==========================================================
  // WEEK INFORMATION
  // ==========================================================

  const weekEnd = addDays(weekStart, 6)

  const weekRange = `${formatDate(weekStart, {
    month: 'long',
    day: 'numeric',
  })} - ${formatDate(weekEnd, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`

  const availableDaysCount = availability.filter((day) => day.available).length

  // ==========================================================
  // HISTORY
  // ==========================================================

  const sortedRecords = useMemo(
    () =>
      [...previousRecords].sort((a, b) =>
        b.weekStart.localeCompare(a.weekStart),
      ),
    [previousRecords],
  )

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="employee-my-availability-layout">
      {/* ====================================================
          SHARED SIDEBAR
      ==================================================== */}

      <EmployeeSidebar />

      {/* ====================================================
          MAIN
      ==================================================== */}

      <main className="employee-my-availability-main">
        {/* ==================================================
            HEADER
        ================================================== */}

        <section className="my-availability-header">
          <div>
            <span className="my-availability-eyebrow">EMPLOYEE PORTAL</span>

            <h1>My Availability</h1>

            <p>Set the days and times you're available to work.</p>
          </div>

          <div className="my-availability-week-display">
            <span>SELECTED WEEK</span>

            <strong>{weekRange}</strong>
          </div>
        </section>

        {/* ==================================================
            WEEK NAVIGATION
        ================================================== */}

        <section className="my-availability-week-controls">
          <button type="button" onClick={previousWeek}>
            ← Previous Week
          </button>

          <button type="button" className="current-week" onClick={currentWeek}>
            Current Week
          </button>

          <button type="button" onClick={nextWeek}>
            Next Week →
          </button>
        </section>

        {/* ==================================================
            MESSAGE
        ================================================== */}

        {message && (
          <div className={`my-availability-message ${messageType}`}>
            {message}
          </div>
        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading ? (
          <section className="my-availability-loading">
            <div className="my-availability-loader" />

            <p>Loading your availability...</p>
          </section>
        ) : (
          <>
            {/* ==============================================
                READ ONLY NOTICE
            ============================================== */}

            {isPastWeek && (
              <div className="my-availability-message">
                <strong>Past week — Read Only</strong>

                <div>
                  This week has ended. You can review the availability you
                  submitted, but you can no longer make changes.
                </div>
              </div>
            )}

            {/* ==============================================
                SUMMARY
            ============================================== */}

            <section className="my-availability-summary">
              <article>
                <span>AVAILABLE DAYS</span>

                <strong>{availableDaysCount}</strong>

                <p>out of 7 days</p>
              </article>

              <article>
                <span>AVAILABILITY</span>

                <strong
                  className={
                    selectedRecord
                      ? 'availability-summary-status approved'
                      : 'availability-summary-status'
                  }
                >
                  {selectedRecord
                    ? isPastWeek
                      ? 'Archived'
                      : 'Saved'
                    : isPastWeek
                      ? 'No Record'
                      : 'Not Set'}
                </strong>

                <p>
                  {isPastWeek
                    ? 'Read only'
                    : selectedRecord
                      ? 'Used for scheduling'
                      : 'Selected week'}
                </p>
              </article>

              <article>
                <span>WEEK</span>

                <strong className="availability-summary-week">
                  {formatDate(weekStart, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </strong>

                <p>
                  through{' '}
                  {formatDate(weekEnd, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </article>
            </section>

            {/* ==============================================
                FORM
            ============================================== */}

            <form onSubmit={handleSubmit} className="my-availability-card">
              <div className="my-availability-card-header">
                <div>
                  <span>WEEKLY AVAILABILITY</span>

                  <h2>
                    {isPastWeek ? 'Availability Record' : 'Set Your Hours'}
                  </h2>

                  <p>
                    {isPastWeek
                      ? 'This week has ended. Your saved availability is now read only.'
                      : 'Mark the days you can work and enter your available time range.'}
                  </p>
                </div>

                {isPastWeek ? (
                  <span className="my-availability-status">Read Only</span>
                ) : selectedRecord ? (
                  <span className="my-availability-status approved">
                    ✓ Saved
                  </span>
                ) : null}
              </div>

              {/* ============================================
                  DAYS
              ============================================ */}

              <div className="my-availability-days">
                {availability.map((day, index) => (
                  <article
                    key={day.day}
                    className={
                      day.available
                        ? 'my-availability-day available'
                        : 'my-availability-day'
                    }
                  >
                    <div className="my-availability-day-heading">
                      <div>
                        <strong>{day.day}</strong>

                        <span>
                          {formatDate(addDays(weekStart, index), {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <label className="my-availability-toggle">
                        <input
                          type="checkbox"
                          checked={day.available}
                          disabled={isPastWeek}
                          onChange={() => toggleDay(index)}
                        />

                        <span className="my-availability-toggle-track">
                          <i />
                        </span>
                      </label>
                    </div>

                    <div className="my-availability-state">
                      <span className={day.available ? 'available' : ''}>
                        {day.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>

                    {day.available ? (
                      <div className="my-availability-times">
                        <div>
                          <label>FROM</label>

                          <input
                            type="time"
                            value={day.startTime}
                            disabled={isPastWeek}
                            onChange={(e) =>
                              handleTimeChange(
                                index,
                                'startTime',
                                e.target.value,
                              )
                            }
                            required
                          />
                        </div>

                        <span className="my-availability-time-arrow">→</span>

                        <div>
                          <label>UNTIL</label>

                          <input
                            type="time"
                            value={day.endTime}
                            disabled={isPastWeek}
                            onChange={(e) =>
                              handleTimeChange(index, 'endTime', e.target.value)
                            }
                            required
                          />
                        </div>

                        {!isPastWeek && day.startTime && day.endTime && (
                          <button
                            type="button"
                            className="copy-availability-time"
                            onClick={() => copyTimeToAvailableDays(index)}
                          >
                            Apply this time to all available days
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="my-availability-unavailable">
                        <span>Day Off</span>

                        <p>You will not be scheduled on this day.</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* ============================================
                  SAVE / REMOVE
              ============================================ */}

              {!isPastWeek && (
                <div className="my-availability-actions">
                  <div>
                    {selectedRecord && availableDaysCount === 0 ? (
                      <>
                        <strong>Remove this availability?</strong>

                        <p>
                          All days are unmarked. Saving will remove this week
                          from your availability history.
                        </p>
                      </>
                    ) : (
                      <>
                        <strong>Ready to save?</strong>

                        <p>
                          Your saved availability will automatically be used
                          when your schedule is generated.
                        </p>
                      </>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      saving || (!selectedRecord && availableDaysCount === 0)
                    }
                  >
                    {saving
                      ? 'Saving...'
                      : selectedRecord && availableDaysCount === 0
                        ? 'Remove Availability'
                        : selectedRecord
                          ? 'Update Availability'
                          : 'Save Availability'}
                  </button>
                </div>
              )}
            </form>

            {/* ==============================================
                HISTORY
            ============================================== */}

            <section className="my-availability-history">
              <div className="my-availability-history-heading">
                <div>
                  <span>AVAILABILITY HISTORY</span>

                  <h2>Saved Weeks</h2>

                  <p>
                    Review availability you've saved for other weeks. Past weeks
                    are read only.
                  </p>
                </div>
              </div>

              {sortedRecords.length === 0 ? (
                <div className="my-availability-history-empty">
                  <h3>No availability saved yet</h3>

                  <p>Your saved weekly availability will appear here.</p>
                </div>
              ) : (
                <div className="my-availability-history-list">
                  {sortedRecords.map((record) => {
                    const recordEnd = addDays(record.weekStart, 6)

                    const daysAvailable =
                      record.availability?.filter((item) => item.available)
                        .length || 0

                    const recordIsPast =
                      createLocalDate(record.weekStart) <
                      createLocalDate(getCurrentMonday())

                    return (
                      <button
                        type="button"
                        key={record._id || record.weekStart}
                        className="my-availability-history-item"
                        onClick={() => loadWeek(record.weekStart)}
                      >
                        <div className="availability-history-date">
                          <span>WEEK OF</span>

                          <strong>
                            {formatDate(record.weekStart, {
                              month: 'short',
                              day: 'numeric',
                            })}

                            {' - '}

                            {formatDate(recordEnd, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </strong>
                        </div>

                        <div className="availability-history-days">
                          <span>AVAILABLE</span>

                          <strong>{daysAvailable} / 7 days</strong>
                        </div>

                        <span
                          className={
                            recordIsPast
                              ? 'my-availability-status'
                              : 'my-availability-status approved'
                          }
                        >
                          {recordIsPast ? 'Read Only' : '✓ Saved'}
                        </span>
                      </button>
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

export default MyAvailability
