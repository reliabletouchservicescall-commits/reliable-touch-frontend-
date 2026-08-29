import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, Trophy } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
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

    socket.on('user_status', ({ userId, online }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        if (online) next.add(userId)
        else next.delete(userId)
        return next
      })
    })

    // Forward new_message to any registered handler (active chat windows)
    socket.on('new_message', (message) => {
      const convId = message.conversationId
      const handler = messageHandlers.current.get(convId)
      if (handler) {
        handler(message)
      } else {
        // User not viewing this conversation — show toast
        const name = `${message.senderId?.firstName ?? ''} ${message.senderId?.lastName ?? ''}`.trim()
        toast.message(`New message from ${name}`, {
          description: message.content.slice(0, 80),
        })
      }
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

    // A cold caller (other than you) just landed a hot lead — live, competitive nudge.
    socket.on('hot_lead_created', ({ callerName, landlordName, propertyAddress }) => {
      toast(`${callerName} just landed a HOT lead!`, {
        description: `${landlordName} — ${propertyAddress}`,
        icon: <Flame className="w-4 h-4 text-[#EF4444]" />,
      })
      qc.invalidateQueries({ queryKey: ['performance'] })
    })

    // Someone else just took #1 on the leaderboard this month.
    socket.on('leaderboard_leader_changed', ({ newLeaderName }) => {
      toast(`${newLeaderName} is now #1 on the leaderboard!`, {
        icon: <Trophy className="w-4 h-4 text-[#F59E0B]" />,
      })
      qc.invalidateQueries({ queryKey: ['performance'] })
    })

    // You just became #1 — fireworks on your own screen.
    socket.on('you_are_leader', () => {
      setShowFireworks(true)
      toast.success("You're now #1 on the leaderboard!", {
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
