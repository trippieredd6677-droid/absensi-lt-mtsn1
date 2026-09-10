import React, { useState, useEffect, useRef } from 'react'
import {
  Key,
  Prohibit,
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  UserCircle,
  PlusCircle,
  Link as LinkIcon,
  UserSwitch,
  Users,
} from '@phosphor-icons/react'
import { IconBan, IconChevronLeft, IconChevronRight, IconCirclePlus, IconKey, IconPencil, IconRefresh, IconTrash, IconUserShare } from '@tabler/icons-react'
import api from '../../api'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import EmptyState from '../../components/EmptyState'

import './AdminUsers.css'

function AdminUsers({ user, onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [onlyUnmapped, setOnlyUnmapped] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetUserId, setResetUserId] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const emptyForm = { username: '', email: '', password: 'Guru2026', full_name: '', nip: '', kelas: '', jenis_layanan: '', no_hp: '', role: 'guru' }
  const [form, setForm] = useState(emptyForm)
  const [jenisLayanan, setJenisLayanan] = useState([])
  const [jenisOpen, setJenisOpen] = useState(false)
  const jenisRef = useRef(null)
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
    if (!jenisOpen) return
    const onDown = (e) => { if (jenisRef.current && !jenisRef.current.contains(e.target)) setJenisOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [jenisOpen])

  useEffect(() => {
    fetchUsers()
  }, [page, roleFilter, statusFilter, onlyUnmapped, search])

  useEffect(() => {
    api.get('/jadwal/guru-map')
      .then((res) => {
        const list = res.data || []
        setGuruMapList(list)
      })
      .catch(() => { setGuruMapList([]) })
    api.get('/jenis-layanan').then((res) => {
      const list = (res.data?.jenis_layanan || []).map((j) => j.nama).filter(Boolean).sort()
      if (list.length) setJenisLayanan(list)
      else api.get('/jadwal/guru-map').then((r2) => setJenisLayanan([...new Set((r2.data || []).map((g) => g.jenis_layanan).filter(Boolean))].sort())).catch(() => setJenisLayanan([]))
    }).catch(() => api.get('/jadwal/guru-map').then((r2) => setJenisLayanan([...new Set((r2.data || []).map((g) => g.jenis_layanan).filter(Boolean))].sort())).catch(() => setJenisLayanan([])))
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      if (onlyUnmapped) {
        const res = await api.get('/admin/users-unmapped')
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

  useEffect(() => {
    const t = setTimeout(() => {
      const v = searchInput.trim()
      if (v !== search) {
        setPage(1)
        setSearch(v)
      }
    }, 320)
    return () => clearTimeout(t)
  }, [searchInput])

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
      kelas: u.kelas || '', jenis_layanan: u.jenis_layanan || '', no_hp: u.no_hp || '',
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
    if (editUser) {
      const dirty = ['username','email','full_name','nip','kelas','jenis_layanan','no_hp','role'].some((k) => String(form[k] || '') !== String(editUser[k] || ''))
      if (!dirty) {
        setMessage('Tidak ada perubahan')
        setMessageType('info')
        return
      }
      confirmThen({
        title: 'Simpan perubahan?',
        message: `Yakin simpan perubahan untuk ${form.username}?`,
        confirmText: 'Simpan',
        onConfirm: async () => {
          setSaving(true)
          try {
            await api.put(`/admin/users/${editUser.id}`, {
              username: form.username,
              email: form.email,
              full_name: form.full_name,
              kelas: form.kelas,
              jenis_layanan: form.jenis_layanan,
              no_hp: form.no_hp,
              role: form.role,
            })
            setMessage('Data guru berhasil diperbarui')
            setMessageType('success')
            setShowForm(false)
            fetchUsers()
          } catch (err) {
            setMessage(err.response?.data?.message || 'Gagal menyimpan data guru')
            setMessageType('error')
          } finally {
            setSaving(false)
          }
        },
      })
      return
    }
    setSaving(true)
    try {
      await api.post('/admin/users', form)
      setMessage(form.role === 'admin' ? 'Admin berhasil ditambahkan' : 'Guru berhasil ditambahkan')
      setMessageType('success')
      setShowForm(false)
      fetchUsers()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menyimpan data guru')
      setMessageType('error')
    } finally {
      setSaving(false)
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
    confirmThen({
      title: 'Reset password?',
      message: `Yakin reset password user ini?`,
      confirmText: 'Reset',
      onConfirm: async () => {
        setSaving(true)
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
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const handleDeactivate = (userId) => {
    confirmThen({
      title: 'Nonaktifkan pengguna?',
      message: 'Pengguna ini akan dinonaktifkan dan tidak bisa login sampai diaktifkan kembali.',
      confirmText: 'Nonaktifkan',
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.post(`/admin/users/${userId}/deactivate`)
          setMessage('Pengguna berhasil dinonaktifkan')
          setMessageType('success')
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal menonaktifkan pengguna')
          setMessageType('error')
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const handleActivate = (userId) => {
    confirmThen({
      title: 'Aktifkan pengguna?',
      message: 'Pengguna ini akan diaktifkan dan bisa login kembali.',
      confirmText: 'Aktifkan',
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.post(`/admin/users/${userId}/activate`)
          setMessage('Pengguna berhasil diaktifkan')
          setMessageType('success')
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal mengaktifkan pengguna')
          setMessageType('error')
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const handleDelete = (u) => {
    confirmThen({
      title: 'Hapus permanen?',
      message: `Hapus permanen ${u.full_name || u.username}? Data absensinya ikut terhapus.`,
      confirmText: 'Hapus Permanen',
      danger: true,
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.delete(`/admin/users/${u.id}`)
          setMessage('Pengguna berhasil dihapus')
          setMessageType('success')
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal menghapus pengguna')
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

  const handleBulkStatus = async (status) => {
    if (selected.size === 0) return
    confirmThen({
      title: `${status === 'active' ? 'Aktifkan' : 'Nonaktifkan'} ${selected.size} pengguna?`,
      message: `Tindakan ini akan ${status === 'active' ? 'mengaktifkan' : 'menonaktifkan'} ${selected.size} pengguna terpilih.`,
      confirmText: status === 'active' ? 'Aktifkan' : 'Nonaktifkan',
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.post('/admin/users/bulk/status', { ids: [...selected], status })
          setMessage(`${selected.size} pengguna di${status === 'active' ? 'aktifkan' : 'nonaktifkan'}`)
          setMessageType('success')
          setSelected(new Set())
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal update massal')
          setMessageType('error')
        } finally {
          setSaving(false)
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
        setSaving(true)
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
        } finally {
          setSaving(false)
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
        setSaving(true)
        try {
          await api.post('/admin/users/bulk/delete', { ids: [...selected] })
          setMessage(`${selected.size} pengguna dihapus`)
          setMessageType('success')
          setSelected(new Set())
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal hapus massal')
          setMessageType('error')
        } finally {
          setSaving(false)
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
    const code = linkCode.trim() || null
    confirmThen({
      title: code ? `Link ke ${code}?` : 'Lepas link?',
      message: code ? `Yakin link ${linkUser?.full_name || linkUser?.username} ke ${code}?` : 'Yakin lepas link guru_map?',
      confirmText: 'Simpan',
      onConfirm: async () => {
        setSaving(true)
        try {
          await api.post(`/admin/users/${linkUser.id}/link-guru-map`, { guru_map_kode: code })
          setMessage(code ? `User ter-link ke ${code}` : 'Link guru_map dilepas')
          setMessageType('success')
          setShowLink(false)
          setLinkUser(null)
          fetchUsers()
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal link guru_map')
          setMessageType('error')
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const handleImpersonate = (u) => {
    confirmThen({
      title: 'Login sebagai pengguna?',
      message: `Anda akan masuk sebagai ${u.full_name || u.username}.`,
      confirmText: 'Login',
      onConfirm: async () => {
        setSaving(true)
        try {
          const res = await api.post(`/admin/impersonate/${u.id}`)
          localStorage.setItem('token', res.data.token)
          window.location.href = '/dashboard'
        } catch (err) {
          setMessage(err.response?.data?.message || 'Gagal impersonate')
          setMessageType('error')
        } finally {
          setSaving(false)
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
            className="search-input"
          />
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
          <label className="unmapped-toggle">
            <input type="checkbox" checked={onlyUnmapped} onChange={(e) => { setOnlyUnmapped(e.target.checked); setPage(1); }} />
            Hanya Unmapped
          </label>
          <button onClick={openCreate} className="btn btn-primary">
            <IconCirclePlus size={16} stroke={1.8} /> Tambah Guru
          </button>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} dipilih</span>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatus('active')} disabled={saving}>Aktifkan</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatus('inactive')} disabled={saving}>Nonaktifkan</button>
            <button className="btn btn-secondary btn-sm" onClick={handleBulkReset} disabled={saving}>Reset PW</button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={saving}>Hapus</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())} disabled={saving}>Batal</button>
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
                    <th>Jenis Layanan</th>
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
                      <td style={{ fontSize: '13px', color: 'var(--text)', maxWidth: '220px', whiteSpace: 'normal', lineHeight: '1.4' }}>{u.jenis_layanan || '-'}</td>
                      <td>
                        {u.guru_map_kode ? (
                          <span className="link-badge linked">{u.guru_map_kode}</span>
                        ) : (
                          <span className="link-badge unmapped">Unmapped</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button onClick={() => openEdit(u)} className="btn-action btn-edit" title="Ubah Data"><IconPencil size={16} stroke={1.8} /></button>
                          <button onClick={() => { setResetUserId(u.id); setShowResetForm(true); }} className="btn-action btn-edit" title="Atur Ulang Password"><IconKey size={16} stroke={1.8} /></button>
                          {u.status === 'active' ? (
                            <button onClick={() => handleDeactivate(u.id)} className="btn-action btn-warn" title="Nonaktifkan" disabled={u.id === user?.id}><IconBan size={16} stroke={1.8} /></button>
                          ) : (
                            <button onClick={() => handleActivate(u.id)} className="btn-action btn-edit" title="Aktifkan"><IconRefresh size={16} stroke={1.8} /></button>
                          )}
                          <button onClick={() => openLink(u)} className="btn-action btn-edit" title="Link Guru Map"><LinkIcon weight="regular" /></button>
                          {u.role === 'guru' && (
                            <button onClick={() => handleImpersonate(u)} className="btn-action btn-edit" title="Login Sebagai"><IconUserShare size={16} stroke={1.8} /></button>
                          )}
                          <button onClick={() => handleDelete(u)} className="btn-action btn-delete" title="Hapus Permanen" disabled={u.id === user?.id}><IconTrash size={16} stroke={1.8} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!onlyUnmapped && (
              <div className="pagination" style={{ marginTop: '20px' }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} className="btn btn-secondary" disabled={page === 1}>
                  <IconChevronLeft size={16} stroke={1.8} /> Sebelumnya
                </button>
                <span className="page-info">Halaman {page} / {pages} ({total})</span>
                <button onClick={() => setPage(page + 1)} className="btn btn-secondary" disabled={page >= pages}>
                  Berikutnya <IconChevronRight size={16} stroke={1.8} />
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={Users} title="Tidak ada pengguna" description="Belum ada data guru/admin. Tambah guru atau sesuaikan filter." action={<button onClick={openCreate} className="btn btn-primary btn-sm">Tambah Guru</button>} />
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editUser ? 'Ubah Data Guru' : 'Tambah Guru'}</h2>
            {!editUser && <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Username otomatis dari nama • Password default <strong style={{ color: 'var(--accent)' }}>Guru2026</strong></div>}
            <form onSubmit={handleFormSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Username</label>
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
                    <label>Password Awal <span className="form-hint">default: Guru2026</span></label>
                    <input name="password" type="text" value={form.password} onChange={handleFormChange} required minLength={8} placeholder="Guru2026" />
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
                  <div ref={jenisRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setJenisOpen((o) => !o)} style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', color: String(form.jenis_layanan || '').trim() ? 'var(--text)' : 'var(--text-faint)', fontSize: '14px', cursor: 'pointer' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(form.jenis_layanan || '').trim() ? String(form.jenis_layanan).split(',').map((s) => s.trim()).filter(Boolean).join(', ') : 'Pilih Jenis Layanan'}</span>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-faint)' }}>▾</span>
                    </button>
                    {jenisOpen && (
                      <div style={{ position: 'absolute', top: '44px', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', zIndex: 20, maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                        {jenisLayanan.length === 0 ? <span style={{ color: 'var(--text-faint)', fontSize: '13px', padding: '8px' }}>Memuat...</span> : jenisLayanan.map((jl) => {
                          const sel = String(form.jenis_layanan || '').split(',').map((s) => s.trim()).filter(Boolean)
                          const checked = sel.includes(jl)
                          return (
                            <div key={jl} onClick={() => {
                              const cur = String(form.jenis_layanan || '').split(',').map((s) => s.trim()).filter(Boolean)
                              const next = cur.includes(jl) ? cur.filter((x) => x !== jl) : [...cur, jl]
                              setForm({ ...form, jenis_layanan: next.join(', ') })
                            }} style={{ padding: '9px 12px', borderRadius: '6px', cursor: 'pointer', background: checked ? 'var(--accent-dim)' : 'transparent', color: checked ? 'var(--accent)' : 'var(--text)', fontSize: '13px', fontWeight: checked ? 600 : 400 }}>
                              {jl}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>No. HP</label>
                  <input name="no_hp" value={form.no_hp} onChange={handleFormChange} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : editUser ? 'Simpan' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary" disabled={saving}>
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
              <button onClick={() => handleResetPassword(resetUserId)} className="btn btn-primary" disabled={saving}>
                {saving ? 'Memproses...' : 'Simpan'}
              </button>
              <button
                onClick={() => {
                  setShowResetForm(false)
                  setNewPassword('')
                }}
                className="btn btn-secondary"
                disabled={saving}
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
              <button onClick={handleLinkSave} className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              <button onClick={() => { setShowLink(false); setLinkUser(null); }} className="btn btn-secondary" disabled={saving}>Batal</button>
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
        loading={saving}
        onConfirm={runConfirm}
        onClose={() => !saving && setPendingConfirm(null)}
      />
    </Layout>
  )
}

export default AdminUsers
