import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCircle2 } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { cn, timeAgo } from '@/lib/utils'

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id)
    setIsOpen(false)
    if (n.entity_type === 'booking') {
      navigate('/dashboard/requests')
    } else if (n.entity_type === 'message') {
      navigate('/messages')
    } else if (n.entity_type === 'review' || n.entity_type === 'profile') {
      navigate('/dashboard/profile')
    } else if (n.entity_type === 'listing' && n.entity_id) {
      navigate(`/listing/${n.entity_id}`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-[var(--navy)]"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 size-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border shadow-lg rounded-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50/50">
            <h3 className="font-semibold font-display text-[var(--navy)]">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-[var(--brand)] font-medium hover:underline flex items-center gap-1"
              >
                <Check className="size-3" /> Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="size-8 text-slate-200" />
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-3",
                      !n.is_read ? "bg-blue-50/30" : ""
                    )}
                  >
                    {!n.is_read && <span className="mt-1.5 size-2 shrink-0 bg-blue-500 rounded-full"></span>}
                    <div className={cn("flex-1", n.is_read && "pl-5")}>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{n.title}</p>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2 leading-snug">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
