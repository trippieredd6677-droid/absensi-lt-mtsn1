import React, { useState, useEffect, useMemo } from 'react'
import { Plus, PencilSimple, Trash, Check, X, ListBullets, ClockClockwise, MagnifyingGlass, Funnel, Stack, Calendar } from '@phosphor-icons/react'
import api from '../../api'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import './AdminKelas.css'

/* ============================================================
 * Parser nama kelas → { tingkat, program, paralel, sortKey }
 * Aturan:
 *  - Tingkat: digit pertama (7/8/9/10)
 *  - Program: kata pertama UPPERCASE sebelum digit (IBS, BIL, INF, OR, RST, TH, THF)
 *  - Jika tidak ada prefix program → REG (reguler)
 *  - Sisa string setelah program = paralel (huruf atau angka romawi)
 * ============================================================ */
const PROGRAM_LIST = [
  { code: 'REG', label: 'Reguler' },
  { code: 'IBS', label: 'IBS' },
  { code: 'BIL', label: 'Bilingual' },
  { code: 'INF', label: 'Infaq' },
  { code: 'OR',  label: 'Olahraga' },
  { code: 'RST', label: 'Risti' },
  { code: 'TH',  label: 'Tahfidz' },
  { code: 'THF', label: 'Tahfidz' },
]
const PROGRAM_LABEL = Object.fromEntries(PROGRAM_LIST.map(p => [p.code, p.label]))

function parseKelas(nama) {
  if (!nama) return { tingkat: null, program: 'REG', paralel: '', sortKey: nama || '' }
  const tokens = nama.trim().split(/\s+/)
  let tingkat = null
  let program = 'REG'
  let paralel = ''

  // Cari token tingkat (digit 1-2 angka di awal atau di antara)
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d{1,2}$/.test(tokens[i])) {
      tingkat = parseInt(tokens[i], 10)
      // Sisa tokens: cari program code (UPPERCASE tanpa digit)
      const others = [...tokens.slice(0, i), ...tokens.slice(i + 1)]
      for (const t of others) {
        if (/^[A-Z]{2,4}$/.test(t)) {
          program = t
          break
        }
      }
      // Paralel = sisa token non-program, gabung spasi
      paralel = others.filter(t => !/^[A-Z]{2,4}$/.test(t)).join(' ')
      break
    }
  }
  if (!tingkat) {
    // Tidak ada digit → coba deteksi program saja
    const upper = tokens.find(t => /^[A-Z]{2,4}$/.test(t))
    if (upper) program = upper
  }

  const sortKey = `${String(tingkat || 99).padStart(2, '0')}_${program}_${paralel}`
  return { tingkat, program, paralel: paralel.trim(), sortKey }
}

function buildKelasName(tingkat, program, paralel) {
  const parts = []
  if (tingkat) parts.push(String(tingkat))
  if (program && program !== 'REG') parts.push(program)
  if (paralel) parts.push(paralel.trim())
  return parts.join(' ')
}

/* ============================================================ */

function AdminKelas({ user, onLogout }) {
  const [tab, setTab] = useState('kelas')

  return (
    <Layout user={user} onLogout={onLogout} role="admin" active="kelas">
      <div className="page-header">
        <h1>Kelola Kelas & Jam LT</h1>
      </div>

      <div className="kelas-tabs">
        <button className={tab === 'kelas' ? 'kelas-tab active' : 'kelas-tab'} onClick={() => setTab('kelas')}>
          <ListBullets weight="duotone" /> Kelas
        </button>
        <button className={tab === 'shift' ? 'kelas-tab active' : 'kelas-tab'} onClick={() => setTab('shift')}>
          <Calendar weight="duotone" /> Jam LT
        </button>
      </div>

      {tab === 'kelas' && <KelasPanel user={user} onLogout={onLogout} />}
      {tab === 'shift' && <JamLTPanel user={user} onLogout={onLogout} />}
    </Layout>
  )
}

