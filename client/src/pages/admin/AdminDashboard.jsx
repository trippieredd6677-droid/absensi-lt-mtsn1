import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  ClipboardText,
  CheckCircle,
  ArrowRight,
  Warning,
  ClockCounterClockwise,
  ListBullets,
  ShieldCheck,
  Alarm,
} from '@phosphor-icons/react'
import { IconAlarm, IconAlertTriangle, IconArrowRight, IconClipboardCheck, IconHistory, IconListDetails, IconShieldCheck, IconUsers } from '@tabler/icons-react'
import api from '../../api'
import Layout from '../../components/Layout'
import EmptyState from '../../components/EmptyState'
import './AdminDashboard.css'

function AdminDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({})
  const [recent, setRecent] = useState([])
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const [dash, rec, bd] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/absensi?limit=5'),
        api.get('/admin/guru-breakdown'),
      ])
      setStats(dash.data)
      setRecent(rec.data.absensi || [])
      setBreakdown(bd.data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  const today = stats.today || {}
  const trend = stats.trend || []
  const maxTrend = Math.max(1, ...trend.map((t) => t.count))
  const notSubmitted = stats.notSubmitted || []

  const bdSummary = breakdown?.summary || {}
  const lateList = (breakdown?.breakdown || []).filter((b) => b.late)

  const statusChips = [
    { key: 'hadir', label: 'Hadir', color: 'var(--status-hadir)' },
    { key: 'sakit', label: 'Sakit', color: 'var(--status-sakit)' },
    { key: 'izin', label: 'Izin', color: 'var(--status-izin)' },
    { key: 'alpa', label: 'Alpa', color: 'var(--status-alpa)' },
  ]

  return (
    <Layout user={user} onLogout={onLogout} role="admin" active="dashboard">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Total Guru</span>
            <span className="stat-chip"><IconUsers size={16} stroke={1.8} /></span>
          </div>
          <div className="stat-value">{stats.totalGuru || 0}</div>
          <div className="sparkline"><div className="sparkline-fill" style={{ width: `${Math.min(100, (stats.totalGuru || 0) / 70 * 100)}%` }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Belum Input</span>
            <span className="stat-chip"><IconAlertTriangle size={16} stroke={1.8} /></span>
          </div>
          <div className="stat-value">{bdSummary.belum ?? notSubmitted.length}</div>
          <div className="sparkline"><div className="sparkline-fill" style={{ width: `${Math.min(100, (bdSummary.belum ?? notSubmitted.length) / 20 * 100)}%`, background: 'var(--status-sakit)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Absensi Hari Ini</span>
            <span className="stat-chip"><IconHistory size={16} stroke={1.8} /></span>
          </div>
          <div className="stat-value">{today.total || 0}</div>
          <div className="sparkline"><div className="sparkline-fill" style={{ width: `${Math.min(100, (today.total || 0) / 30 * 100)}%` }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-row">
            <span className="stat-label">Terlambat</span>
            <span className="stat-chip"><IconAlarm size={16} stroke={1.8} /></span>
          </div>
          <div className="stat-value">{bdSummary.terlambat || 0}</div>
          <div className="sparkline"><div className="sparkline-fill" style={{ width: `${Math.min(100, (bdSummary.terlambat || 0) / 10 * 100)}%`, background: 'var(--status-alpa)' }} /></div>
        </div>
      </div>

      <div className="dash-cols">
        <div className="card dash-panel">
          <h2>Status Hari Ini</h2>
          <div className="status-chips">
            {statusChips.map((s) => (
              <div className="status-chip" key={s.key}>
                <span className="dot" style={{ background: s.color }} />
                <span className="chip-label">{s.label}</span>
                <span className="chip-value" style={{ color: s.color }}>{today[s.key] || 0}</span>
              </div>
            ))}
          </div>
          <h2 style={{ marginTop: '22px' }}>Tren 7 Hari Terakhir</h2>
          <div className="trend-bars">
            {trend.map((t) => (
              <div className="trend-col" key={t.tanggal} title={`${t.tanggal}: ${t.count} absensi`}>
                <span className="trend-value">{t.count}</span>
                <div className="trend-bar" style={{ height: `${(t.count / maxTrend) * 100}%` }} />
                <span className="trend-label">{t.tanggal.slice(8, 10)}/{t.tanggal.slice(5, 7)}</span>
              </div>
            ))}
          </div>
          <h2 style={{ marginTop: '22px' }}>
            <IconHistory size={16} stroke={1.8} /> Aktivitas Terbaru
          </h2>
          <div className="recent-feed">
            {recent.length === 0 ? (
              <EmptyState icon={ClockCounterClockwise} title="Belum ada aktivitas" description="Absensi hari ini belum ada. Aktivitas guru akan muncul di sini." />
            ) : (
              recent.map((r) => (
                <div className="recent-item" key={r.id}>
                  <span className="recent-name">{r.guru_nama || '-'}</span>
                  <span className="recent-meta">{r.kelas} · {r.status}</span>
                  <span className="recent-time">{r.created_at ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card dash-panel">
          <h2>
            Guru Belum Input ({bdSummary.belum ?? notSubmitted.length})
          </h2>
          {notSubmitted.length > 0 ? (
            <ul className="not-submitted">
              {notSubmitted.map((g) => (
                <li key={g.id}>
                  <span className="ns-left">
                    <span className="ns-name">{g.full_name || g.username}</span>
                    {g.username && <span className="ns-user">@{g.username}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle} title="Semua sudah input" description="Tidak ada guru yang tertinggal hari ini. Rekap sudah lengkap." />
          )}

          {lateList.length > 0 && (
            <>
              <h2 style={{ marginTop: '22px' }}>
                <IconAlarm size={16} stroke={1.8} /> Terlambat ({lateList.length})
              </h2>
              <ul className="late-list">
                {lateList.map((g) => (
                  <li key={g.id}>
                    <span className="ns-name">{g.full_name}</span>
                    <span className="late-tag">shift {g.shift}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="admin-actions">
        <div className="adm-quick" onClick={() => navigate('/admin/users')}>
          <div className="adm-quick-icon"><IconUsers size={16} stroke={1.8} /></div>
          <div className="adm-quick-text">
            <h3>Manajemen Guru</h3>
            <p>Kelola akun guru dan data pribadi</p>
          </div>
          <IconArrowRight size={16} stroke={1.8} className="adm-quick-arrow" />
        </div>
        <div className="adm-quick" onClick={() => navigate('/admin/absensi')}>
          <div className="adm-quick-icon"><IconClipboardCheck size={16} stroke={1.8} /></div>
          <div className="adm-quick-text">
            <h3>Data Absensi</h3>
            <p>Lihat dan kelola data absensi</p>
          </div>
          <IconArrowRight size={16} stroke={1.8} className="adm-quick-arrow" />
        </div>
        <div className="adm-quick" onClick={() => navigate('/admin/kelas')}>
          <div className="adm-quick-icon"><IconListDetails size={16} stroke={1.8} /></div>
          <div className="adm-quick-text">
            <h3>Kelola Kelas</h3>
            <p>Atur kelas &amp; shift untuk input absensi</p>
          </div>
          <IconArrowRight size={16} stroke={1.8} className="adm-quick-arrow" />
        </div>
        <div className="adm-quick" onClick={() => navigate('/admin/audit')}>
          <div className="adm-quick-icon"><IconShieldCheck size={16} stroke={1.8} /></div>
          <div className="adm-quick-text">
            <h3>Audit Log</h3>
            <p>Jejak aktivitas pengguna</p>
          </div>
          <IconArrowRight size={16} stroke={1.8} className="adm-quick-arrow" />
        </div>
      </div>
    </Layout>
  )
}

export default AdminDashboard
