import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

    try {
      setLoading(true)

      const response = await api.post('/auth/login', {
        email,
        password,
      })

      const { token, user } = response.data

      // Save login information
      localStorage.setItem('token', token)

      localStorage.setItem('user', JSON.stringify(user))

      // Redirect based on account type
      if (user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/employee')
      }
    } catch (error) {
      console.error(error)

      setError(error.response?.data?.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* HEADER */}

      <header className="login-header">
        <div className="header-container">
          <img src="/logo.png" alt="Qahwah House" className="header-logo" />

          <div className="login-nav">
            <span>Employee Scheduling</span>

            <div className="nav-divider"></div>

            <span>Help</span>
          </div>
        </div>
      </header>

      {/* MAIN */}

      <main className="login-main">
        <div className="login-content">
          <div className="login-heading">
            <h1>Welcome Back</h1>

            <p>Sign in to access your Qahwah House scheduling account.</p>
          </div>

          <div className="login-card">
            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email Address</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="forgot-password">
                <button type="button">Forgot password?</button>
              </div>

              <button
                type="submit"
                className="signin-button"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="login-activate">
              <p>New employee?</p>

              <Link to="/activate">Activate your account</Link>
            </div>

            <p className="login-support">
              Need help accessing your account? Contact your manager.
            </p>
          </div>
        </div>
      </main>

      {/* FOOTER */}

      <footer className="login-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <img src="/logo.png" alt="Qahwah House" className="footer-logo" />

            <p>Employee Scheduling System</p>
          </div>

          <div className="footer-info">
            <h3>Qahwah House</h3>

            <p>Coffee. Culture. Community.</p>
          </div>
        </div>

        <div className="footer-bottom">Qahwah House Employee Scheduling</div>
      </footer>
    </div>
  )
}

export default Login
