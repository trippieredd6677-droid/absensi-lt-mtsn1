import React from 'react'
import { Link } from 'react-router-dom'
import { WarningCircle, LockKey, CloudWarning } from '@phosphor-icons/react'
import EmptyState from '../components/EmptyState'

const MAP = {
  404: { icon: WarningCircle, title: 'Halaman tidak ditemukan', desc: 'Alamat yang kamu buka tidak ada atau sudah dipindahkan.', action: 'Kembali ke Dashboard' },
  403: { icon: LockKey, title: 'Akses ditolak', desc: 'Kamu tidak punya izin untuk membuka halaman ini.', action: 'Kembali' },
  500: { icon: CloudWarning, title: 'Gangguan server', desc: 'Terjadi kesalahan di server. Coba lagi nanti.', action: 'Muat ulang' },
}

export default function Error({ code = 404 }) {
  const c = MAP[code] || MAP[404]
  return (
    <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '40px 16px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <EmptyState
          icon={c.icon}
          title={`${code} · ${c.title}`}
          description={c.desc}
          action={code === 500 ? <button onClick={() => window.location.reload()} className="btn btn-primary">{c.action}</button> : <Link to="/" className="btn btn-primary">{c.action}</Link>}
        />
      </div>
    </div>
  )
}
