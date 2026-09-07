import React, { useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Info, X } from '@phosphor-icons/react'
import './Toast.css'

const ICONS = { success: CheckCircle, error: XCircle, info: Info }

// Toast pop-up: muncul dari bawah-tengah, auto-dismiss. Pakai di halaman Absensi.
function Toast({ open, message, type = 'success', onClose, duration = 3200 }) {
  const timer = useRef()
  useEffect(() => {
    if (open) {
      timer.current = setTimeout(onClose, duration)
      return () => clearTimeout(timer.current)
    }
  }, [open, duration, onClose])
  if (!open) return null
  const Icon = ICONS[type] || Info
  return (
    <div className={`toast toast-${type}`} role="status">
      <Icon weight="duotone" className="toast-icon" />
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Tutup"><X weight="bold" /></button>
    </div>
  )
}

export default Toast
