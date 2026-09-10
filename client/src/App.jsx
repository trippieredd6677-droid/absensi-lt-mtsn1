import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Profil from './pages/Profil'
import Absensi from './pages/Absensi'
import Histori from './pages/Histori'
import Jadwal from './pages/Jadwal'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAbsensi from './pages/admin/AdminAbsensi'
import AdminKelas from './pages/admin/AdminKelas'
import AdminAuditLog from './pages/admin/AdminAuditLog'
import Error from './pages/Error'
import './App.css'
import api from './api'
import { useTheme } from './ThemeContext'

function App() {
  const { resetTheme } = useTheme()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    
    if (token && savedUser) {
      setIsAuthenticated(true)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setIsAuthenticated(true)
    setUser(userData)
  }

  const handleLogout = () => {
    // Cabut refresh token di server (best-effort) lalu bersihkan sesi lokal
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {})
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    resetTheme() // logout → tema balik ke light
    setIsAuthenticated(false)
    setUser(null)
  }

  const handleUserUpdate = (updatedUser) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...updatedUser }
      localStorage.setItem('user', JSON.stringify(merged))
      return merged
    })
  }

  if (loading) {
    return <div className="loading-screen">Loading...</div>
  }

  return (
    <Router>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="*" element={<Error code={404} />} />
          </>
        ) : (
          <>
            {user?.role === 'admin' ? (
              <>
                <Route path="/admin" element={<AdminDashboard user={user} onLogout={handleLogout} />} />
                <Route path="/admin/users" element={<AdminUsers user={user} onLogout={handleLogout} />} />
                <Route path="/admin/absensi" element={<AdminAbsensi user={user} onLogout={handleLogout} />} />
                <Route path="/admin/kelas" element={<AdminKelas user={user} onLogout={handleLogout} />} />
                <Route path="/admin/jadwal" element={<Jadwal user={user} onLogout={handleLogout} role="admin" />} />
                <Route path="/admin/audit" element={<AdminAuditLog user={user} onLogout={handleLogout} />} />
                <Route path="/profil" element={<Profil user={user} onLogout={handleLogout} onUpdateUser={handleUserUpdate} />} />
                <Route path="*" element={<Error code={404} />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard user={user} onLogout={handleLogout} />} />
                <Route path="/dashboard" element={<Dashboard user={user} onLogout={handleLogout} />} />
                <Route path="/profil" element={<Profil user={user} onLogout={handleLogout} onUpdateUser={handleUserUpdate} />} />
                <Route path="/absensi" element={<Absensi user={user} onLogout={handleLogout} />} />
                <Route path="/histori" element={<Histori user={user} onLogout={handleLogout} />} />
                <Route path="/jadwal" element={<Jadwal user={user} onLogout={handleLogout} role="guru" />} />
                <Route path="*" element={<Error code={404} />} />
              </>
            )}
          </>
        )}
      </Routes>
    </Router>
  )
}

export default App
