import React from 'react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state-ledger">
      <div className="empty-state-icon">
        {Icon ? <Icon weight="regular" /> : null}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
