import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { WarningCircle, ArrowsLeftRight, LockKey, EnvelopeSimple, Key, CheckCircle, ArrowLeft } from '@phosphor-icons/react'
import { IconAlertCircle, IconArrowLeft, IconArrowsExchange, IconCircleCheck, IconKey, IconLink, IconLock, IconMail } from '@tabler/icons-react'
import api from '../api'
import './ForgotPassword.css'
import './Login.css'

const logo = '/logo-full.png'

function ForgotPassword() {
  const navigate = useNavigate()

  // Step: 1 = email, 2 = OTP, 3 = new password, 4 = done
  const [step, setStep] = useState(1)

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [resetToken, setResetToken] = useState('')

  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const requestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Email tidak boleh kosong')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      // Dev-only convenience (MAIL_LOGGING=true): tampilkan OTP di layar biar alur teruji
      if (res.data?.dev_otp) {
        setInfo(`Kode OTP (dev): ${res.data.dev_otp}`)
        setOtp(res.data.dev_otp)
      }
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('OTP harus 6 digit angka')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: otp.trim() })
      setResetToken(res.data.reset_token)
      setInfo('OTP valid. Atur password baru.')
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.message || 'Kode OTP salah.')
    } finally {
      setLoading(false)
    }
  }

  const doReset = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (password.length < 8) {
      setError('Password baru minimal 8 karakter')
      return
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email,
        reset_token: resetToken,
        newPassword: password,
      })
      setStep(4)
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mereset password.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { n: 1, label: 'Email' },
    { n: 2, label: 'OTP' },
    { n: 3, label: 'Password' },
  ]

  return (
    <div className="login-container" style={{ justifyContent: 'center' }}>
      <div className="login-form-side" style={{ flex: '1 1 100%', maxWidth: '100%' }}>
        <div className="login-box forgot-box">
        <Link to="/login" className="back-link">
          <IconArrowLeft size={16} stroke={1.8} /> Kembali ke Login
        </Link>

        <div className="login-header">
          <div className="login-brand-icon"><IconKey size={16} stroke={1.8} /></div>
          <h1>Lupa Password</h1>
          <p>{step === 1 ? 'Masukkan email terdaftar kamu' : step === 2 ? 'Masukkan kode OTP' : 'Atur password baru'}</p>
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div className="step-indicator">
            {steps.map((s) => (
              <div key={s.n} className={`step-item ${step === s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}>
                <span className="step-dot">{step > s.n ? <IconCircleCheck size={16} stroke={1.8} /> : s.n}</span>
                <span className="step-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlertCircle size={16} stroke={1.8} />
            <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="alert alert-info" role="status">
            <IconArrowsExchange size={16} stroke={1.8} />
            <span>{info}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={requestOtp} className="login-form">
            <div className="form-group">
              <label htmlFor="email">
                <IconMail size={16} stroke={1.8} /> Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verifyOtp} className="login-form">
            <div className="form-group">
              <label htmlFor="otp">
                <IconKey size={16} stroke={1.8} /> Kode OTP
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6 digit"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Verifikasi...' : 'Verifikasi OTP'}
            </button>
            <button type="button" className="btn btn-secondary btn-full mt-sm" onClick={() => { setStep(1); setError(''); setInfo(''); }}>
              Ubah Email
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={doReset} className="login-form">
            <div className="form-group">
              <label htmlFor="password"><IconLock size={16} stroke={1.8} /> Password Baru</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm"><IconLock size={16} stroke={1.8} /> Konfirmasi Password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi password baru"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        )}

        {step === 4 && (
          <div className="done-wrap">
            <div className="done-icon"><IconCircleCheck size={28} stroke={1.8} /></div>
            <p>Password berhasil diubah. Silakan masuk dengan password baru.</p>
            <button type="button" className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
              Ke Halaman Login
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
