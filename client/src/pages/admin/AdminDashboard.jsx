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
  PaperPlaneTilt,
} from '@phosphor-icons/react'
import api from '../../api'
import Layout from '../../components/Layout'
import './AdminDashboard.css'

function AdminDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({})
  const [recent, setRecent] = useState([])
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [remindMsg, setRemindMsg] = useState('')
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

  const sendRemind = async (guruId, name) => {
    try {
      await api.post(`/admin/remind/${guruId}`)
      setRemindMsg(`Reminder tercatat untuk ${name}`)
      setTimeout(() => setRemindMsg(''), 3000)
    } catch (err) {
      setRemindMsg('Gagal mengirim reminder')
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
        <div className="stat-card accent-brand">
          <div className="stat-row">
            <span className="stat-label">Total Guru</span>
            <span className="stat-chip"><Users weight="duotone" /></span>
          </div>
          <div className="stat-value">{stats.totalGuru || 0}</div>
        </div>
        <div className="stat-card accent-brand">
          <div className="stat-row">
            <span className="stat-label">Belum Input</span>
            <span className="stat-chip"><Warning weight="duotone" /></span>
          </div>
          <div className="stat-value">{bdSummary.belum ?? notSubmitted.length}</div>
        </div>
        <div className="stat-card accent-brand">
          <div className="stat-row">
            <span className="stat-label">Absensi Hari Ini</span>
            <span className="stat-chip"><ClockCounterClockwise weight="duotone" /></span>
          </div>
          <div className="stat-value">{today.total || 0}</div>
        </div>
        <div className="stat-card accent-warn">
          <div className="stat-row">
            <span className="stat-label">Terlambat</span>
            <span className="stat-chip"><Alarm weight="duotone" /></span>
          </div>
          <div className="stat-value">{bdSummary.terlambat || 0}</div>
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
            <ClockCounterClockwise weight="duotone" /> Aktivitas Terbaru
          </h2>
          <div className="recent-feed">
            {recent.length === 0 ? (
              <p className="ns-empty">Belum ada aktivitas absensi.</p>
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
            <Warning weight="duotone" /> Guru Belum Input ({bdSummary.belum ?? notSubmitted.length})
          </h2>
          {notSubmitted.length > 0 ? (
            <ul className="not-submitted">
              {notSubmitted.map((g) => (
                <li key={g.id}>
                  <span className="ns-left">
                    <span className="ns-name">{g.full_name || g.username}</span>
                    {g.username && <span className="ns-user">@{g.username}</span>}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    title="Kirim reminder"
                    onClick={() => sendRemind(g.id, g.full_name || g.username)}
                  >
                    <PaperPlaneTilt weight="duotone" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ns-empty">Semua guru sudah input absensi hari ini.</p>
          )}

          {lateList.length > 0 && (
            <>
              <h2 style={{ marginTop: '22px' }}>
                <Alarm weight="duotone" /> Terlambat ({lateList.length})
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

      {remindMsg && <div className="alert alert-success" style={{ marginTop: 16 }}>{remindMsg}</div>}

      <div className="admin-actions">
        <div className="adm-quick" onClick={() => navigate('/admin/users')}>
          <div className="adm-quick-icon"><Users weight="duotone" /></div>
          <div className="adm-quick-text">
            <h3>Manajemen Guru</h3>
            <p>Kelola akun guru dan data pribadi</p>
          </div>
          <ArrowRight weight="bold" className="adm-quick-arrow" />
        </div>
        <div className="adm-quick" onClick={() => navigate('/admin/absensi')}>
          <div className="adm-quick-icon"><ClipboardText weight="duotone" /></div>
          <div className="adm-quick-text">
            <h3>Data Absensi</h3>
            <p>Lihat dan kelola data absensi</p>
          </div>
          <ArrowRight weight="bold" className="adm-quick-arrow" />
        </div>
        <div className="adm-quick" onClick={() => navigate('/admin/kelas')}>
          <div className="adm-quick-icon"><ListBullets weight="duotone" /></div>
          <div className="adm-quick-text">
            <h3>Kelola Kelas</h3>
            <p>Atur kelas &amp; shift untuk input absensi</p>
          </div>
          <ArrowRight weight="bold" className="adm-quick-arrow" />
        </div>
        <div className="adm-quick" onClick={() => navigate('/admin/audit')}>
          <div className="adm-quick-icon"><ShieldCheck weight="duotone" /></div>
          <div className="adm-quick-text">
            <h3>Audit Log</h3>
            <p>Jejak aktivitas pengguna</p>
          </div>
          <ArrowRight weight="bold" className="adm-quick-arrow" />
        </div>
      </div>
    </Layout>
  )
}

export default AdminDashboard
