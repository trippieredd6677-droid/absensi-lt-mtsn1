import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Cropper from 'react-easy-crop'
import { UserCircle, UploadSimple, ShieldCheck, Key, X, Check, ArrowsOutLineVertical } from '@phosphor-icons/react'
import { IconArrowsVertical, IconKey, IconShieldCheck, IconUpload, IconUserCircle } from '@tabler/icons-react'
import api from '../api'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import './Profil.css'

// Potong gambar di canvas lalu balik sebagai Blob
function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Gagal memproses gambar'))
        resolve(blob)
      }, 'image/jpeg', 0.9)
    }
    image.onerror = reject
    image.src = imageSrc
  })
}

function Profil({ user, onLogout, onUpdateUser }) {
  const [profil, setProfil] = useState(null)
  const [originalProfil, setOriginalProfil] = useState(null)
  const [profilLoading, setProfilLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCrop, setShowCrop] = useState(false)
  const [cropSrc, setCropSrc] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [jenisList, setJenisList] = useState([])
  const [jenisOpen, setJenisOpen] = useState(false)
  const jenisRef = useRef(null)

  useEffect(() => {
    if (!jenisOpen) return
    const onDown = (e) => { if (jenisRef.current && !jenisRef.current.contains(e.target)) setJenisOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [jenisOpen])

  const isDirty = useMemo(() => {
    if (!profil || !originalProfil) return false
    return ['username', 'full_name', 'email', 'nip', 'jenis_layanan', 'no_hp'].some((k) => String(profil[k] || '') !== String(originalProfil[k] || ''))
  }, [profil, originalProfil])

  useEffect(() => {
    api.get('/jenis-layanan').then((r) => {
      const list = (r.data?.jenis_layanan || []).map((j) => j.nama).filter(Boolean).sort()
      if (list.length) setJenisList(list)
      else return api.get('/jadwal/guru-map').then((rr) => setJenisList([...new Set((rr.data || []).map((g) => g.jenis_layanan).filter(Boolean))].sort()))
    }).catch(() => api.get('/jadwal/guru-map').then((rr) => setJenisList([...new Set((rr.data || []).map((g) => g.jenis_layanan).filter(Boolean))].sort())).catch(() => {}))
  }, [])

  useEffect(() => {
    fetchProfil()
  }, [])

  const fetchProfil = async () => {
    try {
      const response = await api.get('/auth/me')
      setProfil(response.data.user)
      setOriginalProfil(response.data.user)
      if (onUpdateUser) onUpdateUser(response.data.user)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfil(user)
      setOriginalProfil(user)
    } finally {
      setProfilLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfil({ ...profil, [name]: value })
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setMessageType('error')
      setMessage('Format foto harus JPG, PNG, GIF, atau WebP.')
      e.target.value = ''
      return
    }

    // Baca ke dataURL lalu buka modal crop (geser/zoom) sebelum upload
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setShowCrop(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    setUploading(true)
    setMessage('')
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      const fd = new FormData()
      fd.append('photo', blob, 'foto-profil.jpg')
      const res = await api.put('/auth/me/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setProfil(res.data.user)
      if (onUpdateUser) onUpdateUser(res.data.user)
      setMessageType('success')
      setMessage('Foto profil berhasil diperbarui.')
      setShowCrop(false)
    } catch (err) {
      setMessageType('error')
      setMessage(err.response?.data?.message || 'Gagal mengunggah foto profil.')
    } finally {
      setUploading(false)
    }
  }

  const handleCropCancel = () => {
    setShowCrop(false)
    setCropSrc('')
  }

  const handleRequestSave = (e) => {
    e.preventDefault()
    if (!isDirty || loading) return
    setShowConfirmSave(true)
  }

  const handleConfirmSave = async () => {
    setShowConfirmSave(false)
    setLoading(true)
    setMessage('')
    try {
      const res = await api.put('/auth/me', {
        username: profil.username,
        full_name: profil.full_name,
        email: profil.email,
        nip: profil.nip,
        jenis_layanan: profil.jenis_layanan,
        no_hp: profil.no_hp,
      })
      setProfil(res.data.user)
      setOriginalProfil(res.data.user)
      if (onUpdateUser) onUpdateUser(res.data.user)
      setMessageType('success')
      setMessage('Profil berhasil diperbarui')
    } catch (err) {
      setMessageType('error')
      setMessage(err.response?.data?.message || 'Gagal memperbarui profil')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordForm({ ...passwordForm, [name]: value })
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setMessage('')

    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setMessageType('error')
      setMessage('Semua kolom password wajib diisi')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessageType('error')
      setMessage('Password baru tidak cocok dengan konfirmasi')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setMessageType('error')
      setMessage('Password baru minimal 8 karakter')
      return
    }

    setLoading(true)
    try {
      await api.put('/auth/password', {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      })
      setMessageType('success')
      setMessage('Password berhasil diganti')
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setShowChangePassword(false), 2000)
    } catch (err) {
      setMessageType('error')
      setMessage(err.response?.data?.message || 'Gagal mengganti password')
    } finally {
      setLoading(false)
    }
  }

  if (profilLoading) {
    return (
      <Layout user={user} onLogout={onLogout} role={user?.role} active="profil">
        <div className="loading">Memuat profil...</div>
      </Layout>
    )
  }

  if (!profil) {
    return (
      <Layout user={user} onLogout={onLogout} role={user?.role} active="profil">
        <div className="loading">Gagal memuat profil.</div>
      </Layout>
    )
  }

  return (
    <Layout user={user} onLogout={onLogout} role={user?.role} active="profil">
      <div className="page-header">
        <h1>Profil Saya</h1>
      </div>

      <div className="card profil-card" style={{ overflow: 'visible', position: 'relative', zIndex: jenisOpen ? 10 : 1 }}>
        {message && (
          <div className={`alert alert-${messageType}`}>
            {message}
          </div>
        )}

        <div className="profile-photo">
          <div className="profile-photo-preview">
            {profil.foto_profil
              ? <img src={`/uploads/${profil.foto_profil}`} alt="Foto profil" />
              : <div className="profile-photo-placeholder"><IconUserCircle size={16} stroke={1.8} /></div>}
          </div>
          <div className="profile-photo-actions">
            <label className="btn btn-secondary">
              <IconUpload size={16} stroke={1.8} /> Unggah Foto Profil
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={handlePhotoChange} />
            </label>
            <span className="upload-note">JPG, PNG, GIF, WebP · Maks 5MB</span>
            {uploading && <span className="upload-hint">Mengunggah...</span>}
          </div>
        </div>

        <form onSubmit={handleRequestSave}>
          <div className="form-row">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={profil.username || ''}
                onChange={handleChange}
                placeholder="Masukkan username"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={profil.email || ''}
                onChange={handleChange}
                placeholder="Masukkan email"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Nama Lengkap</label>
              <input
                type="text"
                name="full_name"
                value={profil.full_name || ''}
                onChange={handleChange}
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div className="form-group">
              <label>NIP</label>
              <input
                type="text"
                name="nip"
                value={profil.nip || ''}
                onChange={handleChange}
                placeholder="Masukkan NIP"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ overflow: 'visible' }}>
              <label>Jenis Layanan</label>
              <div ref={jenisRef} style={{ position: 'relative', zIndex: jenisOpen ? 20 : 1 }}>
                <button type="button" onClick={() => setJenisOpen((o) => !o)} style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', color: String(profil.jenis_layanan || '').trim() ? 'var(--text)' : 'var(--text-faint)', fontSize: '14px', cursor: 'pointer' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(profil.jenis_layanan || '').trim() ? String(profil.jenis_layanan).split(',').map((s) => s.trim()).filter(Boolean).join(', ') : 'Pilih Jenis Layanan'}</span>
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-faint)' }}>▾</span>
                </button>
                {jenisOpen && (
                  <div style={{ position: 'absolute', top: '44px', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', zIndex: 20, maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                    {jenisList.length === 0 ? <span style={{ color: 'var(--text-faint)', fontSize: '13px', padding: '8px' }}>Memuat...</span> : jenisList.map((jl) => {
                      const sel = String(profil.jenis_layanan || '').split(',').map((s) => s.trim()).filter(Boolean)
                      const checked = sel.includes(jl)
                      return (
                        <div key={jl} onClick={() => {
                          const cur = String(profil.jenis_layanan || '').split(',').map((s) => s.trim()).filter(Boolean)
                          const next = cur.includes(jl) ? cur.filter((x) => x !== jl) : [...cur, jl]
                          setProfil({ ...profil, jenis_layanan: next.join(', ') })
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
              <input
                type="tel"
                name="no_hp"
                value={profil.no_hp || ''}
                onChange={handleChange}
                placeholder="Masukkan nomor HP"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading || !isDirty}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <a href="/" className="btn btn-secondary">
              Kembali
            </a>
          </div>
        </form>
      </div>

      {showChangePassword && (
        <div className="card profil-card password-card">
          {message && (
            <div className={`alert alert-${messageType}`}>
              {message}
            </div>
          )}

          <div className="section-header">
            <div className="section-icon"><IconKey size={16} stroke={1.8} /></div>
            <div className="section-text">
              <h2>Ganti Password</h2>
              <p>Buat password baru yang kuat dan unik</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="oldPassword">Password Lama</label>
              <input
                id="oldPassword"
                type="password"
                name="oldPassword"
                value={passwordForm.oldPassword}
                onChange={handlePasswordChange}
                placeholder="Masukkan password lama"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">Password Baru</label>
              <input
                id="newPassword"
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Masukkan password baru (minimal 8 karakter)"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Konfirmasi Password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Ketik ulang password baru"
                disabled={loading}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Memproses...' : 'Simpan Password Baru'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowChangePassword(false)
                  setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
                  setMessage('')
                }}
                disabled={loading}
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {!showChangePassword && (
        <div className="card profil-card">
          <div className="section-header">
            <div className="section-icon"><IconShieldCheck size={16} stroke={1.8} /></div>
            <div className="section-text">
              <h2>Keamanan</h2>
              <p>Kelola pengaturan keamanan akun Anda</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowChangePassword(true)}
            >
              <IconKey size={16} stroke={1.8} /> Ganti Password
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showConfirmSave}
        title="Simpan perubahan?"
        message="Yakin ingin menyimpan perubahan profil? Data akan diperbarui."
        confirmText="Simpan"
        cancelText="Batal"
        onConfirm={handleConfirmSave}
        onClose={() => setShowConfirmSave(false)}
      />

      {showCrop && (
        <div className="modal-overlay crop-overlay" onClick={handleCropCancel}>
          <div className="modal-content crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crop-header">
              <h2><IconArrowsVertical size={16} stroke={1.8} /> Sesuaikan Foto</h2>
              <p>Geser atau zoom untuk memilih bagian foto yang jadi profil</p>
            </div>
            <div className="crop-area">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="crop-controls">
              <label>Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={handleCropConfirm} disabled={uploading}>
                {uploading ? 'Mengunggah...' : 'Simpan'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCropCancel} disabled={uploading}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Profil
