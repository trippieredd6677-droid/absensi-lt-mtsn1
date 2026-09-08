import React, { useState, useEffect } from 'react'
import {
  UploadSimple,
  Info,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react'
import api from '../api'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import { STATUS_LIST } from '../constants'
import './Absensi.css'

function Absensi({ user, onLogout }) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [formData, setFormData] = useState({
    tanggal: today,
    shift: 'siang',
    kelas: '',
    status: 'hadir',
    catatan: '',
    foto_kegiatan: null,
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' })
  const [kelasList, setKelasList] = useState([])
  const [shiftList, setShiftList] = useState([])

  // Ambil shift dari DB; kelas pilihan = kelas yang ada di jadwal milik guru (dari data jadwal),
  // biar pilihan tidak semua kelas. Fallback ke semua kelas kalau guru belum punya jadwal.
  useEffect(() => {
    api.get('/jadwal/saya')
      .then((res) => {
        const kls = [...new Set((res.data || []).map((r) => r.kelas).filter(Boolean))]
        if (kls.length > 0) {
          setKelasList(kls.sort())
        } else {
          return api.get('/kelas').then((r2) => setKelasList((r2.data.kelas || []).map((k) => k.nama)))
        }
      })
      .catch(() => api.get('/kelas')
        .then((r2) => setKelasList((r2.data.kelas || []).map((k) => k.nama)))
        .catch(() => setKelasList([])))
    api.get('/shift')
      .then((res) => setShiftList((res.data.shift || []).map((s) => s.nama)))
      .catch(() => setShiftList([]))
  }, [])

  const klasesList = kelasList

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setToast({ open: true, message: 'Foto terlalu besar (maks 8MB). Pilih foto lain.', type: 'error' })
      e.target.value = ''
      return
    }
    // Kompres & resize gambar di client biar upload cepat (kecil, bukan 5MB mentah)
    const compressed = await compressImage(file)
    setFormData({ ...formData, foto_kegiatan: compressed })
  }

  // Resize + kompres gambar (canvas) -> JPEG kecil biar upload nggak lama
  const compressImage = (file) => new Promise((resolve) => {
    if (file.type === 'application/pdf') return resolve(file) // PDF: kirim apa adanya
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.catatan.trim()) {
      setToast({ open: true, message: 'Catatan wajib diisi sebelum mengirim absensi.', type: 'error' })
      return
    }
    if (!formData.foto_kegiatan) {
      setToast({ open: true, message: 'Foto kegiatan wajib diunggah sebelum mengirim absensi.', type: 'error' })
      return
    }
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('tanggal', formData.tanggal)
      formDataToSend.append('shift', formData.shift)
      formDataToSend.append('kelas', formData.kelas)
      formDataToSend.append('status', formData.status)
      formDataToSend.append('catatan', formData.catatan)
      if (formData.foto_kegiatan) {
        const fileObj = formData.foto_kegiatan
        const ext = (fileObj.name || '').split('.').pop() || (fileObj.type === 'application/pdf' ? 'pdf' : 'jpg')
        formDataToSend.append('foto_kegiatan', fileObj, `foto_kegiatan.${ext}`)
      }

      await api.post('/absensi', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // upload foto bisa lama di koneksi lambat — jangan kepotong 10s
      })

      setToast({ open: true, message: 'Absensi berhasil dikirim', type: 'success' })

      // Reset form
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        shift: 'siang',
        kelas: '',
        status: 'hadir',
        catatan: '',
        foto_kegiatan: null,
      })
    } catch (err) {
      setToast({ open: true, message: err.response?.data?.message || 'Gagal submit absensi', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout user={user} onLogout={onLogout} role={user?.role} active="absensi">
      <div className="page-header">
        <h1>Absensi</h1>
      </div>

      <Toast open={toast.open} message={toast.message} type={toast.type} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      <div className="card absensi-form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tanggal">Tanggal *</label>
              <input
                id="tanggal"
                type="date"
                name="tanggal"
                value={formData.tanggal}
                onChange={handleChange}
                min={today}
                max={today}
                readOnly
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="shift">Shift *</label>
              <select
                id="shift"
                name="shift"
                value={formData.shift}
                onChange={handleChange}
                required
                disabled={loading}
              >
                {shiftList.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="kelas">Kelas *</label>
              <select
                id="kelas"
                name="kelas"
                value={formData.kelas}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="">Pilih Kelas</option>
                {klasesList.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status *</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                disabled={loading}
              >
                {STATUS_LIST.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="foto">
              Unggah Foto Kegiatan <span className="required-mark" title="Wajib diisi">*</span>
            </label>
            <label htmlFor="foto" className="file-input-wrapper">
              <input
                id="foto"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={loading}
                required={!formData.foto_kegiatan}
              />
              <span className={`file-label ${formData.foto_kegiatan ? 'has-file' : ''}`}>
                <UploadSimple weight="duotone" />
                {formData.foto_kegiatan ? (formData.foto_kegiatan.name || 'Foto siap diunggah') : 'Pilih berkas atau seret ke sini'}
              </span>
            </label>
            <p className="form-hint">Format: JPG, PNG, GIF, WEBP</p>
          </div>

          <div className="form-group">
            <label htmlFor="catatan">
              Catatan <span className="required-mark" title="Wajib diisi">*</span>
            </label>
            <textarea
              id="catatan"
              name="catatan"
              value={formData.catatan}
              onChange={handleChange}
              placeholder="Masukkan catatan"
              rows="5"
              required
              disabled={loading}
            ></textarea>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim Absensi'}
            </button>
            <a href="/" className="btn btn-secondary">
              Kembali
            </a>
          </div>
        </form>
      </div>

      <div className="info-card">
        <h3><Info weight="duotone" /> Informasi Penting</h3>
        <ul>
          <li><CheckCircle weight="duotone" /> Pastikan semua data yang Anda isi sudah benar sebelum mengirim</li>
          <li><CheckCircle weight="duotone" /> Setiap tanggal dan shift hanya boleh diisi satu kali</li>
          <li><CheckCircle weight="duotone" /> Anda hanya bisa melihat riwayat absensi; koreksi data ditangani admin</li>
          <li><CheckCircle weight="duotone" /> Unggah foto kegiatan untuk mendokumentasikan aktivitas Anda</li>
        </ul>
      </div>
    </Layout>
  )
}

export default Absensi

