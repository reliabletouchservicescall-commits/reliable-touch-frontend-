import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Phone, Search, X, PhoneCall, PhoneOff, PhoneMissed,
  CheckCircle2, Clock, MapPin, MessageSquare, Voicemail,
  ChevronDown, Loader2, RefreshCw, BookUser, AlertCircle, ThumbsDown,
  UserCheck, RotateCcw, Sparkles, PlusCircle, Send, Bell, ChevronRight,
  Home, Layers, Hash,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { contactsApi } from '../../services/contactsApi'
import { callLogsApi } from '../../services/callLogsApi'
import { contactRequestsApi } from '../../services/contactRequestsApi'
import CreateLeadDrawer from '../../components/leads/CreateLeadDrawer'
import SidePanel from '../../components/common/SidePanel'

/* ─── Constants ──────────────────────────────────────────────────────────── */

const OUTCOMES = [
  { value: 'no_answer',          label: 'No Answer',          icon: PhoneMissed,  color: '#6B7280' },
  { value: 'voicemail',          label: 'Voicemail',          icon: Voicemail,    color: '#6B7280' },
  { value: 'callback_requested', label: 'Callback Requested', icon: Clock,        color: '#F59E0B' },
  { value: 'interested',         label: 'Interested',         icon: CheckCircle2, color: '#10B981', requiresLead: true },
  { value: 'not_interested',     label: 'Not Interested',     icon: ThumbsDown,   color: '#F97316' },
  { value: 'wrong_number',       label: 'Wrong Number',       icon: AlertCircle,  color: '#8B5CF6' },
  { value: 'remove_me',          label: 'Remove Me (DNC)',    icon: PhoneOff,     color: '#EF4444' },
]

