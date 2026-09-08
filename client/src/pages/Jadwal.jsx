import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { CalendarBlank, MagnifyingGlass, TreeStructure, PencilSimple, Trash, Plus, UploadSimple, X, DownloadSimple } from '@phosphor-icons/react'
import api from '../api'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import './Jadwal.css'

const HARI_ORDER = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const SLOT_ORDER = ['13.00 - 14.20', '13.00 - 15.20', '14.00 - 15.20', '14.10 - 15.30', '18.30 - 19.50']

function Jadwal({ user, onLogout, role }) {
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState(isAdmin ? 'guru' : 'grid')
  const [guruMap, setGuruMap] = useState([])
  const [mine, setMine] = useState([])
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)

  // search debounce for guru tab
  const [qRaw, setQRaw] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setQ(qRaw.trim().toLowerCase()), 300)
    return () => clearTimeout(h)
  }, [qRaw])

  const [filterLayanan, setFilterLayanan] = useState('')

  // state for managing jadwal of a selected guru (staged list / pending save)
  const [selectedGuru, setSelectedGuru] = useState(null)
  const [stagedJadwal, setStagedJadwal] = useState([])
  const [editIdx, setEditIdx] = useState(null)
  const [newHari, setNewHari] = useState('')
  const [newJam, setNewJam] = useState('')
  const [newKelas, setNewKelas] = useState('')
  const [newJenis, setNewJenis] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // state for grid cell editor (admin) — lets admin add/edit jadwal per slot with Simpan button
  const [editCell, setEditCell] = useState(null) // {hari, slot}
  const [cellKelas, setCellKelas] = useState('')
  const [cellKode, setCellKode] = useState('')
  const [cellJenis, setCellJenis] = useState('')
  const [cellEditing, setCellEditing] = useState(false)
  const [cellEditId, setCellEditId] = useState(null)

  // state for kelas list from database
  const [dbKelasList, setDbKelasList] = useState([])
  const [toastMsg, setToastMsg] = useState('')

  const load = useCallback(async (forceAll = false) => {
    try {
      const [gm, my, kl, al] = await Promise.all([
        api.get('/jadwal/guru-map'),
        api.get('/jadwal/saya'),
        api.get('/kelas').catch(() => ({ data: { kelas: [] } })),
        api.get('/jadwal')
      ])
      setGuruMap(gm.data)
      setMine(my.data)
      if (kl.data?.kelas) {
        setDbKelasList(kl.data.kelas.map(k => k.nama))
      }
      if (al.data) {
        setAll(al.data)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // list of unique jeniss for guru tab filter
  const types = useMemo(() => [...new Set(guruMap.map(g => g.jenis_layanan).filter(Boolean))].sort(), [guruMap])
  // list of unique kelas for dropdown — strictly individual unit classes, no grouping
  const kelasList = useMemo(() => {
    const raw = [...dbKelasList, ...all.map(r => r.kelas).filter(Boolean)]
    return [...new Set(raw.map(k => (k || '').trim()))].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [dbKelasList, all])

  // filtered guru list for guru tab (search + jenis filter)
  const filteredGuru = useMemo(() => guruMap.filter(g => {
    const mq = !q || g.nama_guru.toLowerCase().includes(q) || g.kode.toLowerCase().includes(q) || (g.jenis_layanan || '').toLowerCase().includes(q)
    return mq && (!filterLayanan || g.jenis_layanan === filterLayanan)
  }), [guruMap, q, filterLayanan])

  // map guru -> set of kelas they teach (from all jadwal)
  const guruKelasMap = useMemo(() => {
    const map = new Map()
    all.forEach(r => {
      if (!r.kode_guru) return
      if (!map.has(r.kode_guru)) map.set(r.kode_guru, new Set())
      const set = map.get(r.kode_guru)
      set.add(r.kelas)
    })
    return map
  }, [all])

  // matrix for grid view (hari|jam -> list of {kelas, jenis, ket, guru, kode_guru, id, mine})
  const myKode = user?.guru_map_kode || null
  const matrix = useMemo(() => {
    const source = isAdmin ? all : mine
    const m = {}
    for (const r of source) {
      const k = `${r.hari}|${r.jam}`
      ;(m[k] = m[k] || []).push({
        kelas: r.kelas,
        jenis: r.jenis_layanan || '',
        ket: r.keterangan || '',
        gender: r.gender_target || 'Campur',
        guru: r.nama_guru || '',
        kode_guru: r.kode_guru || '',
        id: r.id,
        mine: !!myKode && r.kode_guru === myKode
      })
    }
    return m
  }, [all, mine, isAdmin, myKode])

  const buildCell = (hari, slot) => {
    const items = matrix[`${hari}|${slot}`] || []
    if (items.length === 0) return <span className="jw-empty">–</span>
    return <div className="jw-cells">{items.map((it, i) => (
      <div key={i} className={`jw-cell ${it.mine ? 'jw-cell-mine' : ''}`}>
        <strong>{it.kelas}{it.gender && it.gender !== 'Campur' ? <span className={`jw-tag jw-${it.gender.toLowerCase()}`}>{it.gender}</span> : null}</strong>
        {(it.ket || it.jenis) && <span className="jw-sub jw-activity">{it.ket || it.jenis}</span>}
        {it.guru && <span className="jw-sub jw-guru">{it.guru}</span>}
      </div>
    ))}</div>
  }

  const openAturJadwal = (g) => {
    setSelectedGuru(g)
    const existing = all.filter(r => r.kode_guru === g.kode)
    setStagedJadwal(existing.map(r => ({ ...r })))
    setEditIdx(null)
    setNewHari('')
    setNewJam('')
    setNewKelas('')
    setNewJenis('')
    setHasUnsavedChanges(false)
  }

  // ===== Handler: Tambah kelas ke daftar lokal guru ini (belum ke DB) =====
  const handleTambahKelas = (e) => {
    if (e) e.preventDefault()
    if (!selectedGuru) return
    if (!newHari || !newJam || !newKelas) {
      setConfirmAction({ type: 'info', message: 'Pilih Hari, Jam, dan Kelas terlebih dahulu.', confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
      return
    }

    if (editIdx !== null) {
      // Update baris yang sedang diedit di staged list
      const updated = [...stagedJadwal]
      updated[editIdx] = {
        ...updated[editIdx],
        hari: newHari,
        jam: newJam,
        kelas: newKelas,
        keterangan: newJenis || selectedGuru.jenis_layanan || ''
      }
      setStagedJadwal(updated)
      setEditIdx(null)
    } else {
      // Cek duplikat slot di dalam staged list guru ini
      const isDup = stagedJadwal.some(s => s.hari === newHari && s.jam === newJam && s.kelas === newKelas)
      if (isDup) {
        setConfirmAction({ type: 'info', message: `Slot ${newHari} ${newJam} kelas ${newKelas} sudah ada dalam daftar jadwal guru ini.`, confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
        return
      }
      setStagedJadwal(prev => [
        ...prev,
        {
          _tempId: Date.now(),
          hari: newHari,
          jam: newJam,
          kelas: newKelas,
          keterangan: newJenis || selectedGuru.jenis_layanan || '',
          kode_guru: selectedGuru.kode
        }
      ])
    }

    setNewHari('')
    setNewJam('')
    setNewKelas('')
    setNewJenis('')
    setHasUnsavedChanges(true)
  }

  // Edit salah satu baris di staged list
  const handleEditStaged = (item, idx) => {
    setEditIdx(idx)
    setNewHari(item.hari)
    setNewJam(item.jam)
    setNewKelas(item.kelas)
    setNewJenis(item.keterangan || item.jenis_layanan || '')
  }

  // Batal edit baris
  const handleBatalEditBaris = () => {
    setEditIdx(null)
    setNewHari('')
    setNewJam('')
    setNewKelas('')
    setNewJenis('')
  }

  // Hapus baris dari staged list
  const handleDeleteStaged = (idx) => {
    setStagedJadwal(prev => prev.filter((_, i) => i !== idx))
    if (editIdx === idx) {
      handleBatalEditBaris()
    }
    setHasUnsavedChanges(true)
  }

  // ===== Handler: Simpan SEMUA perubahan ke database =====
  const handleSimpanSemuaPerubahan = async (replaceConflicts = false) => {
    if (!selectedGuru) return
    setSaving(true)
    try {
      await api.put(`/jadwal/by-guru/${selectedGuru.kode}`, {
        schedules: stagedJadwal,
        replace_conflicts: replaceConflicts
      })
      await load(true)
      setSelectedGuru(null)
      setHasUnsavedChanges(false)
      setConfirmAction(null)
      setToastMsg(`Semua perubahan jadwal untuk ${selectedGuru.nama_guru} berhasil disimpan dan disinkronkan!`)
      setTimeout(() => setToastMsg(''), 5000)
    } catch (err) {
      const d = err.response?.data
      if (err.response?.status === 409 && (d?.occupant_id || d?.occupant)) {
        const cleanMsg = (d?.message || '').replace(/\s*\(id\s+\d+\)\.?/gi, '').replace(/\.?\s*Hapus\/sesuaikan.*$/i, '').trim()
        setConfirmAction({
          type: 'update',
          confirmLabel: 'Oke',
          message: `${cleanMsg}\n\nApakah Anda yakin ingin langsung mengganti jadwal tersebut dengan jadwal ini?`,
          onConfirm: () => handleSimpanSemuaPerubahan(true)
        })
        return
      }
      setConfirmAction({ type: 'info', message: err.response?.data?.message || 'Gagal menyimpan jadwal', confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
    } finally {
      setSaving(false)
    }
  }

  const handleTutupModal = () => {
    setSelectedGuru(null)
    setStagedJadwal([])
    setEditIdx(null)
    setNewHari('')
    setNewJam('')
    setNewKelas('')
    setNewJenis('')
    setHasUnsavedChanges(false)
  }

  // ===== Grid cell editor (admin): klik cell -> modal dengan tombol Simpan =====
  const openEditCell = (hari, slot) => {
    if (!isAdmin) return
    const items = matrix[`${hari}|${slot}`] || []
    setEditCell({ hari, slot })
    setCellEditing(false)
    setCellEditId(null)
    setCellKelas('')
    setCellKode('')
    setCellJenis('')
    // kalau sel sudah ada 1 jadwal, prefill untuk edit (kode & keterangan dari data tersimpan)
    if (items.length === 1) {
      const r = items[0]
      setCellEditing(true)
      setCellEditId(r.id)
      setCellKelas(r.kelas)
      setCellKode(r.kode_guru || '')
      setCellJenis(r.ket || r.jenis || '')
    }
  }

  const saveCell = async (e) => {
    e.preventDefault()
    if (!editCell) return
    setSaving(true)
    try {
      const payload = {
        hari: editCell.hari,
        jam: editCell.slot,
        kelas: cellKelas,
        kode_guru: cellKode || null,
        keterangan: cellJenis || ''
      }
      if (cellEditing && cellEditId) {
        await api.put(`/jadwal/${cellEditId}`, payload)
      } else {
        await api.post('/jadwal', payload)
      }
      setEditCell(null)
      load(true)
    } catch (err) {
      setConfirmAction({ type: 'info', message: err.response?.data?.message || 'Gagal menyimpan jadwal', confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
    } finally {
      setSaving(false)
    }
  }

  const deleteJadwal = async (id) => {
    return new Promise((resolve) => {
      setConfirmAction({
        type: 'delete',
        message: 'Yakin ingin menghapus jadwal ini?',
        onConfirm: async () => {
          setSaving(true)
          try {
            await api.delete(`/jadwal/${id}`)
            await load(true) // refresh grid + tabel
            resolve(true)
          } catch (err) {
            setConfirmAction({ type: 'info', message: err.response?.data?.message || 'Gagal menghapus jadwal', confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
            resolve(false)
          } finally {
            setConfirmAction(null)
            setSaving(false)
          }
        }
      })
    })
  }

  // ===== CRUD guru_map =====
  const openAddGuru = () => { setEditGuru(null); setShowGuruForm(true) }
  const openEditGuru = (g) => { setEditGuru(g); setShowGuruForm(true) }
  const deleteGuru = (kode) => {
    setConfirmAction({
      type: 'delete',
      title: 'Hapus guru?',
      message: `Hapus guru "${kode}"? Jadwal terkait juga akan dihapus.`,
      confirmLabel: 'Hapus Permanen',
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.delete(`/jadwal/guru-map/${kode}`)
          setConfirmAction(null)
          load(true)
        } catch (err) {
          setConfirmAction({ type: 'info', message: err.response?.data?.message || 'Gagal menghapus guru', confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
        } finally {
          setSaving(false)
        }
      }
    })
  }
  const [editGuru, setEditGuru] = useState(null)
  const [showGuruForm, setShowGuruForm] = useState(false)
  const saveGuru = async (e) => {
    e.preventDefault(); setSaving(true)
    const fd = new FormData(e.target)
    const body = { kode: fd.get('kode'), nama_guru: fd.get('nama_guru'), jenis_layanan: fd.get('jenis_layanan') || null }
    try {
      if (editGuru) await api.put(`/jadwal/guru-map/${editGuru.kode}`, body)
      else await api.post('/jadwal/guru-map', body)
      setShowGuruForm(false); load(true)
    } catch (err) {
      setConfirmAction({ type: 'info', message: err.response?.data?.message || 'Gagal simpan', confirmLabel: 'Oke', onConfirm: () => setConfirmAction(null) })
    } finally { setSaving(false) }
  }

  // ===== Import Excel =====
  const [showImport, setShowImport] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const handleImport = async (e) => {
    e.preventDefault(); setSaving(true)
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await api.post('/jadwal/import-excel', fd)
      setImportMsg(res.data.message)
      load(true)
    } catch (err) { setImportMsg('Gagal: ' + (err.response?.data?.message || err.message)) }
    finally { setSaving(false) }
  }

  const downloadTemplate = () => {
    const csv = [
      'hari,jam,kelas,kode_guru,keterangan',
      'Senin,14.10 - 15.30,7A,B1,',
      'Selasa,18.30 - 19.50,9H,Q1,',
      'Rabu,14.10 - 15.30,9I,D2,',
    ].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'template-jadwal.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Layout user={user} onLogout={onLogout} role={role} active="jadwal">
      <div className="page-header"><h1>Jadwal</h1></div>

      {isAdmin && (
        <>
          <div className="jadwal-tabs">
            <button className={tab === 'guru' ? 'jadwal-tab active' : 'jadwal-tab'} onClick={() => setTab('guru')}>
              <TreeStructure weight="duotone" /> Guru & Jenis Layanan
            </button>
            <button className={tab === 'grid' ? 'jadwal-tab active' : 'jadwal-tab'} onClick={() => setTab('grid')}>
              <CalendarBlank weight="duotone" /> Jadwal Kelas
            </button>
          </div>
        </>
      )}

      {/* ===== TAB: Guru & Jenis Layanan ===== */}
      {tab === 'guru' && isAdmin && (
        <>
          <div className="card">
            <div className="jadwal-filter">
              <div className="jadwal-search">
                <MagnifyingGlass weight="duotone" />
                <input type="text" placeholder="Cari guru / kode / jenis layanan…" value={qRaw} onChange={e => setQRaw(e.target.value)} />
              </div>
              <select className="filter-select" value={filterLayanan} onChange={e => setFilterLayanan(e.target.value)}>
                <option value="">Semua Jenis Layanan</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={openAddGuru}><Plus weight="duotone" /> Tambah</button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Guru</th>
                  <th>Jenis Layanan</th>
                  <th>Kelas</th>
                  <th className="center-col" style={{width:100}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuru.map(g => {
                  const kelasSet = guruKelasMap.get(g.kode)
                  const kelasArray = kelasSet ? Array.from(kelasSet).sort().join(', ') : '-'
                  return (
                    <tr key={g.kode}>
                      <td><strong className="jadwal-kode">{g.kode}</strong></td>
                      <td>{g.nama_guru}</td>
                      <td><span className="jadwal-type">{g.jenis_layanan || '-'}</span></td>
                      <td>{kelasArray}</td>
                      <td className="center-col">
                        <div className="btn-wrap">
                          <button className="btn-action" onClick={() => openAturJadwal(g)} title="Atur Jadwal">
                            <PencilSimple weight="duotone" />
                          </button>
                          <button className="btn-action btn-delete" onClick={() => deleteGuru(g.kode)} title="Hapus"><Trash weight="duotone" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredGuru.length === 0 && <tr><td colSpan="5" className="empty">Tidak ditemukan.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Modal: Edit Guru (add/edit guru) */}
          {showGuruForm && (
            <div className="modal-overlay" onClick={() => setShowGuruForm(false)}>
              <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
                <h2>{editGuru ? 'Edit Guru' : 'Tambah Guru'}</h2>
                <form onSubmit={saveGuru}>
                  <div className="form-group">
                    <label>Kode</label>
                    <input name="kode" defaultValue={editGuru?.kode || ''} placeholder="Contoh: X1" required disabled={!!editGuru} />
                  </div>
                  <div className="form-group">
                    <label>Nama Guru</label>
                    <input name="nama_guru" defaultValue={editGuru?.nama_guru || ''} placeholder="Nama lengkap" required />
                  </div>
                  <div className="form-group">
                    <label>Jenis Layanan</label>
                    <select name="jenis_layanan" defaultValue={editGuru?.jenis_layanan || ''}>
                      <option value="">Pilih Jenis Layanan</option>
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowGuruForm(false)}>Batal</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Manage Jadwal for selected guru */}
          {selectedGuru && (
            <div className="modal-overlay" onClick={handleTutupModal}>
              <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Jadwal untuk {selectedGuru.nama_guru} ({selectedGuru.kode})</h2>
                  <button className="btn btn-sm" onClick={handleTutupModal}>&times;</button>
                </div>
                {toastMsg && <div className="alert alert-success" style={{ margin: '10px 0' }}>{toastMsg}</div>}
                
                {/* Form Input: Tambah / Edit baris kelas ke daftar lokal */}
                <form onSubmit={handleTambahKelas} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {editIdx !== null ? `Edit Baris Jadwal ke-${editIdx + 1}` : 'Form Kelas / Jam / Hari'}
                    </span>
                    {editIdx !== null && (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handleBatalEditBaris}>
                        Batal Edit Baris
                      </button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Hari</label>
                      <select value={newHari} onChange={e => setNewHari(e.target.value)} required>
                        <option value="">Pilih Hari</option>
                        {HARI_ORDER.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Jam</label>
                      <select value={newJam} onChange={e => setNewJam(e.target.value)} required>
                        <option value="">Pilih Jam</option>
                        {SLOT_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Kelas</label>
                      <select value={newKelas} onChange={e => setNewKelas(e.target.value)} required>
                        <option value="">Pilih Kelas</option>
                        {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Jenis Layanan</label>
                      <select value={newJenis} onChange={e => setNewJenis(e.target.value)}>
                        <option value="">Default ({selectedGuru.jenis_layanan || 'Umum'})</option>
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="submit"
                      className="btn btn-outline"
                      disabled={!newHari || !newJam || !newKelas}
                      title="Tambah kelas ini ke daftar jadwal guru"
                    >
                      {editIdx !== null ? 'Perbarui Baris Ini' : '+ Tambah Kelas'}
                    </button>
                  </div>
                </form>

                {/* List staged jadwal for this guru */}
                <div className="jadwal-list">
                  {stagedJadwal.map((r, idx) => (
                    <div key={r.id || r._tempId || idx} className="jadwal-item" style={editIdx === idx ? { border: '1px solid var(--accent, #3b82f6)' } : {}}>
                      <div>
                        <strong>{r.hari}</strong>, {r.jam} &bull; <strong>{r.kelas}</strong>
                        {(r.keterangan || r.jenis_layanan) && <span className="jadwal-sub"> ({r.keterangan || r.jenis_layanan})</span>}
                      </div>
                      <div className="jadwal-item-actions">
                        <button className="btn-action btn-sm" onClick={() => handleEditStaged(r, idx)} title="Edit baris"><PencilSimple weight="duotone" /></button>
                        <button className="btn-action btn-sm btn-delete" onClick={() => handleDeleteStaged(idx)} title="Hapus baris"><Trash weight="duotone" /></button>
                      </div>
                    </div>
                  ))}
                  {stagedJadwal.length === 0 && (
                    <p className="empty">Belum ada kelas di jadwal guru ini. Gunakan form di atas lalu klik "+ Tambah Kelas".</p>
                  )}
                </div>

                {/* Modal actions: Simpan ke DB & Batal */}
                <div className="modal-actions" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSimpanSemuaPerubahan(false)}
                    disabled={saving}
                    style={{ minWidth: 160 }}
                  >
                    {saving ? 'Menyimpan ke Database...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTutupModal}
                    disabled={saving}
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== TAB: Grid Jadwal ===== */}
      {tab === 'grid' && (
        <div className="card">
          <h2 className="jw-title">{isAdmin ? 'Jadwal Mingguan (Semua Kelas)' : 'Jadwal Mingguan Saya'}</h2>
          <div className="jw-scroll">
            <table className="jw-table">
              <thead>
                <tr>
                  <th className="jw-slot-head">Jam / Hari</th>
                  {HARI_ORDER.map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {SLOT_ORDER.map(slot => (
                  <tr key={slot}>
                    <td className="jw-slot">{slot}</td>
                    {HARI_ORDER.map(hari => (
                      <td key={hari} className="jw-cell-wrapper">
                        {buildCell(hari, slot)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal cell editor dihapus — tabel murni untuk preview */}

      {/* ===== MODAL: Import Excel (admin) ===== */}
      {isAdmin && showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setImportMsg('') }}>
          <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
            <h2>Import Jadwal dari Excel</h2>
            <p className="form-hint">Kolom wajib: <strong>hari, jam, kelas</strong>. Kolom opsional: <strong>kode_guru, keterangan</strong>. Baris yang sudah ada (hari+jam+kelas sama) akan di-update.</p>
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label>Pilih file (.xlsx / .xls / .csv)</label>
                <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
              </div>
              {importMsg && <div className={`alert alert-${importMsg.includes('Gagal') ? 'error' : 'success'}`}>{importMsg}</div>}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Mengimpor...' : 'Import'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowImport(false); setImportMsg('') }}>Tutup</button>
              </div>
            </form>
            <a href="#" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={(e) => { e.preventDefault(); downloadTemplate() }}>
              <DownloadSimple weight="duotone" /> Download Template
            </a>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title || (confirmAction?.type === 'info' ? 'Info' : 'Konfirmasi')}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmLabel || 'Ya'}
        cancelText={confirmAction?.type === 'info' ? 'Tutup' : 'Batal'}
        danger={confirmAction?.type === 'delete'}
        onConfirm={() => confirmAction?.onConfirm?.()}
        onClose={() => setConfirmAction(null)}
      />
    </Layout>
  )
}

export default Jadwal