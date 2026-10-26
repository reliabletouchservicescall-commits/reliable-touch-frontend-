import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, Trophy, MessageSquare, PhoneCall, PencilLine, Sparkles, Repeat } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
import { attachPresence } from '../lib/livePresence'
import Fireworks from '../components/common/Fireworks'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { accessToken, isAuthenticated } = useAuthStore()
  const qc = useQueryClient()
  const [chatUnread, setChatUnread] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [showFireworks, setShowFireworks] = useState(false)
  // Global message handlers registered by chat components
  const messageHandlers = useRef(new Map())

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(accessToken)
    attachPresence()

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message)
    })

    socket.on('chat_unread_count', ({ count }) => {
      setChatUnread(count)
    })

    // Everyone already online at the moment we connect (user_status only covers changes after).
    socket.on('online_users', (userIds = []) => {
      setOnlineUsers(new Set(userIds))
    })

    socket.on('user_status', ({ userId, online }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        if (online) next.add(userId)
        else next.delete(userId)
        return next
      })
    })

    // Forward new_message to any registered handler (active chat windows). The server
    // delivers every message to each participant's personal room too, so this fires even
    // when the conversation isn't open — keep the inbox list fresh and toast the user.
    socket.on('new_message', (message) => {
      const convId = message.conversationId
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      const handler = messageHandlers.current.get(convId)
      if (handler) {
        handler(message)
        return
      }
      qc.invalidateQueries({ queryKey: ['chat', 'messages', convId] })
      const senderId = message.senderId?._id ?? message.senderId
      if (senderId && senderId === useAuthStore.getState().user?._id) return // own message from another tab
      const name = `${message.senderId?.firstName ?? ''} ${message.senderId?.lastName ?? ''}`.trim()
      toast.message(`New message from ${name || 'a teammate'}`, {
        description: message.content ? message.content.slice(0, 80) : `📎 ${message.attachments?.length ?? 0} attachment(s)`,
      })
    })

    socket.on('user_typing', ({ userId, conversationId, isTyping }) => {
      const key = `typing:${conversationId}`
      const handler = messageHandlers.current.get(key)
      if (handler) handler({ userId, isTyping })
    })

    socket.on('messages_read', ({ conversationId, byUserId }) => {
      const key = `read:${conversationId}`
      const handler = messageHandlers.current.get(key)
      if (handler) handler({ byUserId })
    })

    // Someone worked a lead you're on (see leadActivity.js on the server — company leads,
    // and notifyLeadParticipants for everyone involved: admin, its cold caller, its
    // follow-up managers, its agent) — refresh whatever shows that lead, and when it's news
    // for you, say so with a link straight to it.
    const LEAD_ACTIVITY_ICONS = { comment: MessageSquare, call: PhoneCall, updated: PencilLine, created: Sparkles, status: Repeat }
    socket.on('lead_activity', (a = {}) => {
      const keys = [
        ['lead', a.leadId], ['lead-comments', a.leadId], ['call-history'], ['agent-leads'], ['agent-leads-stats'],
        ['lead-insights'], ['agency-overview'], ['notifications'], ['agency-notifications-page'],
        ['lead-history', a.leadId], ['leads'], ['admin-leads'],
      ]
      keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
      if (a.quiet || !a.message) return
      const Icon = LEAD_ACTIVITY_ICONS[a.kind] ?? Sparkles
      const role = useAuthStore.getState().user?.role
      const base = { admin: '/admin', cold_caller: '/cold-caller', follow_up_manager: '/follow-up-manager', agency: '/agency' }[role] ?? '/agency'
      const url = `${base}/leads?lead=${a.leadId}`
      toast(a.title ?? `${a.byName} worked a lead`, {
        description: a.message,
        icon: <Icon className="w-4 h-4 text-[#F95C4B]" />,
        duration: 7000,
        // The provider sits outside the router — move through history so the router follows
        action: window.location.pathname + window.location.search === url ? undefined : {
          label: 'Open',
          onClick: () => { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')) },
        },
      })
    })

    // A cold caller (other than you) just landed a hot lead — live, competitive nudge.
    socket.on('hot_lead_created', ({ callerName, landlordName, propertyAddress }) => {
      toast(`${callerName} just landed a HOT lead!`, {
        description: `${landlordName} — ${propertyAddress}`,
        icon: <Flame className="w-4 h-4 text-[#EF4444]" />,
      })
      qc.invalidateQueries({ queryKey: ['performance'] })
    })

    // Someone else just took #1 — for today's leaderboard or this month's, checked
    // independently server-side (see performance.service.js checkColdCallerChampion).
    socket.on('leaderboard_leader_changed', ({ newLeaderName, period }) => {
      const scope = period === 'day' ? "today's leaderboard" : 'the leaderboard this month'
      toast(`${newLeaderName} is now #1 on ${scope}!`, {
        icon: <Trophy className="w-4 h-4 text-[#F59E0B]" />,
      })
      qc.invalidateQueries({ queryKey: ['performance'] })
    })

    // You just became #1 — fireworks on your own screen.
    socket.on('you_are_leader', ({ period } = {}) => {
      setShowFireworks(true)
      const scope = period === 'day' ? "today's leaderboard" : 'the leaderboard this month'
      toast.success(`You're now #1 on ${scope}!`, {
        icon: <Trophy className="w-4 h-4" />,
      })
      qc.invalidateQueries({ queryKey: ['performance'] })
    })

    return () => {
      disconnectSocket()
    }
  }, [isAuthenticated, accessToken, qc])

  function registerMessageHandler(key, fn) {
    messageHandlers.current.set(key, fn)
    return () => messageHandlers.current.delete(key)
  }

  const value = {
    getSocket,
    chatUnread,
    setChatUnread,
    onlineUsers,
    registerMessageHandler,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
      {showFireworks && <Fireworks onDone={() => setShowFireworks(false)} />}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
