import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Gauge,
  ClipboardText,
  ClockCounterClockwise,
  UserCircle,
  Users,
  CalendarCheck,
  CalendarBlank,
  SignOut,
  Sun,
  Moon,
  ListBullets,
  ShieldCheck,
  TreeStructure,
  List,
} from '@phosphor-icons/react'
import { useTheme } from '../ThemeContext'
import logo from '../assets/logo-sidebar.jpg'

/**
 * Layout bersama: sidebar + main.
 * Dipakai semua halaman (guru & admin) supaya navigasi konsisten.
 */
function Layout({ user, onLogout, role = 'guru', active, children }) {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const initials = (String(user?.full_name || user?.username || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase())

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const guruMenu = [
    { to: '/', label: 'Dashboard', icon: Gauge, key: 'dashboard' },
    { to: '/absensi', label: 'Absensi', icon: ClipboardText, key: 'absensi' },
    { to: '/histori', label: 'Histori', icon: ClockCounterClockwise, key: 'histori' },
    { to: '/jadwal', label: 'Jadwal', icon: CalendarBlank, key: 'jadwal' },
    { to: '/profil', label: 'Profil', icon: UserCircle, key: 'profil' },
  ]

  const adminMenu = [
    { to: '/admin', label: 'Dashboard', icon: Gauge, key: 'dashboard' },
    { to: '/admin/users', label: 'Manajemen Guru', icon: Users, key: 'users' },
    { to: '/admin/absensi', label: 'Data Absensi', icon: CalendarCheck, key: 'absensi' },
    { to: '/admin/kelas', label: 'Kelola Kelas', icon: ListBullets, key: 'kelas' },
    { to: '/admin/jadwal', label: 'Jadwal', icon: CalendarBlank, key: 'jadwal' },
    { to: '/admin/audit', label: 'Audit Log', icon: ShieldCheck, key: 'audit' },
    { to: '/profil', label: 'Profil', icon: UserCircle, key: 'profil' },
  ]

  const menu = role === 'admin' ? adminMenu : guruMenu
  const roleLabel = role === 'admin' ? 'Administrator' : 'Guru'

  const UserAvatar = () =>
    user?.foto_profil
      ? <img src={`/uploads/${user.foto_profil}`} alt={user.full_name || 'Foto profil'} className="user-avatar user-avatar-img" />
      : <div className="user-avatar" aria-hidden="true">{initials}</div>

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-row">
            <div className="sidebar-brand">
              <img src={logo} alt="Logo Absensi LT" className="sidebar-brand-img" />
              <h2>Absensi LT</h2>
            </div>
            <div className="sidebar-header-actions">
              <button
                className="theme-toggle"
                onClick={toggle}
                title={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
                aria-label="Ganti tema"
              >
                {theme === 'light' ? <Moon weight="duotone" /> : <Sun weight="duotone" />}
              </button>
              <button
                className="mobile-menu-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
                aria-expanded={menuOpen}
              >
                <List weight="bold" />
              </button>
              <button
                className="mobile-logout"
                onClick={handleLogout}
                aria-label="Keluar"
                title="Keluar"
              >
                <SignOut weight="bold" />
              </button>
            </div>
          </div>
          <div className="sidebar-header-meta">
            <span className="sidebar-header-sub">{role === 'admin' ? 'Panel Admin' : 'MTsN 1 Kebumen'}</span>
            <span className="sidebar-header-user">{user.full_name}</span>
          </div>
        </div>

        <nav className={`sidebar-menu ${menuOpen ? 'open' : ''}`} aria-label="Navigasi utama">
          <span className="sidebar-section-label">Menu</span>
          {menu.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                to={item.to}
                className={active === item.key ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <Icon weight={active === item.key ? 'bold' : 'regular'} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <UserAvatar />
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.full_name}</span>
              <span className="sidebar-user-role">{roleLabel}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-danger logout-btn">
            <SignOut weight="bold" />
            Keluar
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-date">{today}</div>
          <div className="topbar-user">
            <UserAvatar />
            <div className="sidebar-user-info">
              <span className="topbar-user-name">{user.full_name}</span>
              <span className="topbar-user-role">{roleLabel}</span>
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}

export default Layout
