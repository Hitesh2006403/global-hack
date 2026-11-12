import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function NotificationDrawer({ isOpen, onClose, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const res = await api.getNotifications()
      setNotifications(res.notifications || [])
      setUnreadCount(res.unreadCount || 0)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch (err) {
      console.error(err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="notification-backdrop" onClick={onClose}>
      <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <div>
            <h3>Notifications</h3>
            <span className="notif-subtitle">
              {unreadCount > 0 ? `${unreadCount} unread update(s)` : 'All caught up'}
            </span>
          </div>
          <div className="notif-actions">
            {unreadCount > 0 && (
              <button type="button" className="text-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
            <button type="button" className="close-mini-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="notification-list">
          {loading ? (
            <div className="notif-loading">Loading updates...</div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">
              <span>🔔</span>
              <p>No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`notification-card ${n.is_read ? 'read' : 'unread'}`}
                onClick={() => {
                  if (!n.is_read) handleMarkRead(n.id)
                  if (n.reference_type === 'donation' && n.reference_id && onNavigate) {
                    onClose()
                    onNavigate('/details', { donationId: n.reference_id })
                  }
                }}
              >
                <div className="notif-card-header">
                  <span className="notif-type-tag">{n.type.replace('_', ' ')}</span>
                  <span className="notif-time">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4>{n.title}</h4>
                <p>{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
