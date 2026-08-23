import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, X, Send, ChevronDown, Paperclip,
  Image, Film, FileText, File, FileSpreadsheet, Download,
  ZoomIn, Loader2,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { chatApi } from '../../services/chatApi'
import { useSocket } from '../../context/SocketContext'
import { useAuthStore } from '../../store/authStore'

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatTime(date) {
  return format(new Date(date), 'HH:mm')
}

function fmtBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeIcon(name = '', mimeType = '') {
  if (mimeType.startsWith('image/'))  return { Icon: Image,           color: '#3B82F6' }
  if (mimeType.startsWith('video/'))  return { Icon: Film,            color: '#8B5CF6' }
  if (mimeType.includes('pdf'))       return { Icon: FileText,        color: '#EF4444' }
  if (mimeType.includes('sheet') || name.match(/\.xlsx?$/i)) return { Icon: FileSpreadsheet, color: '#10B981' }
  if (mimeType.includes('word')  || name.match(/\.docx?$/i)) return { Icon: FileText, color: '#3B82F6' }
  return { Icon: File, color: '#6B7280' }
}

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/* ─── Lightbox ────────────────────────────────────────────────────── */

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4"
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

/* ─── Attachment renderers ────────────────────────────────────────── */

function ImageAttachment({ att }) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <div
        className="relative group cursor-zoom-in overflow-hidden rounded-xl"
        style={{ maxWidth: 200 }}
        onClick={() => setLightbox(true)}
      >
        <img
          src={att.url}
          alt={att.name}
          className="w-full object-cover rounded-xl"
          style={{ maxHeight: 180 }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </div>
      {lightbox && <Lightbox src={att.url} alt={att.name} onClose={() => setLightbox(false)} />}
    </>
  )
}

function VideoAttachment({ att }) {
  return (
    <video
      controls
      preload="metadata"
      className="rounded-xl"
      style={{ maxWidth: 220, maxHeight: 160 }}
    >
      <source src={att.url} type={att.mimeType} />
    </video>
  )
}

function DocumentAttachment({ att, isMine }) {
  const { Icon, color } = fileTypeIcon(att.name, att.mimeType)
  return (
    <a
      href={att.url}
      download={att.name}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border max-w-[220px] group transition-colors ${
        isMine
          ? 'border-white/20 bg-white/10 hover:bg-white/20'
          : 'border-[#E5E7EB] dark:border-[#3A3A3A] bg-white dark:bg-[#2A2A2A] hover:bg-[#F3F4F6] dark:hover:bg-[#3A3A3A]'
      }`}
    >
      <Icon style={{ color }} className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isMine ? 'text-white' : 'text-[#111111] dark:text-white'}`}>
          {att.name}
        </p>
        {att.size > 0 && (
          <p className={`text-[10px] ${isMine ? 'text-white/60' : 'text-[#9CA3AF]'}`}>{fmtBytes(att.size)}</p>
        )}
      </div>
      <Download className={`w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'text-white' : 'text-[#6B7280]'}`} />
    </a>
  )
}

function AttachmentList({ attachments, isMine }) {
  if (!attachments?.length) return null
  const images = attachments.filter((a) => a.fileType === 'image')
  const videos = attachments.filter((a) => a.fileType === 'video')
  const docs   = attachments.filter((a) => a.fileType === 'document')

  return (
    <div className="flex flex-col gap-1.5 mb-1">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((a, i) => <ImageAttachment key={i} att={a} isMine={isMine} />)}
        </div>
      )}
      {videos.map((a, i) => <VideoAttachment key={i} att={a} />)}
      {docs.map((a, i) => <DocumentAttachment key={i} att={a} isMine={isMine} />)}
    </div>
  )
}

/* ─── File preview chip (pre-send) ───────────────────────────────── */

