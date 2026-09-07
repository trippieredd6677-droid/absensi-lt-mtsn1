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
  Trash,
  Image,
  PencilSimple,
  PlusCircle,
} from '@phosphor-icons/react'
import api from '../../api'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import { exportXlsx } from '../../utils/export'
import { NAMA_BULAN } from '../../constants'

// Format jam dari created_at → "HH:MM" (lokal)
const pad2 = (n) => String(n).padStart(2, '0')
const fmtJam = (iso) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

import './AdminAbsensi.css'

function AdminAbsensi({ user, onLogout }) {
  const [absensi, setAbsensi] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulan, setBulan] = useState(new Date().getMonth() + 1)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [guruId, setGuruId] = useState('')
  const [gurus, setGurus] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [editAbs, setEditAbs] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'hadir', catatan: '' })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ user_id: '', tanggal: new Date().toISOString().slice(0, 10), shift: 'siang', kelas: '', status: 'hadir', catatan: '' })

  useEffect(() => {
    fetchAbsensi()
  }, [bulan, tahun, page, guruId])

  // Ambil daftar guru untuk filter rekap per guru
  useEffect(() => {
    api.get('/admin/users?role=guru&limit=200')
      .then((res) => setGurus(res.data.users || []))
      .catch(() => {})
  }, [])

  const fetchAbsensi = async () => {
    try {
      setLoading(true)
      const guruParam = guruId ? `&user_id=${guruId}` : ''
      const response = await api.get(`/absensi?bulan=${bulan}&tahun=${tahun}&page=${page}&limit=30${guruParam}`)
      setAbsensi(response.data.absensi)
    } catch (err) {
      console.error('Error fetching absensi:', err)
      setMessage(err.response?.data?.message || 'Error loading data')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (absensiId) => {
    setPendingDelete({
      title: 'Hapus absensi?',
      message: 'Hapus data absensi ini? Tindakan tidak bisa dibatalkan.',
      confirmText: 'Hapus',
      danger: true,
      onConfirm: async () => {
        setPendingDelete(null)
        try {
          await api.delete(`/absensi/${absensiId}`)
          setMessage('Data absensi berhasil dihapus')
          setMessageType('success')
          fetchAbsensi()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Error deleting absensi')
          setMessageType('error')
        }
      },
    })
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkDelete = () => {
    if (selected.size === 0) return
    setPendingDelete({
      title: 'Hapus massal?',
      message: `Hapus ${selected.size} data absensi terpilih? Tindakan tidak bisa dibatalkan.`,
      confirmText: 'Hapus Semua',
      danger: true,
      onConfirm: async () => {
        setPendingDelete(null)
        try {
          for (const id of selected) {
            await api.delete(`/absensi/${id}`)
          }
          setMessage(`${selected.size} data absensi dihapus`)
          setMessageType('success')
          setSelected(new Set())
          fetchAbsensi()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal hapus massal')
          setMessageType('error')
        }
      },
    })
  }

  const openEdit = (abs) => {
    setEditAbs(abs)
    setEditForm({ status: abs.status, catatan: abs.catatan || '' })
  }

  const handleEditSave = async () => {
    try {
      await api.put(`/absensi/${editAbs.id}`, { status: editForm.status, catatan: editForm.catatan })
      setMessage('Absensi berhasil diperbarui')
      setMessageType('success')
      setEditAbs(null)
      fetchAbsensi()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memperbarui absensi')
      setMessageType('error')
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/absensi/admin-create', manualForm)
      setMessage('Absensi manual berhasil dibuat')
      setMessageType('success')
      setShowManual(false)
      setManualForm({ user_id: '', tanggal: new Date().toISOString().slice(0, 10), shift: 'siang', kelas: '', status: 'hadir', catatan: '' })
      fetchAbsensi()
    } catch (err) {
      setMessage(err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Gagal membuat absensi manual')
      setMessageType('error')
    }
  }

  const exportFull = async () => {
    try {
      const res = await api.get(`/admin/export?bulan=${bulan}&tahun=${tahun}${guruId ? `&user_id=${guruId}` : ''}`)
      const all = res.data.absensi || []
      if (all.length === 0) {
        setMessage('Tidak ada data untuk diekspor')
        setMessageType('error')
        return
      }
      const columns = ['Tanggal', 'Jam', 'Hari', 'Shift', 'Kelas', 'Guru', 'Status', 'Catatan']
      const rows = all.map(a => [
        new Date(a.tanggal).toLocaleDateString('id-ID'),
        fmtJam(a.created_at),
        a.hari,
        a.shift,
        a.kelas,
        a.guru_nama || '',
        a.status,
        a.catatan || '',
      ])
      exportXlsx({
        fileName: `laporan-absensi-lengkap-${bulan}-${tahun}.xlsx`,
        title: 'Laporan Data Absensi (Lengkap)',
        subtitle: `MTsN 1 Kebumen · ${NAMA_BULAN[bulan - 1]} ${tahun} · ${all.length} baris`,
        owner: user?.full_name,
        columns,
        rows,
        statusCols: [6],
      })
      setMessage(`Ekspor lengkap: ${all.length} baris`)
      setMessageType('success')
    } catch (err) {
      setMessage('Gagal ekspor lengkap')
      setMessageType('error')
    }
  }

  const exportReportFile = () => {
    if (absensi.length === 0) {
      setMessage('Tidak ada data untuk diekspor')
      setMessageType('error')
      return
    }

    const columns = ['Tanggal', 'Jam', 'Hari', 'Shift', 'Kelas', 'Guru', 'Status', 'Catatan']
    const rows = absensi.map(a => [
      new Date(a.tanggal).toLocaleDateString('id-ID'),
      fmtJam(a.created_at),
      a.hari,
      a.shift,
      a.kelas,
      a.guru_nama || '',
      a.status,
      a.catatan || '',
    ])
    exportXlsx({
      fileName: `laporan-absensi-${bulan}-${tahun}.xlsx`,
      title: 'Laporan Data Absensi',
      subtitle: `MTsN 1 Kebumen · Panel Admin · ${NAMA_BULAN[bulan - 1]} ${tahun}`,
      owner: user?.full_name,
      columns,
      rows,
      statusCols: [6],
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

  const summary = [
    { label: 'Total', value: absensi.length, icon: ClipboardText },
    { label: 'Hadir', value: absensi.filter(a => a.status === 'hadir').length, icon: CheckCircle },
    { label: 'Sakit', value: absensi.filter(a => a.status === 'sakit').length, icon: FirstAidKit },
    { label: 'Izin', value: absensi.filter(a => a.status === 'izin').length, icon: HandWaving },
    { label: 'Alpa', value: absensi.filter(a => a.status === 'alpa').length, icon: XCircle },
  ]

  return (
    <Layout user={user} onLogout={onLogout} role="admin" active="absensi">
      <div className="page-header">
        <h1>Data Absensi</h1>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`}>
          {message}
        </div>
      )}

      <div className="card">
        <div className="filter-export-section">
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

          <div className="filter-group">
            <label>Guru</label>
            <select value={guruId} onChange={(e) => { setGuruId(e.target.value); setPage(1); }}>
              <option value="">Semua Guru</option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id}>{g.full_name || g.username}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={exportFull} disabled={absensi.length === 0}>
            <DownloadSimple weight="duotone" /> Ekspor Lengkap
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setShowManual(true)}>
            <PlusCircle weight="duotone" /> Input Manual
          </button>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} dipilih</span>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
              <Trash weight="duotone" /> Hapus Terpilih
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Batal</button>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Loading...</p>
        ) : absensi.length > 0 ? (
          <>
            <div className="absensi-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="col-check"></th>
                    <th>Tanggal</th>
                    <th>Jam</th>
                    <th>Hari</th>
                    <th>Shift</th>
                    <th>Kelas</th>
                    <th>Guru</th>
                    <th>Status</th>
                    <th className="hide-mobile">Catatan</th>
                    <th>Foto</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {absensi.map((abs) => (
                    <tr key={abs.id}>
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={selected.has(abs.id)}
                          onChange={() => toggleSelect(abs.id)}
                        />
                      </td>
                      <td>{new Date(abs.tanggal).toLocaleDateString('id-ID')}</td>
                      <td>{fmtJam(abs.created_at)}</td>
                      <td>{abs.hari}</td>
                      <td className="capitalize">{abs.shift}</td>
                      <td>{abs.kelas}</td>
                      <td>{abs.guru_nama || '-'}</td>
                      <td>
                        <span className={`status-badge status-${abs.status}`}>
                          {abs.status}
                        </span>
                      </td>
                      <td className="catatan-col hide-mobile">{abs.catatan ? abs.catatan.substring(0, 30) + '...' : '-'}</td>
                      <td>
                        {abs.foto_kegiatan ? (
                          <a href={`/uploads/${abs.foto_kegiatan}`} target="_blank" rel="noopener noreferrer" className="photo-icon" title="Lihat foto">
                            <Image weight="duotone" />
                          </a>
                        ) : <span className="photo-none">-</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => openEdit(abs)}
                            className="btn-delete"
                            title="Ubah Status"
                          >
                            <PencilSimple weight="duotone" />
                          </button>
                          <button
                            onClick={() => handleDelete(abs.id)}
                            className="btn-delete"
                            title="Hapus"
                          >
                            <Trash weight="duotone" />
                          </button>
                        </div>
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
                disabled={absensi.length < 30}
              >
                Berikutnya <CaretRight weight="bold" />
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Tidak ada data absensi untuk periode ini</p>
        )}
      </div>

      <div className="stats-card">
        <h2>Ringkasan</h2>
        <div className="stats-summary">
          {summary.map((s) => {
            const SumIcon = s.icon
            return (
              <div className="summary-item" key={s.label}>
                <span className="label"><SumIcon weight="duotone" /> {s.label}</span>
                <span className="value">{s.value}</span>
              </div>
            )
          })}
        </div>
      </div>
      {/* Modal: Edit Status Absensi */}
      {editAbs && (
        <div className="modal-overlay" onClick={() => setEditAbs(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ubah Status Absensi #{editAbs.id}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>
              {editAbs.guru_nama || '-'} · {new Date(editAbs.tanggal).toLocaleDateString('id-ID')} · {editAbs.shift}
            </p>
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="hadir">Hadir</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
              <option value="alpa">Alpa</option>
            </select>
            <label className="form-label" style={{ marginTop: 12 }}>Catatan</label>
            <textarea
              className="form-input"
              rows="3"
              value={editForm.catatan}
              onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
              placeholder="Catatan (opsional)"
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditAbs(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditSave}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input Manual */}
      {showManual && (
        <div className="modal-overlay" onClick={() => setShowManual(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Input Absensi Manual</h2>
            <form onSubmit={handleManualSubmit}>
              <label className="form-label">Guru</label>
              <select
                className="form-input"
                value={manualForm.user_id}
                onChange={(e) => setManualForm({ ...manualForm, user_id: e.target.value })}
                required
              >
                <option value="">Pilih Guru</option>
                {gurus.map((g) => (
                  <option key={g.id} value={g.id}>{g.full_name || g.username}</option>
                ))}
              </select>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div>
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    className="form-input"
                    value={manualForm.tanggal}
                    onChange={(e) => setManualForm({ ...manualForm, tanggal: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Shift</label>
                  <select
                    className="form-input"
                    value={manualForm.shift}
                    onChange={(e) => setManualForm({ ...manualForm, shift: e.target.value })}
                  >
                    <option value="siang">Siang</option>
                    <option value="malam">Malam</option>
                  </select>
                </div>
              </div>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div>
                  <label className="form-label">Kelas</label>
                  <input
                    className="form-input"
                    value={manualForm.kelas}
                    onChange={(e) => setManualForm({ ...manualForm, kelas: e.target.value })}
                    placeholder="7A"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  >
                    <option value="hadir">Hadir</option>
                    <option value="sakit">Sakit</option>
                    <option value="izin">Izin</option>
                    <option value="alpa">Alpa</option>
                  </select>
                </div>
              </div>
              <label className="form-label" style={{ marginTop: 12 }}>Catatan</label>
              <textarea
                className="form-input"
                rows="2"
                value={manualForm.catatan}
                onChange={(e) => setManualForm({ ...manualForm, catatan: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowManual(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Buat</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete?.title}
        message={pendingDelete?.message}
        confirmText={pendingDelete?.confirmText || 'Hapus'}
        danger={pendingDelete?.danger}
        onConfirm={() => pendingDelete?.onConfirm?.()}
        onClose={() => setPendingDelete(null)}
      />
    </Layout>
  )
}

export default AdminAbsensi
