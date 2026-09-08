import React, { useState, useEffect, useRef } from 'react'
import {
  PencilSimple,
  Key,
  Trash,
  Prohibit,
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  UserCircle,
  Link as LinkIcon,
  UserSwitch,
} from '@phosphor-icons/react'
import api from '../../api'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'

import './AdminUsers.css'

function AdminUsers({ user, onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [onlyOrphan, setOnlyOrphan] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetUserId, setResetUserId] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const emptyForm = { username: '', email: '', password: '', full_name: '', nip: '', kelas: '', jabatan: '', no_hp: '', role: 'guru' }
  const [form, setForm] = useState(emptyForm)
  const [jenisLayanan, setJenisLayanan] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [showLink, setShowLink] = useState(false)
  const [linkUser, setLinkUser] = useState(null)
  const [linkCode, setLinkCode] = useState('')
  const [guruMapList, setGuruMapList] = useState([])
  const [pendingConfirm, setPendingConfirm] = useState(null)
  const confirmThen = (cfg) => setPendingConfirm(cfg)
  const runConfirm = () => {
    const fn = pendingConfirm?.onConfirm
    setPendingConfirm(null)
    if (fn) fn()
  }

  useEffect(() => {
    fetchUsers()
  }, [page, roleFilter, statusFilter, onlyOrphan, search])

  useEffect(() => {
    api.get('/jadwal/guru-map')
      .then((res) => {
        const list = res.data || []
        setJenisLayanan([...new Set(list.map((g) => g.jenis_layanan).filter(Boolean))].sort())
        setGuruMapList(list)
      })
      .catch(() => { setJenisLayanan([]); setGuruMapList([]) })
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      if (onlyOrphan) {
        const res = await api.get('/admin/users-orphan')
        setUsers(res.data.users)
        setTotal(res.data.users.length)
        setPages(1)
        return
      }
      const params = [`page=${page}`, 'limit=20']
      if (roleFilter) params.push(`role=${roleFilter}`)
      if (statusFilter) params.push(`status=${statusFilter}`)
      if (search) params.push(`q=${encodeURIComponent(search)}`)
      const response = await api.get(`/admin/users?${params.join('&')}`)
      setUsers(response.data.users)
      setTotal(response.data.pagination.total)
      setPages(response.data.pagination.pages)
    } catch (err) {
      console.error('Error fetching users:', err)
      setMessage(err.response?.data?.message || 'Error loading users')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const triggerSearch = () => {
    setPage(1)
    setSearch(searchInput)
  }

  const openCreate = () => {
    setEditUser(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (u) => {
    setEditUser(u)
    setForm({
      username: u.username, email: u.email, password: '',
      full_name: u.full_name || '', nip: u.nip || '',
      kelas: u.kelas || '', jabatan: u.jabatan || '', no_hp: u.no_hp || '',
      role: u.role || 'guru',
    })
    setShowForm(true)
  }

  const lastGen = useRef(null)
  const STRIP_TITLES = /,?\s*(M\.Pd\.?|M\.Pd\.I\.?|M\.Si\.?|S\.Pd\.?|S\.Pd\.I\.?|S\.Kom\.?|S\.Ag\.?|M\.M\.?|M\.Hum\.?|M\.Ed\.?|Dr\.?|Dra\.?|Drs\.?|Hj\.?|Lc\.?)\b/gi
  const genUsername = (name) => {
    if (!name) return ''
    const clean = name.replace(STRIP_TITLES, ' ')
      .replace(/\./g, ' ')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
    if (!clean) return ''
    const words = clean.split(' ').filter(Boolean)
    if (words.length === 1) return words[0].slice(0, 18)
    // maks 2 bagian: kata pertama + kata terakhir; inisial (<=2 huruf) digabung kata tetangga
    let first = words[0]
    if (first.length <= 2 && words.length >= 3) first = words[0] + words[1]
    let last = words[words.length - 1]
    if (last.length <= 2 && words.length >= 3) last = words[words.length - 2]
    return (first + '.' + last).slice(0, 18).replace(/\.$/, '')
  }

  const handleFormChange = (e) => {
    const f = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === 'full_name' && !editUser) {
      const gen = genUsername(e.target.value)
      if (!f.username || f.username === lastGen.current) f.username = gen
      lastGen.current = gen
    }
    setForm(f)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, {
          username: form.username,
          email: form.email,
          full_name: form.full_name,
          kelas: form.kelas,
          jabatan: form.jabatan,
          no_hp: form.no_hp,
          role: form.role,
        })
        setMessage('Data guru berhasil diperbarui')
      } else {
        await api.post('/admin/users', form)
        setMessage(form.role === 'admin' ? 'Admin berhasil ditambahkan' : 'Guru berhasil ditambahkan')
      }
      setMessageType('success')
      setShowForm(false)
      fetchUsers()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menyimpan data guru')
      setMessageType('error')
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword) {
      setMessage('Password tidak boleh kosong')
      setMessageType('error')
      return
    }
    if (newPassword.length < 8) {
      setMessage('Password minimal 8 karakter')
      setMessageType('error')
      return
    }
    try {
      await api.post(`/admin/users/${resetUserId}/reset-password`, { newPassword })
      setMessage('Password berhasil direset')
      setMessageType('success')
      setShowResetForm(false)
      setNewPassword('')
      setResetUserId(null)
      fetchUsers()
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        'Gagal mereset password'
      )
      setMessageType('error')
    }
  }

  const handleDeactivate = (userId) => {
    confirmThen({
      title: 'Nonaktifkan pengguna?',
      message: 'Pengguna ini akan dinonaktifkan dan tidak bisa login sampai diaktifkan kembali.',
      confirmText: 'Nonaktifkan',
      onConfirm: async () => {
        try {
          await api.post(`/admin/users/${userId}/deactivate`)
          setMessage('Pengguna berhasil dinonaktifkan')
          setMessageType('success')
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal menonaktifkan pengguna')
          setMessageType('error')
        }
      },
    })
  }

  const handleActivate = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/activate`)
      setMessage('Pengguna berhasil diaktifkan')
      setMessageType('success')
      fetchUsers()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal mengaktifkan pengguna')
      setMessageType('error')
    }
  }

  const handleDelete = (u) => {
    confirmThen({
      title: 'Hapus permanen?',
      message: `Hapus permanen ${u.full_name || u.username}? Data absensinya ikut terhapus.`,
      confirmText: 'Hapus Permanen',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${u.id}`)
          setMessage('Pengguna berhasil dihapus')
          setMessageType('success')
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal menghapus pengguna')
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

  const handleBulkStatus = async (status) => {
    if (selected.size === 0) return
    confirmThen({
      title: `${status === 'active' ? 'Aktifkan' : 'Nonaktifkan'} ${selected.size} pengguna?`,
      message: `Tindakan ini akan ${status === 'active' ? 'mengaktifkan' : 'menonaktifkan'} ${selected.size} pengguna terpilih.`,
      confirmText: status === 'active' ? 'Aktifkan' : 'Nonaktifkan',
      onConfirm: async () => {
        try {
          await api.post('/admin/users/bulk/status', { ids: [...selected], status })
          setMessage(`${selected.size} pengguna di${status === 'active' ? 'aktifkan' : 'nonaktifkan'}`)
          setMessageType('success')
          setSelected(new Set())
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal update massal')
          setMessageType('error')
        }
      },
    })
  }

  const handleBulkReset = async () => {
    if (selected.size === 0) return
    confirmThen({
      title: 'Reset password massal?',
      message: `Password baru untuk ${selected.size} pengguna terpilih akan ditampilkan setelah reset.`,
      confirmText: 'Reset',
      onConfirm: async () => {
        try {
          const res = await api.post('/admin/users/bulk/reset-password', { ids: [...selected] })
          const creds = res.data.credentials || []
          const txt = creds.map((c) => `${c.username}: ${c.newPassword}`).join('\n')
          setMessage(`Reset selesai. Salin password:\n${txt}`)
          setMessageType('success')
          setSelected(new Set())
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal reset massal')
          setMessageType('error')
        }
      },
    })
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    confirmThen({
      title: `Hapus ${selected.size} pengguna?`,
      message: `HAPUS PERMANEN ${selected.size} pengguna terpilih. Data absensi ikut terhapus.`,
      confirmText: 'Hapus Permanen',
      danger: true,
      onConfirm: async () => {
        try {
          await api.post('/admin/users/bulk/delete', { ids: [...selected] })
          setMessage(`${selected.size} pengguna dihapus`)
          setMessageType('success')
          setSelected(new Set())
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal hapus massal')
          setMessageType('error')
        }
      },
    })
  }

  const openLink = (u) => {
    setLinkUser(u)
    setLinkCode(u.guru_map_kode || '')
    setShowLink(true)
  }

  const handleLinkSave = async () => {
    try {
      const code = linkCode.trim() || null
      await api.post(`/admin/users/${linkUser.id}/link-guru-map`, { guru_map_kode: code })
      setMessage(code ? `User ter-link ke ${code}` : 'Link guru_map dilepas')
      setMessageType('success')
      setShowLink(false)
      setLinkUser(null)
      fetchUsers()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal link guru_map')
      setMessageType('error')
    }
  }

  const handleImpersonate = (u) => {
    confirmThen({
      title: 'Login sebagai pengguna?',
      message: `Anda akan masuk sebagai ${u.full_name || u.username}.`,
      confirmText: 'Login',
      onConfirm: async () => {
        try {
          const res = await api.post(`/admin/impersonate/${u.id}`)
          localStorage.setItem('token', res.data.token)
          window.location.href = '/dashboard'
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal impersonate')
          setMessageType('error')
        }
      },
    })
  }

  return (
    <Layout user={user} onLogout={onLogout} role="admin" active="users">
      <div className="page-header">
        <h1>Manajemen Guru</h1>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`} style={{ whiteSpace: 'pre-line' }}>
          {message}
        </div>
      )}

      <div className="card">
        <div className="search-section">
          <input
            type="text"
            placeholder="Cari nama, username, atau email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
            className="search-input"
          />
          <button className="btn btn-secondary btn-sm" onClick={triggerSearch}>Cari</button>
          <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">Semua Role</option>
            <option value="guru">Guru</option>
            <option value="admin">Admin</option>
          </select>
          <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <label className="orphan-toggle">
            <input type="checkbox" checked={onlyOrphan} onChange={(e) => { setOnlyOrphan(e.target.checked); setPage(1); }} />
            Hanya orphan (belum ter-link)
          </label>
          <button onClick={openCreate} className="btn btn-primary">
            + Tambah Guru
          </button>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} dipilih</span>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatus('active')}>Aktifkan</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatus('inactive')}>Nonaktifkan</button>
            <button className="btn btn-secondary btn-sm" onClick={handleBulkReset}>Reset PW</button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Hapus</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Batal</button>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Memuat data...</p>
        ) : users.length > 0 ? (
          <>
            <div className="users-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="col-check"></th>
                    <th>Username</th>
                    <th>Nama Lengkap</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Link</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="col-check">
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} disabled={u.id === user?.id} />
                      </td>
                      <td><strong>{u.username}</strong></td>
                      <td>{u.full_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>
                          {u.role === 'admin' ? 'Admin' : 'Guru'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${u.status}`}>
                          {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        {u.guru_map_kode ? (
                          <span className="link-badge linked">{u.guru_map_kode}</span>
                        ) : (
                          <span className="link-badge orphan">orphan</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button onClick={() => openEdit(u)} className="btn-action btn-edit" title="Ubah Data"><PencilSimple weight="regular" /></button>
                          <button onClick={() => { setResetUserId(u.id); setShowResetForm(true); }} className="btn-action btn-edit" title="Atur Ulang Password"><Key weight="regular" /></button>
                          {u.status === 'active' ? (
                            <button onClick={() => handleDeactivate(u.id)} className="btn-action btn-warn" title="Nonaktifkan" disabled={u.id === user?.id}><Prohibit weight="regular" /></button>
                          ) : (
                            <button onClick={() => handleActivate(u.id)} className="btn-action btn-edit" title="Aktifkan"><ArrowClockwise weight="regular" /></button>
                          )}
                          <button onClick={() => openLink(u)} className="btn-action btn-edit" title="Link Guru Map"><LinkIcon weight="regular" /></button>
                          {u.role === 'guru' && (
                            <button onClick={() => handleImpersonate(u)} className="btn-action btn-edit" title="Login Sebagai"><UserSwitch weight="regular" /></button>
                          )}
                          <button onClick={() => handleDelete(u)} className="btn-action btn-delete" title="Hapus Permanen" disabled={u.id === user?.id}><Trash weight="regular" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!onlyOrphan && (
              <div className="pagination" style={{ marginTop: '20px' }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} className="btn btn-secondary" disabled={page === 1}>
                  <CaretLeft weight="regular" /> Sebelumnya
                </button>
                <span className="page-info">Halaman {page} / {pages} ({total})</span>
                <button onClick={() => setPage(page + 1)} className="btn btn-secondary" disabled={page >= pages}>
                  Berikutnya <CaretRight weight="regular" />
                </button>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Tidak ada data pengguna</p>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editUser ? 'Ubah Data Guru' : 'Tambah Guru'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Username {!editUser && <span className="form-hint">otomatis dari nama, boleh diubah</span>}</label>
                  <input name="username" value={form.username} onChange={handleFormChange} required minLength={3} maxLength={18} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleFormChange} required />
                </div>
                <div className="form-group full">
                  <label>Nama Lengkap</label>
                  <input name="full_name" value={form.full_name} onChange={handleFormChange} required />
                </div>
                {!editUser && (
                  <div className="form-group full">
                    <label>Password Awal (min. 8 karakter)</label>
                    <input name="password" type="password" value={form.password} onChange={handleFormChange} required minLength={8} />
                  </div>
                )}
                <div className="form-group">
                  <label>Role</label>
                  <select name="role" value={form.role} onChange={handleFormChange}>
                    <option value="guru">Guru</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>NIP</label>
                  <input name="nip" value={form.nip} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Jenis Layanan</label>
                  <select name="jabatan" value={form.jabatan} onChange={handleFormChange}>
                    <option value="">Pilih Jenis Layanan</option>
                    {jenisLayanan.map((jl) => <option key={jl} value={jl}>{jl}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>No. HP</label>
                  <input name="no_hp" value={form.no_hp} onChange={handleFormChange} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {editUser ? 'Simpan Perubahan' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetForm && (
        <div className="modal-overlay" onClick={() => setShowResetForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Atur Ulang Password</h2>
            <div className="form-group">
              <label>Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru (min. 8 karakter)"
                minLength={8}
                required
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => handleResetPassword(resetUserId)} className="btn btn-primary">
                Simpan
              </button>
              <button
                onClick={() => {
                  setShowResetForm(false)
                  setNewPassword('')
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {showLink && (
        <div className="modal-overlay" onClick={() => setShowLink(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Link Guru Map ({linkUser?.full_name})</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
              Pilih kode guru_map untuk mengikat akun ini. Kosongkan untuk melepas link.
            </p>
            <div className="form-group">
              <label>Kode Guru Map</label>
              <input
                list="guru-map-options"
                value={linkCode}
                onChange={(e) => setLinkCode(e.target.value)}
                placeholder="cth: S-001"
              />
              <datalist id="guru-map-options">
                {guruMapList.map((g) => (
                  <option key={g.kode} value={g.kode}>
                    {g.nama_guru} ({g.jenis_layanan})
                  </option>
                ))}
              </datalist>
            </div>
            <div className="modal-actions">
              <button onClick={handleLinkSave} className="btn btn-primary">Simpan</button>
              <button onClick={() => { setShowLink(false); setLinkUser(null); }} className="btn btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!pendingConfirm}
        title={pendingConfirm?.title}
        message={pendingConfirm?.message}
        confirmText={pendingConfirm?.confirmText || 'Ya'}
        cancelText={pendingConfirm?.cancelText || 'Batal'}
        danger={pendingConfirm?.danger}
        onConfirm={runConfirm}
        onClose={() => setPendingConfirm(null)}
      />
    </Layout>
  )
}

export default AdminUsers
