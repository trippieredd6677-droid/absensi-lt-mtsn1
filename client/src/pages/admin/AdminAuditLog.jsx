import React, { useState, useEffect } from 'react'
import { CaretLeft, CaretRight, ShieldCheck, FunnelSimple, X } from '@phosphor-icons/react'
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
              <FunnelSimple weight="regular" /> Filter
            </button>
            <button className="btn btn-secondary btn-sm" onClick={resetFilter}>
              <X weight="regular" /> Reset
            </button>
          </div>
        </div>

        {loading ? (
          <p className="audit-loading">Memuat data...</p>
        ) : logs.length > 0 ? (
          <div className="users-table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Aksi</th>
                  <th>Objek</th>
                  <th>Detail</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="audit-time">{fmtWaktu(l.created_at)}</td>
                    <td><strong>{l.username || '-'}</strong></td>
                    <td>
                      <span className={`audit-badge audit-${ACTION_COLOR[l.action] || 'accent'}`}>
                        {ACTION_LABEL[l.action] || l.action}
                      </span>
                    </td>
                    <td><code>{l.table_name || '-'} #{l.record_id || '-'}</code></td>
                    <td className="audit-detail">
                      {l.new_value ? <span className="audit-change">{l.new_value}</span> : '-'}
                    </td>
                    <td className="audit-ip">{l.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="audit-loading"><ShieldCheck weight="regular" /> Belum ada aktivitas tercatat.</p>
        )}

        {total > limit && (
          <div className="pagination" style={{ marginTop: '20px' }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} className="btn btn-secondary" disabled={page === 1}>
              <CaretLeft weight="regular" /> Sebelumnya
            </button>
            <span className="page-info">Halaman {page} dari {pages}</span>
            <button onClick={() => setPage(page + 1)} className="btn btn-secondary" disabled={page >= pages}>
              Berikutnya <CaretRight weight="regular" />
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default AdminAuditLog
