import React, { useState, useEffect } from 'react'
import { CaretLeft, CaretRight, ShieldCheck, FunnelSimple, X } from '@phosphor-icons/react'
import { IconChevronLeft, IconChevronRight, IconFilter, IconX } from '@tabler/icons-react'
import EmptyState from '../../components/EmptyState'
import api from '../../api'
import Layout from '../../components/Layout'
import './AdminAuditLog.css'

const ACTION_LABEL = {
  LOGIN: 'Login',
  CREATE: 'Tambah',
  UPDATE: 'Ubah',
  DELETE: 'Hapus',
  RESET_PASSWORD: 'Reset Password',
  ACTIVATE: 'Aktifkan',
  DEACTIVATE: 'Nonaktifkan',
  BULK_STATUS: 'Bulk Status',
  BULK_RESET: 'Bulk Reset PW',
  BULK_DELETE: 'Bulk Hapus',
  LINK_GURU_MAP: 'Link Guru Map',
  ABSENSI_UPDATE: 'Edit Absensi',
  ABSENSI_DELETE: 'Hapus Absensi',
  REMIND: 'Reminder',
  IMPERSONATE: 'Impersonate',
}

const ACTION_COLOR = {
  LOGIN: 'accent',
  CREATE: 'ok',
  UPDATE: 'accent',
  DELETE: 'danger',
  RESET_PASSWORD: 'warn',
  ACTIVATE: 'ok',
  DEACTIVATE: 'warn',
  BULK_STATUS: 'accent',
  BULK_RESET: 'warn',
  BULK_DELETE: 'danger',
  LINK_GURU_MAP: 'accent',
  ABSENSI_UPDATE: 'accent',
  ABSENSI_DELETE: 'danger',
  REMIND: 'ok',
  IMPERSONATE: 'warn',
}

