import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { WarningCircle, Eye, EyeSlash } from '@phosphor-icons/react'
import api from '../api'
import './Login.css'

const logo = '/logo-full.png'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) {
      setError('Username tidak boleh kosong')
      return
    }
    if (!password.trim()) {
      setError('Password tidak boleh kosong')
      return
    }
    setLoading(true)

    try {
      const response = await api.post('/auth/login', {
        username,
        password,
      })

      localStorage.setItem('refresh_token', response.data.refresh_token)
      onLogin(response.data.token, response.data.user)

      if (response.data.user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      const msg = err.response?.data?.message
      if (err.response?.status === 401) {
        setError('Username atau password salah. Silakan coba lagi.')
      } else {
        setError(msg || 'Terjadi kesalahan pada server. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img src={logo} alt="Logo MTsN 1 Kebumen" className="login-logo" />
          <h1>Absensi LT</h1>
          <p>MTsN 1 Kebumen</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="alert alert-error" role="alert">
              <WarningCircle weight="duotone" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
              placeholder="Masukkan username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                placeholder="Masukkan password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeSlash weight="duotone" /> : <Eye weight="duotone" />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <div className="login-footer">
          <div className="login-note">
            <Link to="/forgot-password" className="forgot-link">
              Lupa password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login