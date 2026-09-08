import React, { useState, useEffect } from 'react'
import {
  ClipboardText,
  CheckCircle,
  FirstAidKit,
  HandWaving,
  XCircle,
  DownloadSimple,
  CaretLeft,
  CaretRight,
  Image,
} from '@phosphor-icons/react'
import api from '../api'
import Layout from '../components/Layout'
import { exportXlsx } from '../utils/export'
import { NAMA_BULAN } from '../constants'

import './Histori.css'

function Histori({ user, onLogout }) {
  const [absensi, setAbsensi] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulan, setBulan] = useState(new Date().getMonth() + 1)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchHistori()
  }, [bulan, tahun, page])

  const fetchHistori = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/absensi?bulan=${bulan}&tahun=${tahun}&page=${page}&limit=20`)
      setAbsensi(response.data.absensi)
    } catch (err) {
      console.error('Error fetching history:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportReportFile = () => {
    if (absensi.length === 0) return
    const columns = ['Tanggal', 'Hari', 'Shift', 'Kelas', 'Status', 'Catatan']
    const rows = absensi.map(a => [
      new Date(a.tanggal).toLocaleDateString('id-ID'),
      a.hari,
      a.shift,
      a.kelas || '',
      a.status,
      (a.catatan || '').replace(/\n/g, ' '),
    ])
    const period = `${NAMA_BULAN[bulan - 1]} ${tahun}`
    exportXlsx({
      fileName: `laporan-absensi-${bulan}-${tahun}.xlsx`,
      title: 'Laporan Rekap Absensi',
      subtitle: `MTsN 1 Kebumen · ${period}`,
      owner: user?.full_name,
      columns,
      rows,
      statusCols: [4],
    })
  }

  const bulanList = [
    { val: 1, label: 'Januari' },
    { val: 2, label: 'Februari' },
    { val: 3, label: 'Maret' },
    { val: 4, label: 'April' },
    { val: 5, label: 'Mei' },
    { val: 6, label: 'Juni' },
    { val: 7, label: 'Juli' },
    { val: 8, label: 'Agustus' },
    { val: 9, label: 'September' },
    { val: 10, label: 'Oktober' },
    { val: 11, label: 'November' },
    { val: 12, label: 'Desember' },
  ]

  const stats = [
    { label: 'Total', value: absensi.length, icon: ClipboardText },
    { label: 'Hadir', value: absensi.filter(a => a.status === 'hadir').length, icon: CheckCircle },
    { label: 'Sakit', value: absensi.filter(a => a.status === 'sakit').length, icon: FirstAidKit },
    { label: 'Izin', value: absensi.filter(a => a.status === 'izin').length, icon: HandWaving },
    { label: 'Alpa', value: absensi.filter(a => a.status === 'alpa').length, icon: XCircle },
  ]

  return (
    <Layout user={user} onLogout={onLogout} role={user?.role} active="histori">
      <div className="page-header histori-header">
        <div>
          <h1>Histori</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={exportReportFile} disabled={absensi.length === 0}>
            <DownloadSimple weight="duotone" /> Ekspor Laporan
          </button>
        </div>
      </div>

      <div className="stats-section">
        <h2>Statistik</h2>
        <div className="histori-stats-grid">
          {stats.map((s) => {
            const StatIcon = s.icon
            return (
              <div className="stat-card" key={s.label}>
                <h3><StatIcon weight="duotone" /> {s.label}</h3>
                <div className={`value ${s.cls || ''}`}>{s.value}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="filter-section">
          <div className="filter-group">
            <label>Bulan</label>
            <select value={bulan} onChange={(e) => { setBulan(parseInt(e.target.value)); setPage(1); }}>
              {bulanList.map(b => (
                <option key={b.val} value={b.val}>{b.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Tahun</label>
            <select value={tahun} onChange={(e) => { setTahun(parseInt(e.target.value)); setPage(1); }}>
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Loading...</p>
        ) : absensi.length > 0 ? (
          <>
            <div className="histori-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Hari</th>
                    <th>Shift</th>
                    <th>Kelas</th>
                    <th>Status</th>
                    <th className="hide-mobile">Catatan</th>
                    <th>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {absensi.map((abs) => (
                    <tr key={abs.id}>
                      <td>{new Date(abs.tanggal).toLocaleDateString('id-ID')}</td>
                      <td>{abs.hari}</td>
                      <td className="capitalize">{abs.shift}</td>
                      <td>{abs.kelas}</td>
                      <td>
                        <span className={`status-badge status-${abs.status}`}>
                          {abs.status}
                        </span>
                      </td>
                      <td className="catatan-col hide-mobile">{abs.catatan || '-'}</td>
                      <td>
                        {abs.foto_kegiatan ? (
                          <a href={`/uploads/${abs.foto_kegiatan}`} target="_blank" rel="noopener noreferrer" className="photo-icon" title="Lihat foto">
                            <Image weight="duotone" />
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                className="btn btn-secondary"
                disabled={page === 1}
              >
                <CaretLeft weight="bold" /> Sebelumnya
              </button>
              <span className="page-info">Halaman {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                className="btn btn-secondary"
                disabled={absensi.length < 20}
              >
                Berikutnya <CaretRight weight="bold" />
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Tidak ada data absensi untuk periode ini</p>
        )}
      </div>
    </Layout>
  )
}

export default Histori
