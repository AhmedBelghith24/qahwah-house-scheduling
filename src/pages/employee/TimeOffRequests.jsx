import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import EmployeeSidebar from '../../components/EmployeeSidebar'

function TimeOffRequests() {
  const [date, setDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')

  const [requests, setRequests] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  // =======================================================
  // LOAD REQUESTS
  // =======================================================

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)

      const response = await api.get('/time-off-requests/me')

      const data = response.data

      const records = Array.isArray(data)
        ? data
        : Array.isArray(data?.requests)
          ? data.requests
          : Array.isArray(data?.timeOffRequests)
            ? data.timeOffRequests
            : []

      setRequests(records)
    } catch (error) {
      console.error(error)

      setMessage(
        error.response?.data?.message ||
          'Unable to load your time-off requests.',
      )

      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  // =======================================================
  // DATE HELPERS
  // =======================================================

  function createLocalDate(dateString) {
    if (!dateString) return null

    const [year, month, day] = dateString.split('-').map(Number)

    return new Date(year, month - 1, day)
  }

  function formatDate(dateString) {
    const value = createLocalDate(dateString)

    if (!value) return ''

    return value.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

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
  // SUBMIT
  // =======================================================

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMessage('')
    setMessageType('')

    if (!date) {
      setMessage('Please select the date you need off.')

      setMessageType('error')

      return
    }

    if (!allDay) {
      if (!startTime || !endTime) {
        setMessage('Please enter a start and end time.')

        setMessageType('error')

        return
      }

      if (startTime >= endTime) {
        setMessage('End time must be after start time.')

        setMessageType('error')

        return
      }
    }

    try {
      setSaving(true)

      const response = await api.post('/time-off-requests/me', {
        date,
        allDay,

        startTime: allDay ? '' : startTime,

        endTime: allDay ? '' : endTime,

        reason: reason.trim(),
      })

      setRequests((current) => [response.data, ...current])

      setDate('')
      setAllDay(true)
      setStartTime('')
      setEndTime('')
      setReason('')

      setMessage('Time-off request submitted successfully.')

      setMessageType('success')
    } catch (error) {
      console.error(error)

      setMessage(
        error.response?.data?.message || 'Unable to submit time-off request.',
      )

      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  // =======================================================
  // CANCEL
  // =======================================================

  const handleCancel = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this request?',
    )

    if (!confirmed) {
      return
    }

    try {
      await api.delete(`/time-off-requests/me/${id}`)

      setRequests((current) => current.filter((request) => request._id !== id))

      setMessage('Time-off request cancelled.')

      setMessageType('success')
    } catch (error) {
      console.error(error)

      setMessage(error.response?.data?.message || 'Unable to cancel request.')

      setMessageType('error')
    }
  }

  // =======================================================
  // SORT REQUESTS
  // =======================================================

  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => b.date.localeCompare(a.date)),
    [requests],
  )

  // =======================================================
  // SUMMARY
  // =======================================================

  const pendingCount = requests.filter(
    (request) => request.status === 'Pending',
  ).length

  const approvedCount = requests.filter(
    (request) => request.status === 'Approved',
  ).length

  const deniedCount = requests.filter(
    (request) => request.status === 'Denied',
  ).length

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="employee-timeoff-layout">
      {/* ===============================================
          SHARED SIDEBAR
      =============================================== */}

      <EmployeeSidebar />

      {/* ===============================================
          MAIN
      =============================================== */}

      <main className="employee-timeoff-main">
        {/* =============================================
            HEADER
        ============================================= */}

        <section className="employee-timeoff-header">
          <div>
            <span className="employee-timeoff-eyebrow">EMPLOYEE PORTAL</span>

            <h1>Time Off</h1>

            <p>Request a full day or specific hours away from work.</p>
          </div>

          <div className="employee-timeoff-header-info">
            <span>MY REQUESTS</span>

            <strong>{requests.length}</strong>

            <small>Total submitted</small>
          </div>
        </section>

        {/* =============================================
            MESSAGE
        ============================================= */}

        {message && (
          <div className={`employee-timeoff-message ${messageType}`}>
            {message}
          </div>
        )}

        {/* =============================================
            SUMMARY
        ============================================= */}

        <section className="employee-timeoff-summary">
          <article>
            <span>PENDING</span>

            <strong className="pending">{pendingCount}</strong>

            <p>Awaiting review</p>
          </article>

          <article>
            <span>APPROVED</span>

            <strong className="approved">{approvedCount}</strong>

            <p>Approved requests</p>
          </article>

          <article>
            <span>DENIED</span>

            <strong className="denied">{deniedCount}</strong>

            <p>Denied requests</p>
          </article>
        </section>

        {/* =============================================
            CONTENT
        ============================================= */}

        <div className="employee-timeoff-content">
          {/* ===========================================
              NEW REQUEST
          =========================================== */}

          <section className="employee-timeoff-form-card">
            <div className="employee-timeoff-card-heading">
              <span>NEW REQUEST</span>

              <h2>Request Time Off</h2>

              <p>
                Choose the date and tell your manager when you need time away.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* DATE */}

              <div className="employee-timeoff-field">
                <label>DATE</label>

                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)

                    setMessage('')
                    setMessageType('')
                  }}
                  required
                />
              </div>

              {/* REQUEST TYPE */}

              <div className="employee-timeoff-type">
                <div>
                  <span>REQUEST TYPE</span>

                  <strong>{allDay ? 'Full Day' : 'Partial Day'}</strong>

                  <p>
                    {allDay
                      ? 'Request the entire day off.'
                      : 'Request specific hours off.'}
                  </p>
                </div>

                <label className="employee-timeoff-switch">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => {
                      const checked = e.target.checked

                      setAllDay(checked)

                      if (checked) {
                        setStartTime('')
                        setEndTime('')
                      }
                    }}
                  />

                  <span>
                    <i />
                  </span>
                </label>
              </div>

              {/* PARTIAL DAY */}

              {!allDay && (
                <div className="employee-timeoff-times">
                  <div className="employee-timeoff-field">
                    <label>START TIME</label>

                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="employee-timeoff-time-arrow">→</div>

                  <div className="employee-timeoff-field">
                    <label>END TIME</label>

                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* REASON */}

              <div className="employee-timeoff-field employee-timeoff-reason">
                <div className="employee-timeoff-label-row">
                  <label>REASON</label>

                  <span>Optional</span>
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Add a short note for your manager..."
                  maxLength={500}
                  rows={5}
                />

                <small>{reason.length}/500</small>
              </div>

              {/* SUBMIT */}

              <div className="employee-timeoff-submit">
                <p>
                  Your request will stay pending until a manager reviews it.
                </p>

                <button type="submit" disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </section>

          {/* ===========================================
              SIDE INFORMATION
          =========================================== */}

          <aside className="employee-timeoff-help-card">
            <span>REQUEST INFORMATION</span>

            <h3>Before you submit</h3>

            <div className="employee-timeoff-help-item">
              <strong>Full Day</strong>

              <p>Use this when you cannot work at all on the selected date.</p>
            </div>

            <div className="employee-timeoff-help-item">
              <strong>Partial Day</strong>

              <p>
                Turn off Full Day if you only need specific hours away from
                work.
              </p>
            </div>

            <div className="employee-timeoff-help-item">
              <strong>Manager Approval</strong>

              <p>New requests remain pending until they are reviewed.</p>
            </div>

            <div className="employee-timeoff-help-item">
              <strong>Cancellation</strong>

              <p>
                Pending requests can be cancelled before a manager reviews them.
              </p>
            </div>
          </aside>
        </div>

        {/* =============================================
            REQUEST HISTORY
        ============================================= */}

        <section className="employee-timeoff-history">
          <div className="employee-timeoff-history-heading">
            <div>
              <span>REQUEST HISTORY</span>

              <h2>My Requests</h2>

              <p>
                Track your submitted time-off requests and their approval
                status.
              </p>
            </div>

            <strong>
              {requests.length} {requests.length === 1 ? 'Request' : 'Requests'}
            </strong>
          </div>

          {loading ? (
            <div className="employee-timeoff-loading">
              <div className="employee-timeoff-loader" />

              <p>Loading requests...</p>
            </div>
          ) : sortedRequests.length === 0 ? (
            <div className="employee-timeoff-empty">
              <div className="employee-timeoff-empty-icon">◷</div>

              <h3>No requests yet</h3>

              <p>Your submitted time-off requests will appear here.</p>
            </div>
          ) : (
            <div className="employee-timeoff-request-list">
              {sortedRequests.map((request) => (
                <article className="employee-timeoff-request" key={request._id}>
                  <div className="employee-timeoff-request-date">
                    <span>DATE</span>

                    <strong>{formatDate(request.date)}</strong>
                  </div>

                  <div className="employee-timeoff-request-time">
                    <span>TIME</span>

                    <strong>
                      {request.allDay
                        ? 'All Day'
                        : `${formatTime(request.startTime)} - ${formatTime(
                            request.endTime,
                          )}`}
                    </strong>
                  </div>

                  <div className="employee-timeoff-request-reason">
                    <span>REASON</span>

                    <strong>{request.reason || 'No reason provided'}</strong>
                  </div>

                  <div className="employee-timeoff-request-status">
                    <span
                      className={`employee-timeoff-status ${request.status.toLowerCase()}`}
                    >
                      {request.status}
                    </span>
                  </div>

                  {request.status === 'Pending' && (
                    <button
                      type="button"
                      className="employee-timeoff-cancel"
                      onClick={() => handleCancel(request._id)}
                    >
                      Cancel
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default TimeOffRequests
