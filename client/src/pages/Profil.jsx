import React, { useState, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { UserCircle, UploadSimple, ShieldCheck, Key, X, Check, ArrowsOutLineVertical } from '@phosphor-icons/react'
import api from '../api'
import Layout from '../components/Layout'
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
  const [profil, setProfil] = useState(user)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  // Crop foto profil
  const [showCrop, setShowCrop] = useState(false)
  const [cropSrc, setCropSrc] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  useEffect(() => {
    fetchProfil()
  }, [])

  const fetchProfil = async () => {
    try {
      const response = await api.get('/auth/me')
      setProfil(response.data.user)
    } catch (err) {
      console.error('Error fetching profile:', err)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await api.put('/auth/me', {
        full_name: profil.full_name,
        email: profil.email,
        jabatan: profil.jabatan,
        no_hp: profil.no_hp,
      })
      setProfil(res.data.user)
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

  return (
    <Layout user={user} onLogout={onLogout} role={user?.role} active="profil">
      <div className="page-header">
        <h1>Profil Saya</h1>
      </div>

      <div className="card profil-card">
        {message && (
          <div className={`alert alert-${messageType}`}>
            {message}
          </div>
        )}

        <div className="profile-photo">
          <div className="profile-photo-preview">
            {profil.foto_profil
              ? <img src={`/uploads/${profil.foto_profil}`} alt="Foto profil" />
              : <div className="profile-photo-placeholder"><UserCircle weight="regular" /></div>}
          </div>
          <div className="profile-photo-actions">
            <label className="btn btn-secondary">
              <UploadSimple weight="regular" /> Unggah Foto Profil
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={handlePhotoChange} />
            </label>
            <span className="upload-note">JPG, PNG, GIF, WebP · Maks 5MB</span>
            {uploading && <span className="upload-hint">Mengunggah...</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={profil.username || ''}
                disabled
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
                value={profil.nip || ''}
                disabled
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Jabatan</label>
              <input
                type="text"
                name="jabatan"
                value={profil.jabatan || ''}
                onChange={handleChange}
                placeholder="Masukkan jabatan"
              />
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
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
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
            <div className="section-icon"><Key weight="regular" /></div>
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
            <div className="section-icon"><ShieldCheck weight="regular" /></div>
            <div className="section-text">
              <h2>Keamanan</h2>
              <p>Kelola pengaturan keamanan akun Anda</p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowChangePassword(true)}
            >
              Ganti Password
            </button>
          </div>
        </div>
      )}

      {showCrop && (
        <div className="modal-overlay crop-overlay" onClick={handleCropCancel}>
          <div className="modal-content crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crop-header">
              <h2><ArrowsOutLineVertical weight="regular" /> Sesuaikan Foto</h2>
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
