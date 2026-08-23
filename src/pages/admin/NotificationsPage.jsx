import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Bell, CheckCheck, Loader2, AlertTriangle, ChevronLeft, ChevronRight,
  Flame, CalendarCheck, CalendarClock, BellRing, FileText,
  Trophy, Wallet, RefreshCw, FileCheck2, Home, Banknote,
} from 'lucide-react'
import { notificationsApi } from '../../services/notificationsApi'

const EVENT_META = {
  new_lead:             { label: 'New Lead',        icon: FileText,     color: '#F95C4B' },
  hot_lead:             { label: 'Hot Lead',         icon: Flame,        color: '#EF4444' },
  lead_status_updated:  { label: 'Status Updated',   icon: RefreshCw,    color: '#3B82F6' },
  appointment_booked:   { label: 'Appointment',      icon: CalendarClock,color: '#3B82F6' },
  appointment_confirmed:{ label: 'Confirmed',        icon: CalendarCheck,color: '#10B981' },
  appointment_reminder: { label: 'Reminder',         icon: BellRing,     color: '#F59E0B' },
  listing_signed:       { label: 'Listing Signed',   icon: FileCheck2,   color: '#10B981' },
  property_rented:      { label: 'Property Rented',  icon: Home,         color: '#10B981' },
  property_sold:        { label: 'Property Sold',    icon: Home,         color: '#10B981' },
  personal_record:      { label: 'Personal Record',  icon: Trophy,       color: '#F59E0B' },
  daily_winner:         { label: 'Daily Winner',     icon: Trophy,       color: '#F59E0B' },
  commission_due:       { label: 'Commission Due',   icon: Wallet,       color: '#8B5CF6' },
  renewal_due:          { label: 'Renewal Due',      icon: Banknote,     color: '#8B5CF6' },
}
const DEFAULT_META = { label: 'Notification', icon: Bell, color: '#6B7280' }

function metaFor(event) {
  return EVENT_META[event] ?? DEFAULT_META
}

function NotificationCard({ n, onMarkRead, isMarking }) {
  const meta = metaFor(n.event)
  const Icon = meta.icon
  const unread = !n.readAt

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
      unread
        ? 'bg-[#FFF5F4] dark:bg-[#1E1311] border-[#F95C4B]/25'
        : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A]'
    }`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${meta.color}18` }}>
        <Icon className="w-5 h-5" style={{ color: meta.color }} strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-[#111111] dark:text-white">{n.title}</p>
          {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#F95C4B] flex-shrink-0" />}
        </div>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 leading-relaxed">{n.message}</p>
        <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60 mt-1.5">
          {format(new Date(n.createdAt), 'd MMM yyyy, HH:mm')} · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>

      {unread && (
        <button
          onClick={() => onMarkRead(n._id)}
          disabled={isMarking}
          title="Mark as read"
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F95C4B]/10 hover:text-[#F95C4B] disabled:opacity-50 transition-colors"
        >
          {isMarking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}

function EmptyState({ unreadOnly }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <Bell className="w-8 h-8 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {unreadOnly ? "You're all caught up" : 'No notifications yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
        {unreadOnly
          ? 'No unread notifications right now.'
          : 'System alerts, lead updates and reminders will appear here.'}
      </p>
    </div>
  )
}

export default function AdminNotificationsPage() {
  const qc = useQueryClient()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-notifications-page', { page, unreadOnly }],
    queryFn: () => notificationsApi.list({ page, limit: 20, unread: unreadOnly ? 'true' : undefined }),
    placeholderData: keepPreviousData,
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 15_000,
  })

  const notifications = data?.notifications ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const markReadMut = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications-page'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Could not mark as read'),
  })

  const markAllMut = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: ({ modifiedCount }) => {
      qc.invalidateQueries({ queryKey: ['admin-notifications-page'] })
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(`${modifiedCount} notification${modifiedCount !== 1 ? 's' : ''} marked as read`)
    },
    onError: () => toast.error('Could not mark all as read'),
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              Notifications
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : `${total} total · ${unreadCount} unread`}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 shadow-sm hover:shadow-md active:scale-[0.98] transition-all self-start sm:self-auto"
            >
              {markAllMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Mark all read
            </button>
          )}
        </div>

        <div className="flex gap-0.5 overflow-x-auto pb-px">
          {[{ key: false, label: 'All' }, { key: true, label: 'Unread' }].map((tab) => (
            <button
              key={String(tab.key)}
              onClick={() => { setUnreadOnly(tab.key); setPage(1) }}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap',
                'border-b-2 transition-all rounded-t-lg',
                unreadOnly === tab.key
                  ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.label}
              {tab.key && unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F95C4B]/15 text-[#F95C4B]">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 bg-[#FAFAF9] dark:bg-[#0B0B0B]">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load notifications.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState unreadOnly={unreadOnly} />
        ) : (
          <>
            <div className="space-y-3">
              {notifications.map((n) => (
                <NotificationCard
                  key={n._id}
                  n={n}
                  onMarkRead={(id) => markReadMut.mutate(id)}
                  isMarking={markReadMut.isPending && markReadMut.variables === n._id}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
