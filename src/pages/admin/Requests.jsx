import { useEffect, useState } from 'react'
import api from '../../api/axios'
import AdminSidebar from '../../components/AdminSidebar'

function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // ==========================================
  // LOAD ALL TIME-OFF REQUESTS
  // ==========================================

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await api.get('/time-off-requests')

      setRequests(response.data)
    } catch (error) {
      console.error(error)

      setMessage(
        error.response?.data?.message || 'Unable to load time-off requests.',
      )
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // APPROVE / DENY
  // ==========================================

  const updateStatus = async (id, status) => {
    try {
      setMessage('')

      const response = await api.patch(`/time-off-requests/${id}/status`, {
        status,
      })

      setRequests((current) =>
        current.map((request) =>
          request._id === id ? response.data : request,
        ),
      )

      // Tell the shared AdminSidebar that the pending
      // request count may have changed.
      window.dispatchEvent(new Event('timeOffRequestsUpdated'))

      setMessage(`Time-off request ${status.toLowerCase()} successfully.`)
    } catch (error) {
      console.error(error)

      setMessage(error.response?.data?.message || 'Unable to update request.')
    }
  }

  // ==========================================
  // COUNTS
  // ==========================================

  const pendingCount = requests.filter(
    (request) => request.status === 'Pending',
  ).length

  const approvedCount = requests.filter(
    (request) => request.status === 'Approved',
  ).length

  const deniedCount = requests.filter(
    (request) => request.status === 'Denied',
  ).length

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="admin-layout">
      {/* ======================================
          SHARED SIDEBAR
      ====================================== */}

      <AdminSidebar />

      {/* ======================================
          MAIN CONTENT
      ====================================== */}

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>Time-Off Requests</h1>

            <p>
              Review employee time-off requests before creating the weekly
              schedule.
            </p>
          </div>
        </header>

        {/* MESSAGE */}

        {message && <div className="employee-message">{message}</div>}

        {/* SUMMARY */}

        <section className="employee-summary">
          <div>
            <span>Total Requests</span>
            <strong>{requests.length}</strong>
          </div>

          <div>
            <span>Pending</span>
            <strong>{pendingCount}</strong>
          </div>

          <div>
            <span>Approved</span>
            <strong>{approvedCount}</strong>
          </div>

          <div>
            <span>Denied</span>
            <strong>{deniedCount}</strong>
          </div>
        </section>

        {/* ======================================
            REQUESTS
        ====================================== */}

        <section className="admin-requests-list">
          <div className="employee-list-header">
            <div>
              <h2>Employee Requests</h2>

              <p>Approve or deny employee time-off requests.</p>
            </div>
          </div>

          {loading ? (
            <div className="employees-empty">
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="employees-empty">
              <h3>No requests submitted</h3>

              <p>Employee time-off requests will appear here.</p>
            </div>
          ) : (
            <div className="admin-request-records">
              {requests.map((request) => (
                <article className="admin-request-card" key={request._id}>
                  {/* HEADER */}

                  <div className="admin-request-header">
                    <div className="admin-request-employee">
                      <div className="employee-avatar">
                        {request.employeeId?.firstName
                          ?.charAt(0)
                          .toUpperCase() || '?'}
                      </div>

                      <div>
                        <h3>
                          {request.employeeId?.firstName}{' '}
                          {request.employeeId?.lastName}
                        </h3>

                        <p>{request.employeeId?.email}</p>
                      </div>
                    </div>

                    <span
                      className={`availability-status ${request.status.toLowerCase()}`}
                    >
                      {request.status}
                    </span>
                  </div>

                  {/* DETAILS */}

                  <div className="admin-request-details">
                    <div>
                      <span>Date</span>

                      <strong>{request.date}</strong>
                    </div>

                    <div>
                      <span>Time</span>

                      <strong>
                        {request.allDay
                          ? 'All Day'
                          : `${request.startTime} – ${request.endTime}`}
                      </strong>
                    </div>

                    <div className="admin-request-reason">
                      <span>Reason</span>

                      <strong>{request.reason || 'No reason provided'}</strong>
                    </div>
                  </div>

                  {/* ACTIONS */}

                  <div className="admin-request-actions">
                    {request.status === 'Pending' ? (
                      <>
                        <button
                          type="button"
                          className="deny-availability-button"
                          onClick={() => updateStatus(request._id, 'Denied')}
                        >
                          Deny
                        </button>

                        <button
                          type="button"
                          className="approve-availability-button"
                          onClick={() => updateStatus(request._id, 'Approved')}
                        >
                          Approve
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="review-again-button"
                        onClick={() =>
                          updateStatus(
                            request._id,
                            request.status === 'Approved'
                              ? 'Denied'
                              : 'Approved',
                          )
                        }
                      >
                        Change to{' '}
                        {request.status === 'Approved' ? 'Denied' : 'Approved'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Requests
