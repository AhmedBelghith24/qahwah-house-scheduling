import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import AdminSidebar from '../../components/AdminSidebar'

function Availability() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')

  const [currentPage, setCurrentPage] = useState(1)

  const recordsPerPage = 2

  // ==========================================================
  // LOAD AVAILABILITY
  // ==========================================================

  useEffect(() => {
    fetchAvailability()
  }, [])

  const fetchAvailability = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await api.get('/availability')

      const data = Array.isArray(response.data) ? response.data : []

      setRecords(data)
    } catch (error) {
      console.error(error)

      setMessage(
        error.response?.data?.message || 'Unable to load availability.',
      )
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
  // GROUP RECORDS BY EMPLOYEE
  // ==========================================================

  const employees = useMemo(() => {
    const grouped = {}

    records.forEach((record) => {
      const employee = record.employeeId

      if (!employee?._id) {
        return
      }

      if (!grouped[employee._id]) {
        grouped[employee._id] = {
          employee,
          records: [],
        }
      }

      grouped[employee._id].records.push(record)
    })

    return Object.values(grouped).sort((a, b) => {
      const nameA = `${a.employee.firstName || ''} ${a.employee.lastName || ''}`

      const nameB = `${b.employee.firstName || ''} ${b.employee.lastName || ''}`

      return nameA.localeCompare(nameB)
    })
  }, [records])

  // ==========================================================
  // SEARCH EMPLOYEES
  // ==========================================================

  const filteredEmployees = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    if (!search) {
      return employees
    }

    return employees.filter(({ employee }) => {
      const name = `${employee.firstName || ''} ${
        employee.lastName || ''
      }`.toLowerCase()

      const email = (employee.email || '').toLowerCase()

      return name.includes(search) || email.includes(search)
    })
  }, [employees, searchTerm])

  // ==========================================================
  // SELECTED EMPLOYEE
  // ==========================================================

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) {
      return null
    }

    return (
      employees.find(({ employee }) => employee._id === selectedEmployeeId) ||
      null
    )
  }, [employees, selectedEmployeeId])

  // ==========================================================
  // SELECTED EMPLOYEE RECORDS
  // ==========================================================

  const selectedRecords = useMemo(() => {
    if (!selectedEmployee) {
      return []
    }

    return [...selectedEmployee.records].sort((a, b) =>
      b.weekStart.localeCompare(a.weekStart),
    )
  }, [selectedEmployee])

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.ceil(selectedRecords.length / recordsPerPage)

  const startIndex = (currentPage - 1) * recordsPerPage

  const paginatedRecords = selectedRecords.slice(
    startIndex,
    startIndex + recordsPerPage,
  )

  // ==========================================================
  // KEEP CURRENT PAGE VALID
  // ==========================================================

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }

    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  // ==========================================================
  // OPEN EMPLOYEE
  // ==========================================================

  const openEmployee = (employeeId) => {
    setSelectedEmployeeId(employeeId)
    setCurrentPage(1)
    setMessage('')
  }

  // ==========================================================
  // BACK TO EMPLOYEES
  // ==========================================================

  const backToEmployees = () => {
    setSelectedEmployeeId(null)
    setCurrentPage(1)
    setMessage('')
  }

  // ==========================================================
  // GLOBAL INFORMATION
  // ==========================================================

  const employeesWithAvailability = employees.length

  const totalAvailabilityRecords = records.length

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
            PAGE HEADER
        ================================================== */}

        <header className="admin-topbar">
          <div>
            <h1>Availability</h1>

            <p>
              View employee weekly availability used for schedule generation.
            </p>
          </div>
        </header>

        {/* ==================================================
            MESSAGE
        ================================================== */}

        {message && <div className="employee-message">{message}</div>}

        {/* ==================================================
            SUMMARY CARDS
        ================================================== */}

        <section className="employee-summary">
          <div>
            <span>Employees With Availability</span>

            <strong>{employeesWithAvailability}</strong>
          </div>

          <div>
            <span>Weekly Records</span>

            <strong>{totalAvailabilityRecords}</strong>
          </div>
        </section>

        {/* ==================================================
            LOADING / EMPTY / DIRECTORY / DETAILS
        ================================================== */}

        {loading ? (
          <section className="availability-directory-card">
            <div className="employees-empty">
              <p>Loading availability...</p>
            </div>
          </section>
        ) : records.length === 0 ? (
          <section className="availability-directory-card">
            <div className="employees-empty">
              <h3>No availability saved</h3>

              <p>
                Employee availability will appear here after employees save
                their weekly hours.
              </p>
            </div>
          </section>
        ) : !selectedEmployee ? (
          /* ==================================================
             EMPLOYEE DIRECTORY
          ================================================== */

          <section className="availability-directory-card">
            {/* ==============================================
                DIRECTORY HEADER
            ============================================== */}

            <div className="availability-directory-header">
              <div>
                <span className="availability-panel-eyebrow">
                  TEAM AVAILABILITY
                </span>

                <h2>Select an Employee</h2>

                <p>
                  Choose an employee to view their saved weekly availability.
                </p>
              </div>

              <div className="availability-directory-count">
                <strong>{employees.length}</strong>

                <span>employees</span>
              </div>
            </div>

            {/* ==============================================
                SEARCH
            ============================================== */}

            <div className="availability-directory-search">
              <span className="availability-search-icon">⌕</span>

              <input
                type="text"
                placeholder="Search by employee name or email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            {/* ==============================================
                EMPLOYEE CARDS
            ============================================== */}

            {filteredEmployees.length === 0 ? (
              <div className="availability-directory-empty">
                <h3>No employees found</h3>

                <p>Try searching for a different employee.</p>
              </div>
            ) : (
              <div className="availability-directory-grid">
                {filteredEmployees.map(
                  ({ employee, records: employeeRecords }) => (
                    <button
                      type="button"
                      key={employee._id}
                      className="availability-directory-employee"
                      onClick={() => openEmployee(employee._id)}
                    >
                      {/* AVATAR */}

                      <div className="availability-directory-avatar">
                        {employee.firstName?.[0]?.toUpperCase() || '?'}

                        {employee.lastName?.[0]?.toUpperCase() || ''}
                      </div>

                      {/* EMPLOYEE INFO */}

                      <div className="availability-directory-info">
                        <strong>
                          {employee.firstName} {employee.lastName}
                        </strong>

                        <span>{employee.email}</span>

                        <div className="availability-directory-meta">
                          <span className="availability-directory-request-count">
                            {employeeRecords.length}{' '}
                            {employeeRecords.length === 1
                              ? 'week saved'
                              : 'weeks saved'}
                          </span>
                        </div>
                      </div>

                      {/* SAVED INDICATOR */}

                      <div className="availability-directory-statuses">
                        <div className="availability-directory-status approved">
                          <span />

                          {employeeRecords.length}
                        </div>
                      </div>

                      {/* ARROW */}

                      <div className="availability-directory-arrow">→</div>
                    </button>
                  ),
                )}
              </div>
            )}
          </section>
        ) : (
          /* ==================================================
             SELECTED EMPLOYEE AVAILABILITY
          ================================================== */

          <section className="availability-detail-page">
            {/* ==============================================
                BACK BUTTON
            ============================================== */}

            <button
              type="button"
              className="availability-back-button"
              onClick={backToEmployees}
            >
              <span>←</span>
              Back to Employees
            </button>

            {/* ==============================================
                EMPLOYEE HEADER
            ============================================== */}

            <div className="availability-detail-header">
              <div className="availability-detail-person">
                <div className="availability-detail-avatar">
                  {selectedEmployee.employee.firstName?.[0]?.toUpperCase()}

                  {selectedEmployee.employee.lastName?.[0]?.toUpperCase()}
                </div>

                <div>
                  <span className="availability-panel-eyebrow">
                    AVAILABILITY HISTORY
                  </span>

                  <h2>
                    {selectedEmployee.employee.firstName}{' '}
                    {selectedEmployee.employee.lastName}
                  </h2>

                  <p>{selectedEmployee.employee.email}</p>
                </div>
              </div>

              <div className="availability-detail-total">
                <strong>{selectedEmployee.records.length}</strong>

                <span>Weeks Saved</span>
              </div>
            </div>

            {/* ==============================================
                INFO BAR
            ============================================== */}

            <div className="availability-detail-filters">
              <button
                type="button"
                className="availability-filter-button active"
              >
                All Weeks
                <span>{selectedEmployee.records.length}</span>
              </button>
            </div>

            {/* ==============================================
                AVAILABILITY LIST
            ============================================== */}

            <div className="availability-detail-requests">
              {selectedRecords.length === 0 ? (
                <div className="availability-history-empty">
                  <h3>No availability saved</h3>

                  <p>This employee has not saved any weekly availability.</p>
                </div>
              ) : (
                <>
                  {paginatedRecords.map((record) => (
                    <article
                      className="availability-history-card"
                      key={record._id}
                    >
                      {/* ================================
                            WEEK HEADER
                        ================================ */}

                      <div className="availability-history-card-header">
                        <div>
                          <span className="availability-history-label">
                            WEEK STARTING
                          </span>

                          <h3>{formatDate(record.weekStart)}</h3>
                        </div>

                        <span className="availability-status approved">
                          ✓ Saved
                        </span>
                      </div>

                      {/* ================================
                            AVAILABILITY DAYS
                        ================================ */}

                      <div className="availability-history-days">
                        {record.availability.map((day) => (
                          <div
                            className={`availability-history-day ${
                              day.available ? 'available' : 'unavailable'
                            }`}
                            key={day.day}
                          >
                            <strong>{day.day.slice(0, 3)}</strong>

                            {day.available ? (
                              <>
                                <span className="availability-day-available-label">
                                  Available
                                </span>

                                <span className="availability-day-time">
                                  {formatTime(day.startTime)}

                                  <br />

                                  {formatTime(day.endTime)}
                                </span>
                              </>
                            ) : (
                              <span className="availability-day-off-label">
                                Unavailable
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* ================================
                            INFO
                        ================================ */}

                      <div className="availability-history-actions">
                        <span className="availability-decision-note">
                          This availability is automatically used when
                          generating the weekly schedule.
                        </span>
                      </div>
                    </article>
                  ))}

                  {/* ========================================
                      PAGINATION
                  ======================================== */}

                  {totalPages > 1 && (
                    <div className="availability-pagination">
                      <button
                        type="button"
                        className="availability-page-arrow"
                        disabled={currentPage === 1}
                        onClick={() =>
                          setCurrentPage((page) => Math.max(page - 1, 1))
                        }
                      >
                        ←
                      </button>

                      {Array.from(
                        {
                          length: totalPages,
                        },
                        (_, index) => {
                          const page = index + 1

                          return (
                            <button
                              type="button"
                              key={page}
                              className={`availability-page-number ${
                                currentPage === page ? 'active' : ''
                              }`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          )
                        },
                      )}

                      <button
                        type="button"
                        className="availability-page-arrow"
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(page + 1, totalPages),
                          )
                        }
                      >
                        →
                      </button>
                    </div>
                  )}

                  {/* ========================================
                      PAGE INFO
                  ======================================== */}

                  {selectedRecords.length > recordsPerPage && (
                    <div className="availability-page-info">
                      Showing <strong>{startIndex + 1}</strong>
                      {' – '}
                      <strong>
                        {Math.min(
                          startIndex + recordsPerPage,
                          selectedRecords.length,
                        )}
                      </strong>
                      {' of '}
                      <strong>{selectedRecords.length}</strong>
                      {' weeks'}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default Availability