function FilePreviewChip({ file, onRemove }) {
  const isImage = file.type.startsWith('image/')
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  return (
    <div className="relative flex-shrink-0 group">
      {isImage && src ? (
        <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#3A3A3A]">
          <img src={src} alt={file.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#3A3A3A] bg-[#F3F4F6] dark:bg-[#2A2A2A] max-w-[120px]">
          {(() => { const { Icon, color } = fileTypeIcon(file.name, file.type); return <Icon style={{ color }} className="w-3.5 h-3.5 flex-shrink-0" /> })()}
          <span className="text-[10px] truncate text-[#374151] dark:text-white">{file.name}</span>
        </div>
      )}
      <button
        onClick={() => onRemove(file)}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#EF4444] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  )
}

/* ─── Message bubble ─────────────────────────────────────────────── */

function MessageBubble({ msg, isMine }) {
  const hasAttachments = msg.attachments?.length > 0
  const hasText = msg.content?.trim()

  return (
    <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {hasAttachments && <AttachmentList attachments={msg.attachments} isMine={isMine} />}
        {hasText && (
          <div
            className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
              isMine
                ? 'bg-[#F95C4B] text-white rounded-br-sm'
                : 'bg-white dark:bg-[#2A2A2A] text-[#111111] dark:text-white border border-[#E5E7EB] dark:border-[#3A3A3A] rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        )}
        <span className={`text-[9px] mt-0.5 ${isMine ? 'text-[#9CA3AF] text-right' : 'text-[#9CA3AF]'}`}>
          {formatTime(msg.createdAt)}
        </span>
      </div>
    </div>
  )
}

/* ─── ChatWidget ─────────────────────────────────────────────────── */

export default function ChatWidget() {
  const [isOpen, setIsOpen]             = useState(false)
  const [input, setInput]               = useState('')
  const [messages, setMessages]         = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [isTyping, setIsTyping]         = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadPct, setUploadPct]       = useState(0)
  const [isSending, setIsSending]       = useState(false)
  const [isDragging, setIsDragging]     = useState(false)

  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const fileInputRef    = useRef(null)
  const typingTimeoutRef = useRef(null)

  const { getSocket, registerMessageHandler, onlineUsers } = useSocket()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  // Load conversation
  const { data: convData } = useQuery({
    queryKey: ['chat', 'my-conversation'],
    queryFn: chatApi.myConversation,
    staleTime: Infinity,
  })

  const conversation = convData?.conversation
  const convId = conversation?._id

  useEffect(() => {
    if (convId) setConversationId(convId)
  }, [convId])

  // Load messages
  const { data: msgData } = useQuery({
    queryKey: ['chat', 'messages', convId],
    queryFn: () => chatApi.getMessages(convId, { limit: 100 }),
    enabled: !!convId,
    staleTime: 0,
  })

  useEffect(() => {
    if (msgData?.messages) setMessages(msgData.messages)
  }, [msgData])

  // Socket handlers
  useEffect(() => {
    if (!convId) return
    const sock = getSocket()
    if (!sock) return

    sock.emit('join_conversation', convId)

    const unsubMsg = registerMessageHandler(convId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev
        return [...prev, msg]
      })
      if (isOpen) {
        sock.emit('mark_read', { conversationId: convId })
      } else {
        const preview = msg.content?.trim()
          ? msg.content.slice(0, 60)
          : msg.attachments?.length
          ? `📎 ${msg.attachments.length} attachment(s)`
          : ''
        toast.message('New message from Admin', {
          description: preview,
          action: { label: 'Open', onClick: () => setIsOpen(true) },
        })
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] })
    })

    const unsubTyping = registerMessageHandler(`typing:${convId}`, ({ isTyping: t }) => {
      setIsTyping(t)
    })

    return () => { unsubMsg(); unsubTyping() }
  }, [convId, getSocket, registerMessageHandler, isOpen, queryClient])

  // Mark read on open
  useEffect(() => {
    if (!isOpen || !convId) return
    const sock = getSocket()
    sock?.emit('mark_read', { conversationId: convId })
    queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
  }, [isOpen, convId, getSocket, queryClient])

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, isOpen])

  // ── File handling ──────────────────────────────────────────────────

  function addFiles(newFiles) {
    const validated = []
    for (const f of newFiles) {
      if (!ALLOWED_MIME.includes(f.type)) {
        toast.error(`${f.name}: file type not allowed`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: exceeds 50 MB limit`)
        continue
      }
      validated.push(f)
    }
    setPendingFiles((prev) => [...prev, ...validated])
  }

  function removeFile(file) {
    setPendingFiles((prev) => prev.filter((f) => f !== file))
  }

  function handleFileInput(e) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  // Drag-and-drop on compose area
  function onDragOver(e) { e.preventDefault(); setIsDragging(true) }
  function onDragLeave(e) { e.preventDefault(); setIsDragging(false) }
  function onDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  // ── Send ───────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim()
    if (!text && !pendingFiles.length) return
    if (!convId) return

    const sock = getSocket()
    if (!sock?.connected) { toast.error('Not connected'); return }

    setIsSending(true)
    setUploadPct(0)

    try {
      let attachments = []
      if (pendingFiles.length) {
        attachments = await chatApi.uploadAttachments(convId, pendingFiles, (pct) => setUploadPct(pct))
        setPendingFiles([])
      }

      sock.emit('send_message', { conversationId: convId, content: text, attachments })
      setInput('')
      setUploadPct(0)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send')
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
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

  // Admin online status
  const adminParticipant = conversation?.participants?.find(
    (p) => p.role === 'admin' || (p._id && p._id !== user?._id)
  )
  const isAdminOnline = adminParticipant && onlineUsers.has(adminParticipant._id)

  const localUnread = messages.filter(
    (m) => !m.readAt && (m.senderId?._id ?? m.senderId) !== user?._id
  ).length
  const badgeCount = isOpen ? 0 : localUnread

  const canSend = !isSending && (input.trim().length > 0 || pendingFiles.length > 0)

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {isOpen && (
        <div
          className="w-80 sm:w-96 flex flex-col bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden"
          style={{ height: '520px' }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 bg-[#F95C4B]/10 border-2 border-dashed border-[#F95C4B] rounded-2xl flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Paperclip className="w-6 h-6 text-[#F95C4B] mx-auto mb-1" />
                <p className="text-sm font-medium text-[#F95C4B]">Drop files here</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-[#F95C4B]">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xs font-bold text-white">AD</span>
              </div>
              {isAdminOnline && (
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Admin Support</p>
              <p className="text-[10px] text-white/80">{isAdminOnline ? 'Online' : 'Offline'}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#FAFAF9] dark:bg-[#111111]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageSquare className="w-8 h-8 text-[#6B7280]/30" strokeWidth={1.5} />
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Send a message to the admin</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg._id}
                  msg={msg}
                  isMine={(msg.senderId?._id ?? msg.senderId) === user?._id}
                />
              ))
            )}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 bg-white dark:bg-[#2A2A2A] border border-[#E5E7EB] dark:border-[#3A3A3A] rounded-xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-[#9CA3AF] animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-[#9CA3AF]">Admin is typing…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          <div className="flex-shrink-0 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            {/* Upload progress */}
            {isSending && uploadPct > 0 && uploadPct < 100 && (
              <div className="px-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#E5E7EB] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F95C4B] rounded-full transition-all duration-300"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#9CA3AF]">{uploadPct}%</span>
                </div>
              </div>
            )}

            {/* File previews */}
            {pendingFiles.length > 0 && (
              <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-wrap">
                {pendingFiles.map((f, i) => (
                  <FilePreviewChip key={i} file={f} onRemove={removeFile} />
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2 px-3 py-2.5">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_MIME.join(',')}
                className="hidden"
                onChange={handleFileInput}
              />

              {/* Paperclip */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#F95C4B] hover:bg-[#F95C4B]/10 transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message admin…"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111] text-[#111111] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F95C4B]/30 focus:border-[#F95C4B] transition-all"
              />

              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-[#F95C4B] text-white disabled:opacity-40 hover:bg-[#e84d3c] active:scale-95 transition-all"
              >
                {isSending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative w-13 h-13 flex items-center justify-center rounded-full bg-[#F95C4B] text-white shadow-lg hover:bg-[#e84d3c] active:scale-95 transition-all"
        style={{ width: '52px', height: '52px' }}
        aria-label="Open chat"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#F95C4B] text-[9px] font-bold flex items-center justify-center border border-[#F95C4B]">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>
    </div>
  )
}
