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
  PlusCircle,
  UploadSimple,
  CalendarBlank,
} from "@phosphor-icons/react"
import { IconChevronLeft, IconChevronRight, IconCirclePlus, IconDownload, IconPencil, IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react'
import api from '../../api'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import EmptyState from '../../components/EmptyState'
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
  const [saving, setSaving] = useState(false)
  const [editAbs, setEditAbs] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'hadir', catatan: '' })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ user_id: '', tanggal: new Date().toISOString().slice(0, 10), shift: '', kelas: '', status: 'hadir', catatan: '' })
  const [manualFoto, setManualFoto] = useState(null)

  useEffect(() => {
    fetchAbsensi()
  }, [bulan, tahun, page, guruId])

  // Ambil daftar guru untuk filter rekap per guru
  useEffect(() => {
    api.get('/admin/users?role=guru&limit=200')
      .then((res) => setGurus(res.data.users || []))
      .catch(() => {})
  }, [])

  const [kelasList, setKelasList] = useState([])
  const [jamLtList, setJamLtList] = useState([])
  useEffect(() => {
    api.get('/kelas').then((r) => setKelasList(r.data.kelas || [])).catch(() => {})
    api.get('/shift/jam-lt').then((r) => setJamLtList(r.data.jam_lt || [])).catch(() => {})
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
        setSaving(true)
        try {
          await api.delete(`/absensi/${absensiId}`)
          setPendingDelete(null)
          setMessage('Data absensi berhasil dihapus')
          setMessageType('success')
          fetchAbsensi()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Error deleting absensi')
          setMessageType('error')
        } finally {
          setSaving(false)
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
    const count = selected.size
    setPendingDelete({
      title: 'Hapus massal?',
      message: `Hapus ${count} data absensi terpilih? Tindakan tidak bisa dibatalkan.`,
      confirmText: 'Hapus Semua',
      danger: true,
      onConfirm: async () => {
        setSaving(true)
        try {
          const ids = [...selected]
          const results = await Promise.allSettled(ids.map((id) => api.delete(`/absensi/${id}`)))
          const ok = results.filter((r) => r.status === 'fulfilled').length
          const fail = results.length - ok
          setPendingDelete(null)
          if (fail === 0) {
            setMessage(`${ok} data absensi dihapus`)
            setMessageType('success')
          } else {
            setMessage(`${ok} berhasil, ${fail} gagal dihapus`)
            setMessageType(fail === results.length ? 'error' : 'success')
          }
          setSelected(new Set())
          fetchAbsensi()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal hapus massal')
          setMessageType('error')
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const openEdit = (abs) => {
    setEditAbs(abs)
    setEditForm({ status: abs.status, catatan: abs.catatan || '' })
  }

  const handleEditSave = async () => {
    const dirty = editForm.status !== editAbs.status || String(editForm.catatan || '') !== String(editAbs.catatan || '')
    if (!dirty) {
      setMessage('Tidak ada perubahan')
      setMessageType('info')
      return
    }
    setPendingDelete({
      title: 'Simpan perubahan?',
      message: `Yakin ubah status menjadi "${editForm.status}"?`,
      confirmText: 'Simpan',
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.put(`/absensi/${editAbs.id}`, { status: editForm.status, catatan: editForm.catatan })
          setPendingDelete(null)
          setMessage('Absensi berhasil diperbarui')
          setMessageType('success')
          setEditAbs(null)
          fetchAbsensi()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal memperbarui absensi')
          setMessageType('error')
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const compressImage = (file) => new Promise((resolve) => {
    if (file.type === 'application/pdf') return resolve(file)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 900
      let { width, height } = img
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        resolve(blob || file)
      }, 'image/jpeg', 0.75)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })

  const handleManualFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setMessage('Foto terlalu besar (maks 8MB)')
      setMessageType('error')
      e.target.value = ''
      return
    }
    const compressed = await compressImage(file)
    setManualFoto(compressed)
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('user_id', manualForm.user_id)
      fd.append('tanggal', manualForm.tanggal)
      fd.append('shift', manualForm.shift)
      fd.append('kelas', manualForm.kelas)
      fd.append('status', manualForm.status)
      fd.append('catatan', manualForm.catatan)
      if (manualFoto) {
        const ext = (manualFoto.name || '').split('.').pop() || (manualFoto.type === 'application/pdf' ? 'pdf' : 'jpg')
        fd.append('foto_kegiatan', manualFoto, `foto_kegiatan.${ext}`)
      }
      await api.post('/absensi/admin-create', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage('Absensi manual berhasil dibuat')
      setMessageType('success')
      setShowManual(false)
      setManualForm({ user_id: '', tanggal: new Date().toISOString().slice(0, 10), shift: '', kelas: '', status: 'hadir', catatan: '' })
      setManualFoto(null)
      fetchAbsensi()
    } catch (err) {
      setMessage(err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Gagal membuat absensi manual')
      setMessageType('error')
    } finally {
      setSaving(false)
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
      const columns = ['Tanggal', 'Jam', 'Hari', 'Jam LT', 'Kelas', 'Guru', 'Status', 'Catatan']
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

    const columns = ['Tanggal', 'Jam', 'Hari', 'Jam LT', 'Kelas', 'Guru', 'Status', 'Catatan']
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
            <IconDownload size={16} stroke={1.8} /> Ekspor Lengkap
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setShowManual(true)}>
            <IconCirclePlus size={16} stroke={1.8} /> Input Manual
          </button>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} dipilih</span>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={saving}>
              <IconTrash size={16} stroke={1.8} /> Hapus Terpilih
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())} disabled={saving}>Batal</button>
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
                    <th>Jam LT</th>
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
                            <IconPhoto size={16} stroke={1.8} />
                          </a>
                        ) : <span className="photo-none">-</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => openEdit(abs)}
                            className="btn-action btn-edit"
                            title="Ubah Status"
                          >
                            <IconPencil size={16} stroke={1.8} />
                          </button>
                          <button
                            onClick={() => handleDelete(abs.id)}
                            className="btn-action btn-delete"
                            title="Hapus"
                          >
                            <IconTrash size={16} stroke={1.8} />
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
                <IconChevronLeft size={16} stroke={1.8} /> Sebelumnya
              </button>
              <span className="page-info">Halaman {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                className="btn btn-secondary"
                disabled={absensi.length < 30}
              >
                Berikutnya <IconChevronRight size={16} stroke={1.8} />
              </button>
            </div>
          </>
        ) : (
          <EmptyState icon={CalendarBlank} title="Belum ada absensi" description="Tidak ada data untuk periode ini. Sesuaikan filter bulan/tahun atau buat input manual." />
        )}
      </div>

      <div className="stats-card">
        <h2>Ringkasan</h2>
        <div className="stats-summary">
          {summary.map((s) => {
            const SumIcon = s.icon
            return (
              <div className="summary-item" key={s.label}>
                <span className="label"><SumIcon weight="regular" /> {s.label}</span>
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
              <button className="btn btn-secondary" onClick={() => setEditAbs(null)} disabled={saving}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input Manual */}
      {showManual && (
        <div className="modal-overlay" onClick={() => { setShowManual(false); setManualFoto(null) }}>
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
                  <label className="form-label">Jam LT</label>
                  <select
                    className="form-input"
                    value={manualForm.shift}
                    onChange={(e) => setManualForm({ ...manualForm, shift: e.target.value })}
                    required
                  >
                    <option value="">Pilih Jam LT</option>
                    {jamLtList.map((j) => (
                      <option key={j.id} value={j.nama}>{j.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div>
                  <label className="form-label">Kelas</label>
                  <select
                    className="form-input"
                    value={manualForm.kelas}
                    onChange={(e) => setManualForm({ ...manualForm, kelas: e.target.value })}
                    required
                  >
                    <option value="">Pilih Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.nama}>{k.nama}</option>
                    ))}
                  </select>
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
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Foto Kegiatan <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(opsional)</span></label>
                <label className="file-input-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface-2)', cursor: 'pointer', transition: 'border-color 0.16s, background 0.16s' }}>
                  <input type="file" accept="image/*,.pdf" onChange={handleManualFileChange} style={{ display: 'none' }} />
                  <span className={`file-label ${manualFoto ? 'has-file' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: manualFoto ? 'var(--accent)' : 'var(--text-muted)', fontWeight: manualFoto ? 600 : 500 }}>
                    <IconUpload size={16} stroke={1.8} />
                    {manualFoto ? (manualFoto.name || 'Foto siap diunggah') : 'Pilih foto kegiatan atau seret ke sini'}
                  </span>
                </label>
                <p className="form-hint" style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-faint)' }}>JPG, PNG, GIF, WEBP, PDF — maks 8MB, otomatis dikompres</p>
              </div>
              <label className="form-label" style={{ marginTop: 12 }}>
                Catatan <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows="2"
                value={manualForm.catatan}
                onChange={(e) => setManualForm({ ...manualForm, catatan: e.target.value })}
                required
                placeholder="Tuliskan kegiatan yang dilakukan"
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowManual(false); setManualFoto(null) }} disabled={saving}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Membuat...' : 'Buat'}</button>
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
        loading={saving}
        onConfirm={() => pendingDelete?.onConfirm?.()}
        onClose={() => !saving && setPendingDelete(null)}
      />
    </Layout>
  )
}

export default AdminAbsensi
