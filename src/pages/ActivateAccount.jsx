import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

function ActivateAccount() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })

    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setMessage('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    try {
      setLoading(true)

      const response = await api.post('/auth/activate', {
        email: form.email,
        password: form.password,
      })

      setMessage(response.data.message)

      // Send employee back to login after activation
      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (error) {
      console.error(error)

      setError(error.response?.data?.message || 'Unable to activate account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="activate-page">
      <header className="activate-header">
        <img src="/logo.png" alt="Qahwah House" />

        <Link to="/">Back to Sign In</Link>
      </header>

      <main className="activate-main">
        <div className="activate-card">
          <div className="activate-title">
            <h1>Activate Your Account</h1>

            <p>
              Use the email address your manager registered for you and create
              your password.
            </p>
          </div>

          {error && <div className="activate-error">{error}</div>}

          {message && <div className="activate-success">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="activate-field">
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

            <div className="activate-field">
              <label>Create Password</label>

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                required
              />
            </div>

            <div className="activate-field">
              <label>Confirm Password</label>

              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Enter password again"
                required
              />
            </div>

            <button
              type="submit"
              className="activate-button"
              disabled={loading}
            >
              {loading ? 'Activating...' : 'Activate Account'}
            </button>
          </form>

          <div className="activate-login">
            Already activated your account? <Link to="/">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ActivateAccount
