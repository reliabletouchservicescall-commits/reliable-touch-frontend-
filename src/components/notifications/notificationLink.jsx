import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, FileText, CalendarCheck, BookUser, Inbox, PhoneOff, Megaphone, Trophy, MessageSquare, UserPlus, RefreshCw, Wallet,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

// Where a notification's "Open" button goes. The server works out *what* it points at
// (`n.link` — see notifications.service.js _attachLinks, which only hands out a lead link
// when this user may open that lead); this maps it to the route for the viewer's role.

const BASE = { admin: '/admin', cold_caller: '/cold-caller', agency: '/agency', follow_up_manager: '/follow-up-manager' }

export function notificationTarget(n, user) {
  const link = n?.link
  const base = BASE[user?.role]
  if (!link || !base) return null
  const role = user.role
  const manager = role === 'agency' && user.isAgencyManager
  switch (link.kind) {
    case 'lead':
      return { to: `${base}/leads/${link.id}`, label: 'Open lead', icon: FileText }
    case 'appointments':
      return { to: `${base}/appointments`, label: 'View appointments', icon: CalendarCheck }
    case 'contacts':
      return role === 'follow_up_manager' ? null : { to: `${base}/contacts`, label: role === 'cold_caller' ? 'Start calling' : 'View contacts', icon: BookUser }
    case 'contact_requests':
      return role === 'admin' ? { to: '/admin/contacts', label: 'Review request', icon: Inbox } : null
    case 'assign_contacts':
      return role === 'admin' ? { to: '/admin/contacts', label: 'Assign contacts', icon: UserPlus } : null
    case 'dnc':
      return role === 'follow_up_manager' ? null : { to: `${base}/dnc`, label: role === 'admin' || manager ? 'Review request' : 'View Do Not Call', icon: PhoneOff }
    case 'campaigns':
      return { to: `${base}/campaigns`, label: 'Open campaigns', icon: Megaphone }
    case 'leaderboard':
      if (role === 'admin') return { to: '/admin/performance', label: 'View performance', icon: Trophy }
      return role === 'follow_up_manager' ? null : { to: `${base}/leaderboard`, label: 'View leaderboard', icon: Trophy }
    case 'chat':
      return { to: `${base}/chat`, label: 'Open messages', icon: MessageSquare }
    case 'lease_renewals':
      return role === 'admin' ? { to: '/admin/lease-renewals', label: 'View renewals', icon: RefreshCw } : null
    case 'commissions':
      return role === 'admin' ? { to: '/admin/commissions', label: 'View commissions', icon: Wallet } : null
    default:
      return null
  }
}

export function useNotificationTarget(n) {
  const user = useAuthStore((st) => st.user)
  return notificationTarget(n, user)
}

// The coral "Open lead →" pill on a notification. Marks it read on the way out.
export function NotificationOpenButton({ n, onMarkRead, onNavigate, size = 'md' }) {
  const navigate = useNavigate()
  const target = useNotificationTarget(n)
  if (!target) return null
  const Icon = target.icon
  function open(e) {
    e.stopPropagation()
    if (!n.readAt) onMarkRead?.(n._id)
    onNavigate?.()
    navigate(target.to)
  }
  return (
    <button
      type="button"
      onClick={open}
      className={`group inline-flex items-center gap-1.5 rounded-lg font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B] hover:text-white active:scale-[0.97] transition-all ${
        size === 'sm' ? 'mt-1.5 px-2 py-1 text-[10px]' : 'mt-2.5 px-3 py-1.5 text-xs'
      }`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {target.label}
      {n.link?.kind === 'lead' && n.link.name && size !== 'sm' && <span className="font-normal opacity-80 max-w-[180px] truncate">· {n.link.name}</span>}
      <ArrowRight className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} transition-transform group-hover:translate-x-0.5`} />
    </button>
  )
}