const STATUS_META = {
  unassigned: { label: 'Unassigned', color: '#6B7280' },
  assigned:   { label: 'Assigned',   color: '#3B82F6' },
  contacted:  { label: 'Contacted',  color: '#F59E0B' },
  converted:  { label: 'Converted',  color: '#10B981' },
  dnc:        { label: 'DNC',        color: '#EF4444' },
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function timeAgo(date) {
  if (!date) return null
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

function cleanPhone(phone) {
  return phone?.replace(/\s+/g, '') ?? ''
}

/* ─── Request More Contacts Modal ───────────────────────────────────────── */

function RequestModal({ onClose, existing }) {
  const [message, setMessage] = useState('')
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: () => contactRequestsApi.create(message.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-request-pending'] })
      toast.success('Request sent to admin!')
      onClose()
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to send request')
    },
  })

  if (existing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#F59E0B]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#111111] dark:text-white">Request Pending</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Sent {timeAgo(existing.createdAt)}</p>
            </div>
          </div>
          {existing.message && (
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-3 mb-4 italic">
              "{existing.message}"
            </p>
          )}
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mb-4">
            Your request is waiting for admin review. You'll receive a notification once contacts are assigned.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#2A2A2A]"
          >
            OK, I'll wait
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <PlusCircle className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#111111] dark:text-white">Request More Contacts</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Admin will review and assign contacts to you</p>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell admin why you need more contacts or any preference (e.g. area, scheme)…"
            rows={4}
            maxLength={500}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none resize-none transition-all"
          />
          <p className="text-[10px] text-[#9CA3AF] text-right mt-1">{message.length}/500</p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Request
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Outcome Panel ─────────────────────────────────────────────────────── */

function OutcomeSheet({ contact, logId, onClose, onSaved }) {
  const [selected, setSelected] = useState(null)
  const [notes, setNotes]       = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const qc = useQueryClient()

  const selectedMeta = OUTCOMES.find((o) => o.value === selected)

  const mut = useMutation({
    mutationFn: () => callLogsApi.update(logId, { outcome: selected, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-contacts'] })
      qc.invalidateQueries({ queryKey: ['call-logs'] })
      toast.success('Call outcome saved')
      onSaved(selectedMeta)
    },
    onError: () => toast.error('Failed to save outcome'),
  })

  return (
    <SidePanel
      onClose={onClose}
      icon={PhoneCall}
      iconColor="#10B981"
      title={contact.name}
      subtitle={contact.phone}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            Skip for now
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!selected || mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {selectedMeta?.requiresLead ? 'Save & Create Lead' : 'Save Outcome'}
          </button>
        </>
      }
    >
      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">
          What was the call outcome?
        </p>
        <div className="space-y-2">
          {OUTCOMES.map((o) => {
            const Icon   = o.icon
            const active = selected === o.value
            return (
              <button
                key={o.value}
                onClick={() => setSelected(o.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-current bg-current/10'
                    : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] bg-white dark:bg-[#202020]'
                }`}
                style={active ? { color: o.color, borderColor: o.color } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: o.color }} strokeWidth={1.75} />
                <span className={`text-sm font-medium ${active ? '' : 'text-[#111111] dark:text-white'}`}>
                  {o.label}
                </span>
                {o.requiresLead && (
                  <span className={`ml-auto flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                    active ? '' : 'bg-[#10B981]/10 text-[#10B981]'
                  }`} style={active ? { backgroundColor: `${o.color}20`, color: o.color } : {}}>
                    <Sparkles className="w-2.5 h-2.5" /> Lead
                  </span>
                )}
                {active && !o.requiresLead && (
                  <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: o.color }} strokeWidth={2} />
                )}
              </button>
            )
          })}
        </div>

        {selectedMeta?.requiresLead && (
          <div className="flex items-start gap-2.5 mt-3 p-3 rounded-xl bg-[#10B981]/8 border border-[#10B981]/20">
            <Sparkles className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-[#10B981] leading-relaxed">
              You'll be taken straight to a lead form so this doesn't get lost.
            </p>
          </div>
        )}

        <button
          onClick={() => setShowNotes((v) => !v)}
          className="flex items-center gap-1.5 mt-4 text-xs text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B]"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showNotes ? 'Hide notes' : 'Add notes (optional)'}
          <ChevronDown className={`w-3 h-3 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
        </button>

        {showNotes && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything useful to note…"
            rows={3}
            className="mt-2 w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none resize-none"
          />
        )}
      </div>
    </SidePanel>
  )
}

/* ─── History Modal ─────────────────────────────────────────────────────── */

function HistoryModal({ contact, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['call-history', contact._id],
    queryFn: () => callLogsApi.listByContact(contact._id).then((r) => r.data.data.callLogs ?? []),
    staleTime: 10_000,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
            <PhoneCall className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{contact.name}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Call history · {contact.callCount ?? 0} calls</p>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" />
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <PhoneCall className="w-8 h-8 text-[#6B7280]/20" strokeWidth={1.5} />
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">No calls logged yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
              {data.map((log) => {
                const meta = OUTCOMES.find((o) => o.value === log.outcome) ?? OUTCOMES[0]
                const Icon = meta.icon
                return (
                  <li key={log._id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${meta.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                        {log.durationSeconds > 0 && (
                          <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                            {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                        {format(new Date(log.calledAt), 'd MMM yyyy · HH:mm')}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 italic">"{log.notes}"</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Contact Card ──────────────────────────────────────────────────────── */

function ContactCard({ contact, onCallInitiated }) {
  const statusMeta    = STATUS_META[contact.status] ?? STATUS_META.unassigned
  const lastCalled    = contact.lastCalledAt ? timeAgo(contact.lastCalledAt) : null
  const isCalledToday = contact.lastCalledAt
    ? new Date(contact.lastCalledAt).toDateString() === new Date().toDateString()
    : false

  const preferredPhone = contact.preferredPhone === 'alt' && contact.altPhone
    ? contact.altPhone
    : contact.phone

  return (
    <div className={`bg-white dark:bg-[#181818] rounded-2xl border transition-all ${
      isCalledToday
        ? 'border-[#10B981]/30 dark:border-[#10B981]/20 shadow-[0_0_0_1px_#10B98120]'
        : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] hover:shadow-sm'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <span className="text-sm font-bold text-[#F95C4B]">
              {contact.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{contact.name}</p>
                {contact.unitNumber && (
                  <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 mt-0.5">
                    <Home className="w-2.5 h-2.5" /> Unit {contact.unitNumber}
                  </p>
                )}
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                style={{ color: statusMeta.color, backgroundColor: `${statusMeta.color}15` }}>
                {statusMeta.label}
              </span>
            </div>

            {/* Phone */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <p className="text-sm font-mono font-semibold text-[#111111] dark:text-white">
                {preferredPhone}
              </p>
              {contact.preferredPhone === 'alt' && contact.altPhone && (
                <span className="text-[9px] font-bold text-[#F95C4B] bg-[#F95C4B]/10 px-1.5 py-0.5 rounded-md">ALT</span>
              )}
            </div>
          </div>
        </div>

        {/* Property info strip */}
        {(contact.sectionalScheme || contact.sizeInSqm) && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-[#F5F5F4] dark:bg-[#202020]">
            {contact.sectionalScheme && (
              <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA] min-w-0">
                <Layers className="w-3 h-3 flex-shrink-0 text-[#8B5CF6]" />
                <span className="truncate">{contact.sectionalScheme}</span>
              </span>
            )}
            {contact.sizeInSqm && (
              <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0 ml-auto">
                <Hash className="w-3 h-3 text-[#F95C4B]" />
                {contact.sizeInSqm}m²
              </span>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-3">
          {lastCalled ? (
            <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
              <Clock className="w-3 h-3 flex-shrink-0" />
              {isCalledToday ? <span className="text-[#10B981] font-semibold">Called today</span> : `Last called ${lastCalled}`}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-[#3B82F6] font-semibold">
              <Phone className="w-3 h-3 flex-shrink-0" /> Never called
            </span>
          )}
          {(contact.callCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
              <RotateCcw className="w-3 h-3 flex-shrink-0" />
              {contact.callCount} call{contact.callCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={`tel:${cleanPhone(preferredPhone)}`}
            onClick={(e) => { e.preventDefault(); onCallInitiated(contact) }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] active:scale-[0.98] transition-all shadow-sm"
          >
            <Phone className="w-4 h-4" strokeWidth={2} />
            Call Now
          </a>
          <button
            onClick={() => onCallInitiated(contact, 'history')}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#3B82F6] transition-colors"
            title="View call history"
          >
            <PhoneCall className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Alt phone (if preferred is primary) */}
        {contact.altPhone && contact.preferredPhone !== 'alt' && (
          <a
            href={`tel:${cleanPhone(contact.altPhone)}`}
            onClick={(e) => { e.preventDefault(); onCallInitiated({ ...contact, phone: contact.altPhone }, 'alt') }}
            className="flex items-center justify-center gap-2 w-full mt-2 py-2 rounded-xl text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#10B981]/40 hover:text-[#10B981] transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            Alt: {contact.altPhone}
          </a>
        )}
      </div>
    </div>
  )
}

/* ─── Empty States ──────────────────────────────────────────────────────── */

function EmptyQueue({ onRequest }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
        <UserCheck className="w-8 h-8 text-[#10B981]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">Queue Clear</h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs mb-5">
        No contacts assigned yet. Request more contacts from admin to start calling.
      </p>
      <button
        onClick={onRequest}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors shadow-sm"
      >
        <PlusCircle className="w-4 h-4" />
        Request Contacts
      </button>
    </div>
  )
}

function EmptySearch() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#6B7280]/10 flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-[#6B7280]/40" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">No results</h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Try a different name or phone number.</p>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default function MyContactsPage() {
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]                 = useState(1)
  const [outcomeState, setOutcomeState] = useState(null)
  const [leadPrompt, setLeadPrompt]     = useState(null)
  const [historyContact, setHistoryContact] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['my-contacts', { search, status: statusFilter, page }],
    queryFn: () =>
      contactsApi
        .list({ search: search || undefined, status: statusFilter || undefined, page, limit: 20 })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const { data: pendingRequest } = useQuery({
    queryKey: ['contact-request-pending'],
    queryFn: contactRequestsApi.myPending,
    staleTime: 60_000,
  })

  const contacts   = data?.contacts ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const initiateCallMut = useMutation({
    mutationFn: ({ contactId }) =>
      callLogsApi.create({ contactId, outcome: 'no_answer', calledAt: new Date().toISOString() }),
    onSuccess: (res, vars) => {
      const logId   = res.data?.data?.callLog?._id
      const contact = contacts.find((c) => c._id === vars.contactId)
      qc.invalidateQueries({ queryKey: ['my-contacts'] })
      setOutcomeState({ contact, logId })
    },
    onError: () => toast.error('Could not log call — check your connection'),
  })

  const handleCallInitiated = useCallback((contact, mode) => {
    if (mode === 'history') { setHistoryContact(contact); return }
    window.location.href = `tel:${cleanPhone(contact.phone)}`
    initiateCallMut.mutate({ contactId: contact._id })
  }, [contacts])

  const calledToday = contacts.filter(
    (c) => c.lastCalledAt && new Date(c.lastCalledAt).toDateString() === new Date().toDateString()
  ).length
  const neverCalled = contacts.filter((c) => !c.lastCalledAt).length

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Pending request banner ───────────────────────────────────────── */}
      {pendingRequest && (
        <div className="flex items-center gap-3 px-5 sm:px-8 py-2.5 bg-[#F59E0B]/10 border-b border-[#F59E0B]/20">
          <Clock className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />
          <p className="text-xs text-[#92400E] dark:text-[#F59E0B] flex-1">
            <span className="font-semibold">Contact request pending</span>
            {pendingRequest.message && ` · "${pendingRequest.message}"`}
            <span className="ml-1 opacity-70">· sent {timeAgo(pendingRequest.createdAt)}</span>
          </p>
          <button
            onClick={() => setShowRequestModal(true)}
            className="text-[10px] font-semibold text-[#F59E0B] hover:underline flex-shrink-0"
          >
            View
          </button>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <BookUser className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
              My Contacts
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading
                ? 'Loading…'
                : `${total} contact${total !== 1 ? 's' : ''} assigned · ${calledToday} called today · ${neverCalled} never called`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowRequestModal(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                pendingRequest
                  ? 'text-[#F59E0B] border border-[#F59E0B]/30 bg-[#F59E0B]/8 hover:bg-[#F59E0B]/15'
                  : 'text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm'
              }`}
            >
              {pendingRequest
                ? <><Clock className="w-3.5 h-3.5" /> Pending Request</>
                : <><PlusCircle className="w-3.5 h-3.5" /> Request Contacts</>
              }
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#2A2A2A] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {!isLoading && total > 0 && (
          <div className="flex items-center gap-4 mb-4">
            {[
              { label: 'Never called', count: neverCalled,       color: '#3B82F6' },
              { label: 'Called today', count: calledToday,       color: '#10B981' },
              { label: 'Remaining',    count: total - calledToday, color: '#F59E0B' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  <span className="font-bold" style={{ color }}>{count}</span> {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-0.5 overflow-x-auto pb-px">
          {[
            { key: '',           label: 'All' },
            { key: 'assigned',   label: 'Assigned' },
            { key: 'contacted',  label: 'Contacted' },
            { key: 'converted',  label: 'Converted' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1) }}
              className={[
                'px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/5'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or phone…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Contact grid ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          total === 0 && !search && !statusFilter
            ? <EmptyQueue onRequest={() => setShowRequestModal(true)} />
            : <EmptySearch />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {contacts.map((c) => (
                <ContactCard key={c._id} contact={c} onCallInitiated={handleCallInitiated} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals & panels ─────────────────────────────────────────────── */}
      {showRequestModal && (
        <RequestModal
          onClose={() => setShowRequestModal(false)}
          existing={pendingRequest}
        />
      )}

      {outcomeState && (
        <OutcomeSheet
          contact={outcomeState.contact}
          logId={outcomeState.logId}
          onClose={() => setOutcomeState(null)}
          onSaved={(outcomeMeta) => {
            if (outcomeMeta?.requiresLead) {
              setLeadPrompt({ contact: outcomeState.contact, logId: outcomeState.logId, outcome: outcomeMeta.value })
            }
            setOutcomeState(null)
          }}
        />
      )}

      {leadPrompt && (
        <CreateLeadDrawer
          contact={leadPrompt.contact}
          callLog={{ _id: leadPrompt.logId, outcome: leadPrompt.outcome }}
          defaultStatus="hot"
          onClose={() => setLeadPrompt(null)}
          onCreated={() => setLeadPrompt(null)}
        />
      )}

      {historyContact && (
        <HistoryModal contact={historyContact} onClose={() => setHistoryContact(null)} />
      )}
    </div>
  )
}
