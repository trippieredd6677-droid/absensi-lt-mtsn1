import React, { useEffect } from 'react'
import { WarningCircle, X } from '@phosphor-icons/react'
import { IconAlertCircle, IconX } from '@tabler/icons-react'
import './ConfirmModal.css'

// Modal konfirmasi pengganti window.confirm / alert.
// props: open, title, message, confirmText, cancelText, danger, onConfirm, onClose
function ConfirmModal({
  open,
  title = 'Konfirmasi',
  message = '',
  confirmText = 'Ya',
  cancelText = 'Batal',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="modal-content confirm-content">
        <button
          type="button"
          className="confirm-close"
          aria-label="Tutup"
          onClick={onClose}
          disabled={loading}
        >
          <IconX size={16} stroke={1.8} />
        </button>
        <div className="confirm-icon-wrap">
          <IconAlertCircle size={16} stroke={1.8} className="confirm-icon" />
        </div>
        <h2 className="confirm-title">{title}</h2>
        {message ? <p className="confirm-message">{message}</p> : null}
        <div className="modal-actions confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