function fmtWaktu(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function parseData(v) {
  if (!v) return null
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
  return v
}

function fmtDetail(l) {
  const nd = parseData(l.new_data ?? l.new_value)
  const od = parseData(l.old_data)
  const label = { email: 'email', username: 'username', full_name: 'nama', nip: 'NIP', kelas: 'kelas', jenis_layanan: 'jenis layanan', no_hp: 'HP', role: 'role', status: 'status', guru_map_kode: 'kode guru', nama_guru: 'nama guru', nama: 'nama', keterangan: 'keterangan', jam: 'jam', hari: 'hari', foto_profil: 'foto' }
  const who = l.username || nd?.username || od?.username || (l.table_name === 'users' ? nd?.full_name || od?.full_name : '') || ''
  switch (l.action) {
    case 'LOGIN': return who ? `Masuk sebagai ${who}` : 'Masuk'
    case 'LOGIN_FAILED': return who ? `Gagal login ${who}` : 'Gagal login'
    case 'LOGIN_PENDING': return 'Login pending'
    case 'LOGIN_INACTIVE': return 'Login ditolak'
    case 'CREATE': return who ? `Tambah ${who}` : nd?.nama || nd?.full_name || 'Tambah data'
    case 'UPDATE': {
      if (nd && od) {
        const diff = Object.keys({ ...nd, ...od }).filter(k => nd[k] !== od[k] && !(nd[k] == null && od[k] == null) && String(nd[k] ?? '').trim() !== String(od[k] ?? '').trim())
        if (diff.length === 1) {
          const k = diff[0]
          const v = String(nd[k] ?? '').slice(0, 30)
          return `${who ? who + ': ' : ''}ganti ${label[k] || k}${v ? ` → ${v}` : ''}`
        }
        if (diff.length > 1) return `${who ? who + ': ' : ''}ganti ${diff.length} field (${diff.slice(0, 2).map(k => label[k] || k).join(', ')})`
      }
      return who ? `Ubah ${who}` : 'Ubah data'
    }
    case 'DELETE': return who ? `Hapus ${who}` : nd?.nama || od?.nama || 'Hapus data'
    case 'RESET_PASSWORD':
    case 'CHANGE_PASSWORD': return who ? `Ganti password ${who}` : 'Ganti password'
    case 'ACTIVATE': return who ? `Aktifkan ${who}` : 'Aktifkan'
    case 'DEACTIVATE': return who ? `Nonaktifkan ${who}` : 'Nonaktifkan'
    case 'BULK_STATUS': return `Bulk ${nd?.status === 'active' ? 'aktifkan' : 'nonaktifkan'}`
    case 'BULK_RESET': return 'Bulk ganti password'
    case 'BULK_DELETE': return 'Bulk hapus'
    case 'LINK_GURU_MAP': return who ? `${nd?.guru_map_kode ? 'Link' : 'Lepas'} ${who}${nd?.guru_map_kode ? ` → ${nd.guru_map_kode}` : ''}` : nd?.guru_map_kode ? `Link ${nd.guru_map_kode}` : 'Lepas link'
    case 'IMPERSONATE': return who ? `Impersonate ${who}` : 'Impersonate'
    case 'ABSENSI_UPDATE':
    case 'UPDATE_absensi': return `Ganti absensi ${nd?.kelas || ''}`
    case 'DELETE_absensi':
    case 'ABSENSI_DELETE': return `Hapus absensi ${od?.kelas || ''}`
    case 'REMIND': return 'Reminder'
    case 'REGISTER_PENDING': return `Registrasi ${who}`
    case 'FORGOT_PASSWORD': return `Forgot ${who}`
    case 'OTP_VERIFIED': return `OTP ${who}`
    case 'OVERWRITE': return 'Overwrite jadwal'
    case 'SYNC_GURU_JADWAL': return 'Sync jadwal'
    case 'IMPORT_EXCEL': return 'Import jadwal'
    default: return who ? `${l.action.toLowerCase()} ${who}` : l.action ? l.action.replace(/_/g, ' ').toLowerCase() : '-'
  }
}

function AdminAuditLog({ user, onLogout }) {
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState([])
  const [filters, setFilters] = useState({
    action: '',
    username: '',
    date_from: '',
    date_to: '',
  })
  const limit = 20

  useEffect(() => {
    api.get('/admin/audit-actions').then((r) => setActions(r.data || [])).catch(() => setActions([]))
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [page])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = [`page=${page}`, `limit=${limit}`]
      if (filters.action) params.push(`action=${filters.action}`)
      if (filters.username) params.push(`username=${encodeURIComponent(filters.username)}`)
      if (filters.date_from) params.push(`date_from=${filters.date_from}`)
      if (filters.date_to) params.push(`date_to=${filters.date_to}`)
      const res = await api.get(`/admin/audit-logs?${params.join('&')}`)
      setLogs(res.data.logs || [])
      setTotal(res.data.pagination?.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = () => {
    if (page !== 1) setPage(1)
    else fetchLogs()
  }

  const resetFilter = () => {
    setFilters({ action: '', username: '', date_from: '', date_to: '' })
    if (page !== 1) setPage(1)
    else fetchLogs()
  }

  const pages = Math.ceil(total / limit)

  return (
    <Layout user={user} onLogout={onLogout} role="admin" active="audit">
      <div className="page-header">
        <h1>Audit Log</h1>
      </div>

      <div className="card">
        <div className="audit-filter">
          <div className="filter-group">
            <label>Aksi</label>
            <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
              <option value="">Semua Aksi</option>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Pengguna</label>
            <input
              type="text"
              placeholder="username…"
              value={filters.username}
              onChange={(e) => setFilters({ ...filters, username: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="filter-group">
            <label>Dari</label>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          </div>
          <div className="filter-group">
            <label>Sampai</label>
            <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          </div>
          <div className="filter-group filter-actions">
            <button className="btn btn-primary btn-sm" onClick={applyFilter}>
              <IconFilter size={16} stroke={1.8} /> Filter
            </button>
            <button className="btn btn-secondary btn-sm" onClick={resetFilter}>
              <IconX size={16} stroke={1.8} /> Reset
            </button>
          </div>
        </div>

        {loading ? (
          <p className="audit-loading">Memuat data...</p>
        ) : logs.length > 0 ? (
          <div className="audit-timeline">
            {logs.map((l) => (
              <div key={l.id} className="audit-tl-item">
                <span className="audit-tl-dot" style={{ background: `var(--${ACTION_COLOR[l.action] === 'danger' ? 'status-alpa' : ACTION_COLOR[l.action] === 'warn' ? 'status-sakit' : 'accent'})` }} />
                <div>
                  <div className="audit-tl-time">{fmtWaktu(l.created_at)}</div>
                  <div className="audit-tl-user">{l.username || l.new_data?.username || l.old_data?.username || '-'}</div>
                  <div className="audit-ip" style={{ fontSize: '11px' }}>{l.ip_address || '-'}</div>
                </div>
                <div>
                  <span className={`audit-badge audit-${ACTION_COLOR[l.action] || 'accent'}`}>{ACTION_LABEL[l.action] || l.action}</span>
                  <div className="audit-tl-detail" style={{ marginTop: 6 }}><span className="audit-change" title={JSON.stringify(l.new_data || l.old_data || '')}>{fmtDetail(l)}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="Belum ada aktivitas" description="Audit log akan terisi setelah ada login, absensi, atau perubahan data." />
        )}

        {total > limit && (
          <div className="pagination" style={{ marginTop: '20px' }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} className="btn btn-secondary" disabled={page === 1}>
              <IconChevronLeft size={16} stroke={1.8} /> Sebelumnya
            </button>
            <span className="page-info">Halaman {page} dari {pages}</span>
            <button onClick={() => setPage(page + 1)} className="btn btn-secondary" disabled={page >= pages}>
              Berikutnya <IconChevronRight size={16} stroke={1.8} />
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default AdminAuditLog
