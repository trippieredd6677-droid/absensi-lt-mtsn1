import React, { useState, useEffect } from 'react'
import {
  CheckCircle,
  FirstAidKit,
  HandWaving,
  XCircle,
  CalendarBlank,
  ClipboardText,
} from '@phosphor-icons/react'
import api from '../api'
import Layout from '../components/Layout'
import EmptyState from '../components/EmptyState'
import './Dashboard.css'

const DAY_NAMES = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function Dashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [jadwal, setJadwal] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  // Ambil statistik; kalau bulan ini kosong, fallback ke bulan lalu agar dashboard tidak kosong
  const fetchData = async () => {
    const now = new Date()
    let m = now.getMonth() + 1
    let y = now.getFullYear()
    try {
      let res = await api.get(`/absensi/stats?bulan=${m}&tahun=${y}`)
      if (res.data.total === 0) {
        m = m === 1 ? 12 : m - 1
        y = m === 12 ? y - 1 : y
        res = await api.get(`/absensi/stats?bulan=${m}&tahun=${y}`)
      }
      setStats(res.data)
      const rec = await api.get('/absensi?limit=5')
      setRecent(rec.data.absensi || [])
      const jw = await api.get('/jadwal/saya')
      setJadwal(jw.data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  const minis = [
    { key: 'hadir', label: 'Hadir', icon: CheckCircle, cls: 'hadir' },
    { key: 'sakit', label: 'Sakit', icon: FirstAidKit, cls: 'sakit' },
    { key: 'izin', label: 'Izin', icon: HandWaving, cls: 'izin' },
    { key: 'alpa', label: 'Alpa', icon: XCircle, cls: 'alpa' },
  ]
  const todayName = DAY_NAMES[new Date().getDay()]
  const todayJadwal = jadwal.filter((j) => j.hari === todayName)
  const periode = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <Layout user={user} onLogout={onLogout} role={user?.role} active="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-header-sub">Rekap kehadiran bulan {periode}</p>
      </div>

      <div className="dash-hero">
        <div className="dash-hero-main">
          <span className="dash-hero-label">Persentase Kehadiran</span>
          <div className="dash-hero-value">{stats ? stats.persenHadir : 0}%</div>
          <p className="dash-hero-sub">
            {stats ? stats.hadir : 0} dari {stats ? stats.total : 0} hari kerja tercatat hadir
          </p>
        </div>
        <div className="dash-hero-stats">
          {minis.map((c) => {
            const Icon = c.icon
            return (
              <div className="dash-mini" key={c.key}>
                <span className="dash-mini-label"><Icon weight="regular" /> {c.label}</span>
                <div className={`dash-mini-value ${c.cls}`}>{stats ? stats[c.key] : 0}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dash-cols">
        <div className="card">
          <h2>Jadwal Hari Ini · {todayName}</h2>
          {todayJadwal.length === 0 ? (
            <EmptyState icon={CalendarBlank} title="Libur hari ini" description="Tidak ada jadwal layanan untuk hari ini. Nikmati waktunya!" />
          ) : (
            <div className="dash-jadwal">
              {todayJadwal.map((j, i) => (
                <div key={i} className="dash-jadwal-day">
                  <span className="dash-jadwal-hari">{j.jam}</span>
                  <div className="dash-jadwal-items">
                    <span className="dash-jadwal-item">
                      <strong>{j.kelas}</strong>
                      {j.jenis_layanan && <em> · {j.jenis_layanan}</em>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Absensi Terbaru</h2>
          {recent.length > 0 ? (
            <div className="table-wrap">
              <table className="table dash-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jam LT</th>
                    <th>Kelas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((abs) => (
                    <tr key={abs.id}>
                      <td>{new Date(abs.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={{ textTransform: 'capitalize' }}>{abs.shift}</td>
                      <td>{abs.kelas || '-'}</td>
                      <td>
                        <span className={`status-badge status-${abs.status}`} style={{ textTransform: 'capitalize' }}>
                          {abs.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ClipboardText} title="Belum ada absensi" description="Belum ada data absensi. Isi absensi pertama di menu Absensi." action={<a href="/absensi" className="btn btn-primary btn-sm">Isi Absensi</a>} />
          )}
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard
