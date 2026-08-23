import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Send, Search, MessageSquare, Building2, Phone, User, Plus, X,
  Paperclip, Image, Film, FileText, Download, File, ZoomIn,
  FileSpreadsheet, Loader2, AlertCircle, CheckCheck,
} from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import { chatApi } from '../../services/chatApi'
import { usersApi } from '../../services/usersApi'
import { useSocket } from '../../context/SocketContext'
import { useAuthStore } from '../../store/authStore'

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtTime(date) {
  const d = new Date(date)
  if (isToday(d))     return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'dd MMM')
}
function fmtFull(date) { return format(new Date(date), 'HH:mm') }

function fmtBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeIcon(name = '', mimeType = '') {
  if (mimeType.startsWith('image/')) return { Icon: Image,          color: '#3B82F6' }
  if (mimeType.startsWith('video/')) return { Icon: Film,           color: '#8B5CF6' }
  if (mimeType.includes('pdf'))      return { Icon: FileText,       color: '#EF4444' }
  if (mimeType.includes('sheet') || name.match(/\.xlsx?$/i)) return { Icon: FileSpreadsheet, color: '#10B981' }
  if (mimeType.includes('word')  || name.match(/\.docx?$/i)) return { Icon: FileText,       color: '#3B82F6' }
  return { Icon: File, color: '#6B7280' }
}

function roleBadge(role) {
  const map = {
    agency:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    cold_caller: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    admin:       'bg-[#F95C4B]/10 text-[#F95C4B]',
  }
  const label  = { agency: 'Agency', cold_caller: 'Cold Caller', admin: 'Admin' }
  const Icon   = role === 'agency' ? Building2 : role === 'cold_caller' ? Phone : User
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${map[role] ?? ''}`}>
      <Icon className="w-3 h-3" /> {label[role] ?? role}
    </span>
  )
}

function initials(user) {
  return `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

/* ─── Lightbox ───────────────────────────────────────────────────────── */

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

/* ─── Attachment renderers ───────────────────────────────────────────── */

function ImageAttachment({ att, isMine }) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <div
        className="relative group cursor-zoom-in overflow-hidden rounded-xl"
        style={{ maxWidth: 240 }}
        onClick={() => setLightbox(true)}
      >
        <img
          src={att.url}
          alt={att.name}
          className="w-full object-cover rounded-xl max-h-[220px]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-all" />
        </div>
      </div>
      {lightbox && <Lightbox src={att.url} alt={att.name} onClose={() => setLightbox(false)} />}
    </>
  )
}

function VideoAttachment({ att }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ maxWidth: 280 }}>
      <video
        src={att.url}
        controls
        preload="metadata"
        className="w-full rounded-xl max-h-[220px] bg-black"
      />
    </div>
  )
}

function DocumentAttachment({ att, isMine }) {
  const { Icon, color } = fileTypeIcon(att.name, att.mimeType)
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer"
      className={[
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all group',
        isMine
          ? 'bg-white/15 hover:bg-white/25'
          : 'bg-[#F5F5F4] dark:bg-[#2A2A2A] border border-[#E5E7EB] dark:border-[#3A3A3A] hover:border-[#D1D5DB] dark:hover:border-[#444]',
      ].join(' ')}
      style={{ maxWidth: 280 }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold truncate ${isMine ? 'text-white' : 'text-[#111111] dark:text-white'}`}>
          {att.name}
        </p>
        <p className={`text-[10px] mt-0.5 ${isMine ? 'text-white/60' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
          {fmtBytes(att.size)}
        </p>
      </div>
      <Download className={`w-4 h-4 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ${isMine ? 'text-white' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`} />
    </a>
  )
}

function AttachmentList({ attachments, isMine }) {
  if (!attachments?.length) return null

  const images = attachments.filter((a) => a.fileType === 'image')
  const videos = attachments.filter((a) => a.fileType === 'video')
  const docs   = attachments.filter((a) => a.fileType === 'document')

  return (
    <div className="space-y-1.5">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((att, i) => (
            <ImageAttachment key={i} att={att} isMine={isMine} />
          ))}
        </div>
      )}
      {/* Videos */}
      {videos.map((att, i) => <VideoAttachment key={i} att={att} isMine={isMine} />)}
      {/* Documents */}
      {docs.map((att, i) => <DocumentAttachment key={i} att={att} isMine={isMine} />)}
    </div>
  )
}

/* ─── File preview (compose area) ───────────────────────────────────── */

function FilePreviewChip({ file, onRemove }) {
  const isImg = file.type.startsWith('image/')
  const isVid = file.type.startsWith('video/')
  const { Icon, color } = fileTypeIcon(file.name, file.type)
  const previewUrl = isImg ? URL.createObjectURL(file) : null

  return (
    <div className="relative flex-shrink-0 group">
      {isImg ? (
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#2A2A2A]">
          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-[#E5E7EB] dark:border-[#2A2A2A] max-w-[140px]">
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
          <span className="text-[10px] font-semibold text-[#111111] dark:text-white truncate">{file.name}</span>
        </div>
      )}
      <button
        onClick={() => onRemove(file)}
        className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#EF4444] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        style={{ width: '18px', height: '18px' }}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  )
}

/* ─── Message bubble ─────────────────────────────────────────────────── */

function MessageBubble({ msg, isMine, showTime, isLastInGroup }) {
  const hasAttachments = msg.attachments?.length > 0
  const hasText = msg.content?.trim()

  return (
    <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && isLastInGroup && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F95C4B]/20 to-[#F95C4B]/40 flex items-center justify-center flex-shrink-0 mb-1">
          <span className="text-[9px] font-bold text-[#F95C4B]">{initials(msg.senderId)}</span>
        </div>
      )}
      {!isMine && !isLastInGroup && <div className="w-6 flex-shrink-0" />}

      <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
        {/* Attachments */}
        {hasAttachments && (
          <div className={`${isMine ? 'items-end' : 'items-start'}`}>
            <AttachmentList attachments={msg.attachments} isMine={isMine} />
          </div>
        )}

        {/* Text bubble */}
        {hasText && (
          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMine
              ? 'bg-[#F95C4B] text-white rounded-br-sm'
              : 'bg-white dark:bg-[#232323] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-bl-sm'
          } ${hasAttachments ? (isMine ? 'rounded-tr-sm' : 'rounded-tl-sm') : ''}`}>
            {msg.content}
          </div>
        )}

        {/* Timestamp + read status */}
        {showTime && (
          <span className={`text-[10px] text-[#6B7280] dark:text-[#A1A1AA] px-1 flex items-center gap-1 ${isMine ? 'flex-row-reverse' : ''}`}>
            {fmtFull(msg.createdAt)}
            {isMine && msg.readAt && <CheckCheck className="w-3 h-3 text-emerald-500" />}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Date separator ─────────────────────────────────────────────────── */

function DateSeparator({ date }) {
  const d = new Date(date)
  let label = format(d, 'MMMM d, yyyy')
  if (isToday(d))     label = 'Today'
  else if (isYesterday(d)) label = 'Yesterday'
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
      <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide px-2">{label}</span>
      <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
    </div>
  )
}

/* ─── Compose bar ────────────────────────────────────────────────────── */

const ALLOWED_MIME = [
  'image/jpeg','image/png','image/gif','image/webp','image/heic',
  'video/mp4','video/quicktime','video/webm','video/avi',
  'application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024

function ComposeBar({ conversationId, onSent }) {
  const [text, setText]         = useState('')
  const [files, setFiles]       = useState([])   // File[] pending
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef    = useRef(null)
  const fileRef     = useRef(null)
  const typingRef   = useRef(null)
  const { getSocket } = useSocket()

  function addFiles(picked) {
    const valid = Array.from(picked).filter((f) => {
      if (!ALLOWED_MIME.includes(f.type)) { toast.error(`${f.name}: unsupported type`); return false }
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name}: max 50 MB`); return false }
      return true
    })
    setFiles((prev) => [...prev, ...valid].slice(0, 10))
  }

  function removeFile(f) {
    setFiles((prev) => prev.filter((p) => p !== f))
  }

  function handleDrop(e) {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleTextChange(e) {
    setText(e.target.value)
    const sock = getSocket()
    if (!sock || !conversationId) return
    sock.emit('typing', { conversationId, isTyping: true })
    clearTimeout(typingRef.current)
    typingRef.current = setTimeout(() => sock.emit('typing', { conversationId, isTyping: false }), 1500)
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed && !files.length) return
    const sock = getSocket()
    if (!sock?.connected) { toast.error('Not connected — please wait'); return }

    setUploading(true)
    setProgress(0)
    try {
      let attachments = []
      if (files.length) {
        attachments = await chatApi.uploadAttachments(conversationId, files, setProgress)
      }
      sock.emit('send_message', { conversationId, content: trimmed, attachments })
      setText('')
      setFiles([])
      inputRef.current?.focus()
      onSent?.()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const canSend = (text.trim() || files.length > 0) && !uploading

  return (
    <div
      className="flex-shrink-0 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* File previews */}
      {files.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <FilePreviewChip key={i} file={f} onRemove={removeFile} />
          ))}
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && (
        <div className="mx-4 mt-2 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
          <div
            className="h-full bg-[#F95C4B] rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Attach button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Attach files"
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] disabled:opacity-40 transition-all"
        >
          <Paperclip className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ALLOWED_MIME.join(',')}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          onClick={(e) => { e.target.value = '' }}
        />

        {/* Text area */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          placeholder={files.length ? 'Add a caption… (Enter to send)' : 'Type a message… (Enter to send)'}
          rows={1}
          disabled={uploading}
          className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111] text-sm text-[#111111] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F95C4B]/30 focus:border-[#F95C4B] transition-all max-h-28 overflow-y-auto disabled:opacity-50"
          style={{ lineHeight: '1.5' }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F95C4B] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e84d3c] active:scale-95 transition-all"
        >
          {uploading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Drop hint */}
      {!files.length && (
        <p className="text-center text-[10px] text-[#6B7280]/60 dark:text-[#A1A1AA]/40 pb-1.5">
          Drop files anywhere to attach
        </p>
      )}
    </div>
  )
}

/* ─── Chat window ────────────────────────────────────────────────────── */

function ChatWindow({ conversation, currentUserId }) {
  const [messages, setMessages]     = useState([])
  const [typingUsers, setTypingUsers] = useState(new Set())
  const messagesEndRef = useRef(null)
  const { getSocket, registerMessageHandler, onlineUsers } = useSocket()
  const queryClient = useQueryClient()

  const convId = conversation?._id

  const { isLoading } = useQuery({
    queryKey: ['chat', 'messages', convId],
    queryFn: () => chatApi.getMessages(convId, { limit: 100 }),
    enabled: !!convId,
    staleTime: 0,
    onSuccess: (d) => d?.messages && setMessages(d.messages),
  })

  // Also handle the case where onSuccess isn't called (React Query v5 compat)
  const { data: msgData } = useQuery({
    queryKey: ['chat', 'messages', convId],
    queryFn: () => chatApi.getMessages(convId, { limit: 100 }),
    enabled: !!convId,
    staleTime: 0,
  })
  useEffect(() => { if (msgData?.messages) setMessages(msgData.messages) }, [msgData])

  // Socket handlers
  useEffect(() => {
    if (!convId) return
    const sock = getSocket()
    if (!sock) return

    sock.emit('join_conversation', convId)
    sock.emit('mark_read', { conversationId: convId })

    const unsubMsg = registerMessageHandler(convId, (msg) => {
      setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [...prev, msg])
      sock.emit('mark_read', { conversationId: convId })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] })
    })
    const unsubTyping = registerMessageHandler(`typing:${convId}`, ({ userId, isTyping }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev)
        if (isTyping) next.add(userId); else next.delete(userId)
        return next
      })
    })
    const unsubRead = registerMessageHandler(`read:${convId}`, () => {
      setMessages((prev) => prev.map((m) => ({ ...m, readAt: m.readAt ?? new Date().toISOString() })))
    })

    return () => { unsubMsg(); unsubTyping(); unsubRead() }
  }, [convId, getSocket, registerMessageHandler, queryClient])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  useEffect(() => {
    if (!convId) return
    getSocket()?.emit('mark_read', { conversationId: convId })
    queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
  }, [convId, getSocket, queryClient])

  const other = conversation?.participants?.find((p) => p._id?.toString() !== currentUserId?.toString())
  const isOnline = other && onlineUsers.has(other._id?.toString())

  // Group messages by date
  const grouped = []
  let lastDate = null
  messages.forEach((msg, i) => {
    const dateKey = format(new Date(msg.createdAt), 'yyyy-MM-dd')
    if (dateKey !== lastDate) {
      grouped.push({ type: 'date', date: msg.createdAt, key: `date-${dateKey}` })
      lastDate = dateKey
    }
    const nextMsg = messages[i + 1]
    const isLastInGroup = !nextMsg
      || (nextMsg.senderId?._id ?? nextMsg.senderId) !== (msg.senderId?._id ?? msg.senderId)
      || format(new Date(nextMsg.createdAt), 'yyyy-MM-dd') !== dateKey
    grouped.push({ type: 'msg', msg, isLastInGroup, key: msg._id })
  })

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-[#F95C4B]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111111] dark:text-white">Select a conversation</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Choose a contact to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F95C4B]/20 to-[#F95C4B]/40 flex items-center justify-center">
            <span className="text-xs font-bold text-[#F95C4B]">{initials(other)}</span>
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#181818]" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111111] dark:text-white">
            {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
          </p>
          <div className="flex items-center gap-2">
            {other && roleBadge(other.role)}
            <span className={`text-[10px] font-medium ${isOnline ? 'text-emerald-500' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 bg-[#FAFAF9] dark:bg-[#0F0F0F]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-[#F95C4B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-[#F95C4B]" strokeWidth={1.5} />
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No messages yet. Say hi!</p>
          </div>
        ) : (
          grouped.map((item) =>
            item.type === 'date' ? (
              <DateSeparator key={item.key} date={item.date} />
            ) : (
              <MessageBubble
                key={item.key}
                msg={item.msg}
                isMine={(item.msg.senderId?._id ?? item.msg.senderId) === currentUserId}
                showTime={item.isLastInGroup}
                isLastInGroup={item.isLastInGroup}
              />
            )
          )
        )}

        {typingUsers.size > 0 && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-6 flex-shrink-0" />
            <div className="px-3.5 py-2.5 bg-white dark:bg-[#232323] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#6B7280] dark:bg-[#A1A1AA] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <ComposeBar
        conversationId={convId}
        onSent={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />
    </div>
  )
}

/* ─── Conversation item ──────────────────────────────────────────────── */

function ConversationItem({ conv, isActive, onClick, onlineUsers, currentUserId }) {
  const other  = conv.participants?.find((p) => p._id?.toString() !== currentUserId?.toString())
  const isOnl  = other && onlineUsers.has(other._id?.toString())
  const unread = conv.unreadForMe ?? 0

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors border-b border-[#F5F5F4] dark:border-[#202020] last:border-0 ${
        isActive ? 'bg-[#F95C4B]/8 dark:bg-[#F95C4B]/10' : 'hover:bg-[#F9F9F8] dark:hover:bg-[#1C1C1C]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F95C4B]/20 to-[#F95C4B]/40 flex items-center justify-center">
          <span className="text-[13px] font-bold text-[#F95C4B]">{initials(other)}</span>
        </div>
        {isOnl && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#181818]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-semibold truncate ${isActive ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
            {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
          </span>
          {conv.lastMessage?.at && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">
              {fmtTime(conv.lastMessage.at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          {other && roleBadge(other.role)}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
            {conv.lastMessage?.content || 'No messages yet'}
          </p>
          {unread > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F95C4B] text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ─── New chat picker ────────────────────────────────────────────────── */

function NewChatPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const { data } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.list({ limit: 100 }).then((r) => r.data.data?.users ?? []),
    staleTime: 60_000,
  })

  const users = (data ?? []).filter(
    (u) => u.role !== 'admin' && (
      !search ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-[#181818]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <Search className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
        <input
          autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users to message…"
          className="flex-1 text-xs bg-transparent text-[#111111] dark:text-white placeholder-[#9CA3AF] focus:outline-none"
        />
        <button onClick={onClose} className="text-[#6B7280] hover:text-[#F95C4B] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <p className="text-xs text-center text-[#6B7280] dark:text-[#A1A1AA] py-8">No users found</p>
        ) : (
          users.map((u) => (
            <button key={u._id} onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F9F9F8] dark:hover:bg-[#1C1C1C] transition-colors border-b border-[#F5F5F4] dark:border-[#202020] last:border-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F95C4B]/20 to-[#F95C4B]/40 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-[#F95C4B]">{initials(u)}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">{u.firstName} {u.lastName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {roleBadge(u.role)}
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{u.email}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/* ─── Main ChatPage ──────────────────────────────────────────────────── */

export default function ChatPage() {
  const { user } = useAuthStore()
  const [activeConvId, setActiveConvId] = useState(null)
  const [search, setSearch]             = useState('')
  const [showNewChat, setShowNewChat]   = useState(false)
  const queryClient = useQueryClient()
  const { registerMessageHandler, onlineUsers } = useSocket()

  const { data, isLoading } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatApi.listConversations,
    refetchInterval: 30_000,
  })

  const openConvMutation = useMutation({
    mutationFn: (userId) => chatApi.openConversation(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      setActiveConvId(data.conversation._id)
      setShowNewChat(false)
    },
    onError: () => toast.error('Could not open conversation'),
  })

  const conversations = data?.conversations ?? []
  const activeConv    = conversations.find((c) => c._id === activeConvId) ?? null

  const filtered = conversations.filter((c) => {
    if (!search) return true
    const other = c.participants?.find((p) => p._id?.toString() !== user?._id?.toString())
    const name  = `${other?.firstName ?? ''} ${other?.lastName ?? ''}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  useEffect(() => {
    const unsub = registerMessageHandler('__conversations_refresh__', () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    })
    return unsub
  }, [registerMessageHandler, queryClient])

  return (
    <div className="flex h-full overflow-hidden bg-[#FAFAF9] dark:bg-[#0B0B0B]">

      {/* Left panel */}
      <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] relative">
        {showNewChat && (
          <NewChatPicker
            onSelect={(u) => openConvMutation.mutate(u._id)}
            onClose={() => setShowNewChat(false)}
          />
        )}

        {/* Header */}
        <div className="px-4 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#111111] dark:text-white">Messages</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Chat with your team</p>
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            title="New conversation"
            className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 text-[#F95C4B] hover:bg-[#F95C4B]/20 flex items-center justify-center transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA]" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111] text-[#111111] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F95C4B]/30 focus:border-[#F95C4B]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#F95C4B] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
              <MessageSquare className="w-8 h-8 text-[#6B7280]/30 dark:text-[#A1A1AA]/30" strokeWidth={1.5} />
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                {search ? 'No conversations match your search' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationItem
                key={conv._id}
                conv={conv}
                isActive={conv._id === activeConvId}
                onClick={() => setActiveConvId(conv._id)}
                onlineUsers={onlineUsers}
                currentUserId={user?._id}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <ChatWindow conversation={activeConv} currentUserId={user?._id} />
    </div>
  )
}