/* ============================================================
 * CRUD generik (untuk Shift & fallback)
 * ============================================================ */
function useCrud(endpoint, typeLabel, flash) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newNama, setNewNama] = useState('')
  const [editId, setEditId] = useState(null)
  const [editNama, setEditNama] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const confirmDelete = (item, onOk) => setPendingDelete({
    title: 'Hapus data?',
    message: `Hapus ${item.nama}?`,
    confirmText: 'Hapus',
    danger: true,
    onConfirm: onOk,
  })

  const fetchAll = async () => {
    try {
      const res = await api.get(endpoint)
      setItems(res.data[typeLabel] || [])
    } catch (err) {
      flash('error', 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const add = async (e) => {
    e.preventDefault()
    if (!newNama.trim()) return
    setBusy(true)
    try {
      await api.post(endpoint, { nama: newNama })
      setNewNama('')
      flash('success', 'Berhasil ditambahkan')
      fetchAll()
    } catch (err) {
      flash('error', err.response?.data?.message || 'Gagal menambahkan')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!editNama.trim()) return
    setBusy(true)
    try {
      await api.put(`${endpoint}/${editId}`, { nama: editNama })
      setEditId(null)
      flash('success', 'Berhasil diperbarui')
      fetchAll()
    } catch (err) {
      flash('error', err.response?.data?.message || 'Gagal mengubah')
    } finally {
      setBusy(false)
    }
  }

  const del = (item) => {
    confirmDelete(item, async () => {
      setPendingDelete(null)
      setBusy(true)
      try {
        await api.delete(`${endpoint}/${item.id}`)
        flash('success', 'Berhasil dihapus')
        fetchAll()
      } catch (err) {
        flash('error', err.response?.data?.message || 'Gagal menghapus')
      } finally {
        setBusy(false)
      }
    })
  }

  return { items, loading, busy, newNama, setNewNama, editId, editNama, setEditId, setEditNama, add, saveEdit, del, refresh: fetchAll, pendingDelete, setPendingDelete, confirmDelete }
}

/* ============================================================
 * KelasPanel — grouped by tingkat, filter program, search
 * ============================================================ */
function KelasPanel({ user, onLogout }) {
  const [msg, setMsg] = useState(null)
  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500) }
  const c = useCrud('/kelas', 'kelas', flash)

  const [filterProgram, setFilterProgram] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addTingkat, setAddTingkat] = useState('')
  const [addProgram, setAddProgram] = useState('REG')
  const [addParalel, setAddParalel] = useState('')

  // Parse + group + filter
  const grouped = useMemo(() => {
    const parsed = c.items
      .map(k => ({ ...k, parsed: parseKelas(k.nama) }))
      .filter(k => {
        if (filterProgram !== 'ALL' && k.parsed.program !== filterProgram) return false
        if (search && !k.nama.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.parsed.sortKey.localeCompare(b.parsed.sortKey))

    const byTingkat = {}
    for (const k of parsed) {
      const key = k.parsed.tingkat ? `Tingkat ${k.parsed.tingkat}` : 'Lainnya'
      if (!byTingkat[key]) byTingkat[key] = []
      byTingkat[key].push(k)
    }
    // Sort tingkat ascending
    return Object.entries(byTingkat).sort(([a], [b]) => a.localeCompare(b, 'id'))
  }, [c.items, filterProgram, search])

  // Stats per program
  const programStats = useMemo(() => {
    const all = c.items.map(k => parseKelas(k.nama).program)
    const counts = {}
    for (const p of all) counts[p] = (counts[p] || 0) + 1
    return counts
  }, [c.items])

  const submitAdd = async (e) => {
    e.preventDefault()
    if (!addTingkat) return flash('error', 'Pilih tingkat dulu')
    const nama = buildKelasName(addTingkat, addProgram, addParalel)
    if (!nama.trim()) return
    c.setBusy(true)
    try {
      await api.post('/kelas', { nama })
      setAddTingkat(''); setAddProgram('REG'); setAddParalel('')
      setShowAddForm(false)
      flash('success', `Kelas "${nama}" ditambah`)
      c.refresh()
    } catch (err) {
      flash('error', err.response?.data?.message || 'Gagal menambahkan')
    } finally {
      c.setBusy(false)
    }
  }

  const submitEdit = async (id) => {
    if (!c.editNama.trim()) return
    c.setBusy(true)
    try {
      await api.put(`/kelas/${id}`, { nama: c.editNama })
      c.setEditId(null)
      flash('success', 'Berhasil diperbarui')
      c.refresh()
    } catch (err) {
      flash('error', err.response?.data?.message || 'Gagal mengubah')
    } finally {
      c.setBusy(false)
    }
  }

  return (
    <div className="kelas-panel">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Toolbar: search + filter + add */}
      <div className="kelas-toolbar">
        <div className="kelas-toolbar-left">
          <div className="kelas-search">
            <MagnifyingGlass size={18} weight="bold" />
            <input
              type="text"
              placeholder="Cari kelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="kelas-filter">
            <Funnel size={16} weight="bold" />
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
              <option value="ALL">Semua Program</option>
              {PROGRAM_LIST.map(p => (
                <option key={p.code} value={p.code}>
                  {p.label}{programStats[p.code] ? ` (${programStats[p.code]})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(v => !v)}>
          <Plus weight="bold" /> Tambah Kelas
        </button>
      </div>

      {/* Add form (collapsed by default) */}
      {showAddForm && (
        <form className="kelas-add-structured" onSubmit={submitAdd}>
          <div className="kelas-add-row">
            <label className="kelas-add-field">
              <span>Tingkat</span>
              <select value={addTingkat} onChange={(e) => setAddTingkat(e.target.value)} required>
                <option value="">Pilih</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
              </select>
            </label>
            <label className="kelas-add-field">
              <span>Program</span>
              <select value={addProgram} onChange={(e) => setAddProgram(e.target.value)}>
                {PROGRAM_LIST.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </label>
            <label className="kelas-add-field">
              <span>Paralel</span>
              <input
                type="text"
                placeholder="A, B, 1, 2, ..."
                value={addParalel}
                onChange={(e) => setAddParalel(e.target.value)}
                maxLength={5}
              />
            </label>
            <label className="kelas-add-field kelas-add-preview">
              <span>Hasil</span>
              <div className="kelas-preview">
                {addTingkat ? buildKelasName(addTingkat, addProgram, addParalel) || '-' : 'Pilih tingkat dulu'}
              </div>
            </label>
            <div className="kelas-add-actions">
              <button type="submit" className="btn btn-primary" disabled={c.busy}>
                <Check weight="bold" /> Simpan
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                <X weight="bold" /> Batal
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Grouped table per tingkat */}
      {c.loading ? (
        <div className="loading">Loading...</div>
      ) : grouped.length === 0 ? (
        <div className="card empty-state">
          <Stack size={40} weight="duotone" />
          <p>Tidak ada kelas yang cocok dengan filter.</p>
        </div>
      ) : (
        <div className="kelas-groups">
          {grouped.map(([tingkatLabel, items]) => (
            <div className="kelas-group" key={tingkatLabel}>
              <div className="kelas-group-header">
                <Stack size={18} weight="duotone" />
                <h3>{tingkatLabel}</h3>
                <span className="kelas-group-count">{items.length} kelas</span>
              </div>
              <div className="card kelas-group-card">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama Kelas</th>
                      <th>Program</th>
                      <th>Paralel</th>
                      <th className="th-actions">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(k => (
                      <tr key={k.id}>
                        <td>
                          {c.editId === k.id ? (
                            <input
                              type="text"
                              className="form-control"
                              value={c.editNama}
                              onChange={(e) => c.setEditNama(e.target.value)}
                              maxLength={30}
                              autoFocus
                            />
                          ) : (
                            <span className="kelas-name">{k.nama}</span>
                          )}
                        </td>
                        <td>
                          <span className={`kelas-badge kelas-badge-${k.parsed.program.toLowerCase()}`}>
                            {PROGRAM_LABEL[k.parsed.program] || k.parsed.program}
                          </span>
                        </td>
                        <td className="kelas-paralel">{k.parsed.paralel || '-'}</td>
                        <td className="th-actions">
                          {c.editId === k.id ? (
                            <div className="kelas-actions">
                              <button className="btn btn-sm btn-primary" onClick={() => submitEdit(k.id)} disabled={c.busy} title="Simpan">
                                <Check weight="bold" />
                              </button>
                              <button className="btn btn-sm btn-secondary" onClick={() => c.setEditId(null)} disabled={c.busy} title="Batal">
                                <X weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <div className="kelas-actions">
                              <button className="btn btn-sm btn-secondary" onClick={() => { c.setEditId(k.id); c.setEditNama(k.nama) }} title="Ubah">
                                <PencilSimple weight="bold" />
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => c.del(k)} disabled={c.busy} title="Hapus">
                                <Trash weight="bold" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!c.pendingDelete}
        title={c.pendingDelete?.title}
        message={c.pendingDelete?.message}
        confirmText={c.pendingDelete?.confirmText || 'Hapus'}
        danger={c.pendingDelete?.danger}
        onConfirm={() => c.pendingDelete?.onConfirm?.()}
        onClose={() => c.setPendingDelete(null)}
      />
    </div>
  )
}

/* ============================================================
 * JamLTPanel — slot waktu Layanan Tambahan (jam_lt)
 * Sumber: tabel jam_lt (dari DISTINCT jadwal.jam)
 * ============================================================ */
const JAM_LT_PLACEHOLDERS = ['14.10 - 15.30', '18.30 - 19.50', '13.00 - 15.20', '14.00 - 15.20', '13.00 - 14.20']

function useJamLt(flash) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newJam, setNewJam] = useState('')
  const [editId, setEditId] = useState(null)
  const [editJam, setEditJam] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const confirmDelete = (item, onOk) => setPendingDelete({
    title: 'Hapus Jam LT?',
    message: `Hapus ${item.nama}?`,
    confirmText: 'Hapus',
    danger: true,
    onConfirm: onOk,
  })

  const fetchAll = async () => {
    try {
      const res = await api.get('/shift/jam-lt')
      setItems(res.data.jam_lt || [])
    } catch (err) {
      flash('error', 'Gagal memuat jam LT.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const add = async (e) => {
    e.preventDefault()
    if (!newJam.trim()) return
    setBusy(true)
    try {
      const urutan = (items[items.length - 1]?.urutan || 0) + 1
      await api.post('/shift/jam-lt', { nama: newJam.trim(), urutan })
      setNewJam('')
      flash('success', 'Jam LT ditambahkan')
      fetchAll()
    } catch (err) {
      flash('error', err.response?.data?.message || 'Gagal menambahkan')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!editJam.trim()) return
    setBusy(true)
    try {
      await api.put(`/shift/jam-lt/${editId}`, { nama: editJam.trim() })
      setEditId(null)
      flash('success', 'Jam LT diperbarui')
      fetchAll()
    } catch (err) {
      flash('error', err.response?.data?.message || 'Gagal mengubah')
    } finally {
      setBusy(false)
    }
  }

  const del = (item) => {
    confirmDelete({ nama: `slot jam ${item.nama}` }, async () => {
      setPendingDelete(null)
      setBusy(true)
      try {
        await api.delete(`/shift/jam-lt/${item.id}`)
        flash('success', 'Jam LT dihapus')
        fetchAll()
      } catch (err) {
        flash('error', err.response?.data?.message || 'Gagal menghapus')
      } finally {
        setBusy(false)
      }
    })
  }

  return { items, loading, busy, newJam, setNewJam, editId, editJam, setEditId, setEditJam, add, saveEdit, del, refresh: fetchAll, pendingDelete, setPendingDelete }
}

function JamLTPanel({ user, onLogout }) {
  const [msg, setMsg] = useState(null)
  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500) }
  const c = useJamLt(flash)
  const [showHints, setShowHints] = useState(false)

  const usedJam = new Set(c.items.map(i => i.nama))
  const availableSuggestions = JAM_LT_PLACEHOLDERS.filter(p => !usedJam.has(p))

  return (
    <div className="kelas-panel">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="jam-info">
        <Calendar size={20} weight="duotone" />
        <div>
          <p className="jam-info-title">Slot Jam Layanan Tambahan</p>
          <p className="jam-info-desc">
            Pilih slot waktu LT yang dipakai untuk penjadwalan. Format: <code>HH.MM - HH.MM</code>. Data otomatis terisi dari slot jam yang sudah ada di jadwal.
          </p>
        </div>
      </div>

      <div className="kelas-add">
        <form onSubmit={c.add} className="kelas-add-form">
          <input
            type="text"
            className="form-control"
            placeholder="contoh: 14.10 - 15.30"
            value={c.newJam}
            onChange={(e) => setNewJam(e.target.value)}
            maxLength={20}
            pattern="^\d{1,2}\.\d{2}\s*-\s*\d{1,2}\.\d{2}$"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={c.busy}>
            <Plus weight="bold" /> Tambah
          </button>
        </form>
        {availableSuggestions.length > 0 && (
          <div className="jam-suggestions">
            <span className="jam-suggestions-label">Saran dari jadwal:</span>
            {availableSuggestions.slice(0, 5).map(s => (
              <button
                key={s}
                type="button"
                className="jam-suggestion-chip"
                onClick={() => c.setNewJam(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        {c.loading ? (
          <div className="loading">Loading...</div>
        ) : c.items.length === 0 ? (
          <div className="empty">Belum ada slot jam LT.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Urutan</th>
                <th>Slot Jam</th>
                <th className="th-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((j) => (
                <tr key={j.id}>
                  <td>
                    <span className="jam-urutan">{j.urutan ?? '-'}</span>
                  </td>
                  <td>
                    {c.editId === j.id ? (
                      <input
                        type="text"
                        className="form-control"
                        value={c.editJam}
                        onChange={(e) => c.setEditJam(e.target.value)}
                        maxLength={20}
                        pattern="^\d{1,2}\.\d{2}\s*-\s*\d{1,2}\.\d{2}$"
                        autoFocus
                      />
                    ) : (
                      <span className="jam-name">{j.nama}</span>
                    )}
                  </td>
                  <td className="th-actions">
                    {c.editId === j.id ? (
                      <div className="kelas-actions">
                        <button className="btn btn-sm btn-primary" onClick={c.saveEdit} disabled={c.busy} title="Simpan"><Check weight="bold" /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => c.setEditId(null)} disabled={c.busy} title="Batal"><X weight="bold" /></button>
                      </div>
                    ) : (
                      <div className="kelas-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => { c.setEditId(j.id); c.setEditJam(j.nama) }} title="Ubah"><PencilSimple weight="bold" /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => c.del(j)} disabled={c.busy} title="Hapus"><Trash weight="bold" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!c.pendingDelete}
        title={c.pendingDelete?.title}
        message={c.pendingDelete?.message}
        confirmText={c.pendingDelete?.confirmText || 'Hapus'}
        danger={c.pendingDelete?.danger}
        onConfirm={() => c.pendingDelete?.onConfirm?.()}
        onClose={() => c.setPendingDelete(null)}
      />
    </div>
  )
}
export default AdminKelas
