import { useState, useRef, useEffect, useCallback } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { notificationsApi } from '../../services/notificationsApi'

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const queryClient = useQueryClient()

  // Unread count — polled every 15 s
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  // Recent notifications — fetched when panel opens
  const { data, isFetching } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    enabled: open,
    staleTime: 10_000,
  })

  const notifications = data?.notifications ?? []

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Could not mark notification as read'),
  })

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: ({ modifiedCount }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(`${modifiedCount} notification${modifiedCount !== 1 ? 's' : ''} marked as read`)
    },
    onError: () => toast.error('Could not mark all as read'),
  })

  // Close panel on outside click
  const handleClickOutside = useCallback((e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, handleClickOutside])

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white transition-colors"
      >
        <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-[3px] rounded-full bg-[#F95C4B] text-white text-[9px] font-bold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-h-[480px] flex flex-col rounded-xl shadow-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0">
            <span className="text-sm font-semibold text-[#111111] dark:text-white">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  title="Mark all as read"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isFetching && !notifications.length ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-[#F95C4B] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-8 h-8 text-[#6B7280]/30 dark:text-[#A1A1AA]/30" strokeWidth={1.5} />
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    className={`flex gap-3 px-4 py-3 border-b border-[#F5F5F4] dark:border-[#202020] last:border-0 transition-colors ${
                      !n.readAt
                        ? 'bg-[#FFF5F4] dark:bg-[#1E1311]'
                        : 'hover:bg-[#FAFAF9] dark:hover:bg-[#202020]'
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      {!n.readAt ? (
                        <div className="w-2 h-2 rounded-full bg-[#F95C4B]" />
                      ) : (
                        <div className="w-2 h-2" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-[#6B7280]/60 dark:text-[#A1A1AA]/50 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>

                    {!n.readAt && (
                      <button
                        onClick={() => markReadMutation.mutate(n._id)}
                        disabled={markReadMutation.isPending}
                        title="Mark as read"
                        className="flex-shrink-0 self-start mt-1 text-[#6B7280]/40 hover:text-[#F95C4B] transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
