import { useEffect, useState } from 'react'
import api from '../../api/axios'
import AdminSidebar from '../../components/AdminSidebar'

const stations = [
  'Cashier',
  'Espresso Station',
  'Yemeni Station',
  'Pickup Station',
]

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  roles: [],
  maxWeeklyHours: 40,
  status: 'Active',
}

function Employees() {
  const [employees, setEmployees] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState(emptyForm)

  // ==========================================
  // LOAD EMPLOYEES
  // ==========================================

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)

      const response = await api.get('/employees')

      setEmployees(response.data)
    } catch (error) {
      console.error(error)

      if (error.response?.status === 401) {
        setMessage('You must be signed in to view employees.')
      } else if (error.response?.status === 403) {
        setMessage('Admin access is required to view employees.')
      } else {
        setMessage(
          error.response?.data?.message ||
            'Unable to load employees. Make sure the backend is running.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // FORM INPUT
  // ==========================================

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const handleRoleChange = (role) => {
    if (form.roles.includes(role)) {
      setForm({
        ...form,
        roles: form.roles.filter((currentRole) => currentRole !== role),
      })
    } else {
      setForm({
        ...form,
        roles: [...form.roles, role],
      })
    }
  }

  // ==========================================
  // OPEN ADD FORM
  // ==========================================

  const openAddForm = () => {
    setEditingEmployeeId(null)
    setForm(emptyForm)
    setShowForm(true)
    setMessage('')
  }

  // ==========================================
  // OPEN EDIT FORM
  // ==========================================

  const openEditForm = (employee) => {
    setEditingEmployeeId(employee._id)

    setForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      roles: employee.roles,
      maxWeeklyHours: employee.maxWeeklyHours,
      status: employee.status || 'Active',
    })

    setShowForm(true)
    setMessage('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  // ==========================================
  // CLOSE FORM
  // ==========================================

  const closeForm = () => {
    setShowForm(false)
    setEditingEmployeeId(null)
    setForm(emptyForm)
  }

  // ==========================================
  // ADD OR UPDATE EMPLOYEE
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMessage('')

    if (form.roles.length === 0) {
      setMessage('Please select at least one qualified station.')
      return
    }

    const employeeData = {
      ...form,
      maxWeeklyHours: Number(form.maxWeeklyHours),
    }

    try {
      // EDIT EXISTING EMPLOYEE

      if (editingEmployeeId) {
        const response = await api.put(
          `/employees/${editingEmployeeId}`,
          employeeData,
        )

        setEmployees((currentEmployees) =>
          currentEmployees.map((employee) =>
            employee._id === editingEmployeeId ? response.data : employee,
          ),
        )

        setMessage('Employee updated successfully.')
      }

      // ADD NEW EMPLOYEE
      else {
        const response = await api.post('/employees', employeeData)

        setEmployees((currentEmployees) => [...currentEmployees, response.data])

        setMessage('Employee added successfully.')
      }

      setShowForm(false)
      setEditingEmployeeId(null)
      setForm(emptyForm)
    } catch (error) {
      console.error(error)

      setMessage(error.response?.data?.message || 'Unable to save employee.')
    }
  }

  // ==========================================
  // DELETE EMPLOYEE
  // ==========================================

  const deleteEmployee = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this employee?',
    )

    if (!confirmed) {
      return
    }

    try {
      await api.delete(`/employees/${id}`)

      setEmployees((currentEmployees) =>
        currentEmployees.filter((employee) => employee._id !== id),
      )

      setMessage('Employee deleted successfully.')
    } catch (error) {
      console.error(error)

      setMessage(error.response?.data?.message || 'Unable to delete employee.')
    }
  }

  // ==========================================
  // ACTIVE EMPLOYEES
  // ==========================================

  const activeEmployees = employees.filter(
    (employee) => !employee.status || employee.status === 'Active',
  )

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
        {/* HEADER */}

        <header className="admin-topbar">
          <div>
            <h1>Employees</h1>

            <p>Manage employees and station qualifications.</p>
          </div>

          <button className="add-employee-button" onClick={openAddForm}>
            + Add Employee
          </button>
        </header>

        {/* MESSAGE */}

        {message && <div className="employee-message">{message}</div>}

        {/* SUMMARY */}

        <section className="employee-summary">
          <div>
            <span>Active Employees</span>

            <strong>{activeEmployees.length}</strong>
          </div>

          <div>
            <span>Cashier</span>

            <strong>
              {
                activeEmployees.filter((employee) =>
                  employee.roles.includes('Cashier'),
                ).length
              }
            </strong>
          </div>

          <div>
            <span>Espresso</span>

            <strong>
              {
                activeEmployees.filter((employee) =>
                  employee.roles.includes('Espresso Station'),
                ).length
              }
            </strong>
          </div>

          <div>
            <span>Yemeni</span>

            <strong>
              {
                activeEmployees.filter((employee) =>
                  employee.roles.includes('Yemeni Station'),
                ).length
              }
            </strong>
          </div>

          <div>
            <span>Pickup</span>

            <strong>
              {
                activeEmployees.filter((employee) =>
                  employee.roles.includes('Pickup Station'),
                ).length
              }
            </strong>
          </div>
        </section>

        {/* ======================================
            ADD / EDIT FORM
        ====================================== */}

        {showForm && (
          <section className="employee-form-card">
            <div className="employee-form-header">
              <div>
                <h2>{editingEmployeeId ? 'Edit Employee' : 'Add Employee'}</h2>

                <p>
                  {editingEmployeeId
                    ? 'Update employee information and station qualifications.'
                    : 'Create an employee and select every station they can work.'}
                </p>
              </div>

              <button type="button" className="close-form" onClick={closeForm}>
                ×
              </button>
            </div>

            <form className="employee-form" onSubmit={handleSubmit}>
              {/* NAME */}

              <div className="form-row">
                <div className="form-field">
                  <label>First Name</label>

                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Last Name</label>

                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              {/* EMAIL */}

              <div className="form-field">
                <label>Email Address</label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="employee@email.com"
                  required
                />
              </div>

              {/* STATIONS */}

              <div className="form-field">
                <label>Qualified Stations</label>

                <p className="field-description">
                  Select every station this employee is trained to work.
                </p>

                <div className="role-selector">
                  {stations.map((role) => (
                    <label
                      key={role}
                      className={
                        form.roles.includes(role)
                          ? 'role-option selected'
                          : 'role-option'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => handleRoleChange(role)}
                      />

                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* HOURS */}

              <div className="form-field hours-field">
                <label>Maximum Weekly Hours</label>

                <input
                  type="number"
                  name="maxWeeklyHours"
                  min="1"
                  max="60"
                  value={form.maxWeeklyHours}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* STATUS */}

              {editingEmployeeId && (
                <div className="form-field">
                  <label>Employee Status</label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="Active">Active</option>

                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              )}

              {/* BUTTONS */}

              <div className="employee-form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button type="submit" className="save-employee-button">
                  {editingEmployeeId ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ======================================
            EMPLOYEE LIST
        ====================================== */}

        <section className="employee-list-card">
          <div className="employee-list-header">
            <div>
              <h2>Team</h2>

              <p>{activeEmployees.length} active employees</p>
            </div>
          </div>

          {loading ? (
            <div className="employees-empty">
              <p>Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="employees-empty">
              <h3>No employees yet</h3>

              <p>Add your first employee to start building schedules.</p>

              <button className="primary-action-button" onClick={openAddForm}>
                + Add Employee
              </button>
            </div>
          ) : (
            <div className="employee-table-wrapper">
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Stations</th>
                    <th>Max Hours</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee._id}>
                      {/* EMPLOYEE */}

                      <td>
                        <div className="employee-name-cell">
                          <div className="employee-avatar">
                            {employee.firstName.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {employee.firstName} {employee.lastName}
                            </strong>

                            <span>{employee.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* STATIONS */}

                      <td>
                        <div className="role-badges">
                          {employee.roles.map((role) => (
                            <span className="role-badge" key={role}>
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* HOURS */}

                      <td>{employee.maxWeeklyHours} hrs</td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={
                            employee.status === 'Inactive'
                              ? 'inactive-status'
                              : 'active-status'
                          }
                        >
                          {employee.status || 'Active'}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td>
                        <div className="employee-actions">
                          <button
                            className="edit-employee"
                            onClick={() => openEditForm(employee)}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-employee"
                            onClick={() => deleteEmployee(employee._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Employees
