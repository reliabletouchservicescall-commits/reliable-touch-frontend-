/**
 * Full-page chat for agency and cold_caller roles.
 * Each non-admin user has exactly one conversation — with admin.
 */
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, MessageSquare, Shield, Wifi, WifiOff } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import { chatApi } from '../../services/chatApi'
import { useSocket } from '../../context/SocketContext'
import { useAuthStore } from '../../store/authStore'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(date) {
  return format(new Date(date), 'HH:mm')
}

function dateSeparatorLabel(date) {
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

// ── DateSeparator ─────────────────────────────────────────────────────────────

function DateSeparator({ label }) {
  return (
    <div className="flex items-center gap-3 my-4 select-none">
      <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
      <span className="text-[10px] font-semibold tracking-wide text-[#6B7280] dark:text-[#A1A1AA] uppercase px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine, isFirstInGroup, isLastInGroup }) {
  const senderInitials = msg.senderId
    ? `${msg.senderId.firstName?.[0] ?? ''}${msg.senderId.lastName?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div className={`flex items-end gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar — show only for last message in a group from the other side */}
      {!isMine && (
        <div className="flex-shrink-0 w-7 h-7 mb-0.5">
          {isLastInGroup ? (
            <div className="w-7 h-7 rounded-full bg-[#F95C4B]/15 flex items-center justify-center border border-[#F95C4B]/20">
              <span className="text-[9px] font-bold text-[#F95C4B]">{senderInitials}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[68%] sm:max-w-[55%] ${isMine ? 'items-end' : 'items-start'}`}>
        {/* Sender name — only for first message in group from other side */}
        {!isMine && isFirstInGroup && (
          <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] ml-1">
            Admin
          </span>
        )}

        <div
          className={`px-4 py-2.5 text-sm leading-relaxed ${
            isMine
              ? 'bg-[#F95C4B] text-white rounded-2xl rounded-br-sm shadow-sm'
              : 'bg-white dark:bg-[#232323] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl rounded-bl-sm shadow-sm'
          }`}
        >
          {msg.content}
        </div>

        {isLastInGroup && (
          <div className={`flex items-center gap-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-[#9CA3AF] dark:text-[#6B7280]">
              {formatTime(msg.createdAt)}
            </span>
            {isMine && msg.readAt && (
              <span className="text-[10px] text-emerald-500 font-medium">✓✓</span>
            )}
            {isMine && !msg.readAt && (
              <span className="text-[10px] text-[#9CA3AF]">✓</span>
            )}
          </div>
        )}
      </div>

      {isMine && <div className="flex-shrink-0 w-7" />}
    </div>
  )
}

// ── TypingIndicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 justify-start">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#F95C4B]/15 flex items-center justify-center border border-[#F95C4B]/20">
        <span className="text-[9px] font-bold text-[#F95C4B]">AD</span>
      </div>
      <div className="bg-white dark:bg-[#232323] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#111111] dark:text-white">No messages yet</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">
          Send your first message to the admin below
        </p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserChatPage() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isAdminTyping, setIsAdminTyping] = useState(false)
  const [convId, setConvId] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const { getSocket, registerMessageHandler, onlineUsers, setChatUnread } = useSocket()
  const queryClient = useQueryClient()

  // Load the conversation with admin
  const { data: convData, isLoading: loadingConv } = useQuery({
    queryKey: ['chat', 'my-conversation'],
    queryFn: chatApi.myConversation,
    staleTime: Infinity,
  })

  const conversation = convData?.conversation
  const adminParticipant = conversation?.participants?.find(
    (p) => p._id?.toString() !== user?._id?.toString()
  )
  const isAdminOnline = adminParticipant && onlineUsers.has(adminParticipant._id?.toString())

  useEffect(() => {
    if (conversation?._id) setConvId(conversation._id)
  }, [conversation])

  // Load messages
  const { data: msgData, isLoading: loadingMessages } = useQuery({
    queryKey: ['chat', 'messages', convId],
    queryFn: () => chatApi.getMessages(convId, { limit: 100 }),
    enabled: !!convId,
    staleTime: 0,
  })

  useEffect(() => {
    if (msgData?.messages) setMessages(msgData.messages)
  }, [msgData])

  // Join socket room + register handlers
  useEffect(() => {
    if (!convId) return
    const sock = getSocket()
    if (!sock) return

    sock.emit('join_conversation', convId)
    sock.emit('mark_read', { conversationId: convId })
    setChatUnread(0)

    const unsubMsg = registerMessageHandler(convId, (msg) => {
      setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [...prev, msg])
      sock.emit('mark_read', { conversationId: convId })
      setChatUnread(0)
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    })

    const unsubTyping = registerMessageHandler(`typing:${convId}`, ({ isTyping }) => {
      setIsAdminTyping(isTyping)
    })

    const unsubRead = registerMessageHandler(`read:${convId}`, () => {
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId?._id === user?._id || m.senderId === user?._id
            ? { ...m, readAt: m.readAt ?? new Date().toISOString() }
            : m
        )
      )
    })

    return () => {
      unsubMsg()
      unsubTyping()
      unsubRead()
    }
  }, [convId, getSocket, registerMessageHandler, setChatUnread, queryClient, user?._id])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAdminTyping])

  function handleSend() {
    const text = input.trim()
    if (!text || !convId) return

    const sock = getSocket()
    if (!sock?.connected) {
      toast.error('Not connected — please try again')
      return
    }

    sock.emit('send_message', { conversationId: convId, content: text })
    setInput('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    const sock = getSocket()
    if (!sock || !convId) return
    sock.emit('typing', { conversationId: convId, isTyping: true })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      sock.emit('typing', { conversationId: convId, isTyping: false })
    }, 1500)
  }

  // Build grouped messages with date separators
  const grouped = []
  let lastDate = null
  let lastSenderId = null
  messages.forEach((msg, i) => {
    const dateKey = format(new Date(msg.createdAt), 'yyyy-MM-dd')
    if (dateKey !== lastDate) {
      grouped.push({ type: 'date', label: dateSeparatorLabel(msg.createdAt), key: `d-${dateKey}` })
      lastDate = dateKey
      lastSenderId = null
    }

    const senderId = msg.senderId?._id ?? msg.senderId
    const nextMsg = messages[i + 1]
    const nextSenderId = nextMsg ? (nextMsg.senderId?._id ?? nextMsg.senderId) : null
    const nextDateKey = nextMsg ? format(new Date(nextMsg.createdAt), 'yyyy-MM-dd') : null

    const isFirstInGroup = senderId !== lastSenderId
    const isLastInGroup = senderId !== nextSenderId || dateKey !== nextDateKey
    const isMine = senderId?.toString() === user?._id?.toString()

    grouped.push({ type: 'msg', msg, isMine, isFirstInGroup, isLastInGroup, key: msg._id })
    lastSenderId = senderId
  })

  const isLoading = loadingConv || (convId && loadingMessages)

  return (
    <div className="flex flex-col h-full bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-[#F95C4B]/15 border border-[#F95C4B]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#F95C4B]" strokeWidth={2} />
          </div>
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#181818] ${
              isAdminOnline ? 'bg-emerald-500' : 'bg-[#9CA3AF]'
            }`}
          />
        </div>

        <div>
          <p className="text-sm font-bold text-[#111111] dark:text-white">Admin Support</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isAdminOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px] text-emerald-500 font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-[11px] text-[#9CA3AF]">Offline — messages delivered when they return</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 space-y-1.5 bg-[#FAFAF9] dark:bg-[#0B0B0B]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[#F95C4B] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Loading messages…</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          grouped.map((item) =>
            item.type === 'date' ? (
              <DateSeparator key={item.key} label={item.label} />
            ) : (
              <MessageBubble
                key={item.key}
                msg={item.msg}
                isMine={item.isMine}
                isFirstInGroup={item.isFirstInGroup}
                isLastInGroup={item.isLastInGroup}
              />
            )
          )
        )}

        {isAdminTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-10 py-4 bg-white dark:bg-[#181818] border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message admin… (Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={!convId}
              className="w-full resize-none px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111] text-sm text-[#111111] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F95C4B]/30 focus:border-[#F95C4B] transition-all disabled:opacity-50 max-h-40 overflow-y-auto"
              style={{ lineHeight: '1.6' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || !convId}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#F95C4B] text-white shadow-sm hover:bg-[#e84d3c] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-[#9CA3AF] dark:text-[#6B7280] mt-2">
          Messages are delivered in real time
        </p>
      </div>
    </div>
  )
}
