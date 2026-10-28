import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'
import {
  ArrowLeft, Trash2, Repeat, ArrowRight, Phone, Mail, User, Building2,
  History, FileText, Loader2, ShieldCheck, AlertTriangle, MapPin, PhoneCall, Calendar, Check,
  MessageCircle, Key, ChevronUp, ChevronDown, Maximize2, X, CalendarCheck, CalendarClock, Clock, MessagesSquare,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { chatApi } from '../../services/chatApi'
import ContactCallHistory from '../contacts/ContactCallHistory'
import LeadCallButton from './LeadCallButton'
import LeadAppointments from '../appointments/LeadAppointments'
import LeadHistory from './LeadHistory'
import LeadDealCard from './LeadDealCard'
import { LeadHero, QuickActions, ActivityFeed, FirstCallCard, useLeadActivity, QUICK_REPLIES } from './LeadLive'
import { useLeadPresence, reportActivity, onLeadEvent } from '../../lib/livePresence'
import {
  LeadStatusBadge, LeadSourceBadge, ListingBadge, ListingFields, PropertyFromContact, FollowUpComments,
  Field, inputCls, LEAD_STATUS_META, getApiErrorMessage, AgentOrAgencyPicker,
  ListingUrlInput, LinkPreviewCard, DispositionPicker, DispositionBadge, LeaseCountdownChip,
} from './leadShared'
import { DateField, TimeField } from '../common/DateTimeFields'

const STATUS_OPTS = ['cold', 'warm', 'hot', 'listed', 'rented_out', 'sold', 'lost']

function resolveUser(obj) {
  return (obj && typeof obj === 'object' && obj.firstName) ? obj : null
}

function resolveAgency(obj) {
  return (obj && typeof obj === 'object' && obj.name) ? obj : null
}

// The editable form's values for a lead
function formFromLead(lead) {
  return {
    landlordName: lead.landlordName ?? '',
    listingType: lead.listingType ?? '',
    priceMin: lead.priceMin ?? '',
    priceMax: lead.priceMax ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    comments: lead.comments ?? '',
    availability: lead.availability ?? '',
    bestCallTime: lead.bestCallTime ?? '',
    followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : '',
    appointmentDate: lead.appointmentDate ? lead.appointmentDate.slice(0, 10) : '',
    appointmentTime: lead.appointmentTime ?? '',
    assignedAgent: lead.assignedAgent?._id ?? lead.assignedAgent ?? '',
    agencyId: lead.agencyId?._id ?? lead.agencyId ?? '',
    adminReviewed: lead.adminReviewed ?? false,
    adminNotes: lead.adminNotes ?? '',
    listingUrl: lead.listingUrl ?? '',
    disposition: lead.disposition ?? '',
    leaseStartDate: lead.leaseStartDate ? lead.leaseStartDate.slice(0, 10) : '',
    leaseDurationMonths: lead.leaseDurationMonths ?? '',
  }
}

function cleanPhone(phone) {
  return phone?.replace(/\s+/g, '') ?? ''
}

/* ─── Status Change Dialog — shared, brand accent ────────────────────────── */

// Esc closes the dialog on top (the side panel underneath ignores Esc while one is open)
function useEscapeToClose(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

function StatusChangeDialog({ lead, invalidateQueryKey, onClose, onUpdated, options }) {
  useEscapeToClose(onClose)
  const qc = useQueryClient()
  const opts = options ?? STATUS_OPTS.map((s) => ({ value: s, label: LEAD_STATUS_META[s].label }))
  const [status, setStatus] = useState(opts.some((o) => o.value === lead.status) ? lead.status : opts[0].value)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [listingUrl, setListingUrl] = useState(lead.listingUrl ?? '')
  const [disposition, setDisposition] = useState(lead.disposition ?? '')
  const [leaseStartDate, setLeaseStartDate] = useState(
    lead.leaseStartDate ? lead.leaseStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [leaseDurationMonths, setLeaseDurationMonths] = useState(lead.leaseDurationMonths ?? '')

  const mut = useMutation({
    mutationFn: () => {
      const payload = { status, reason: reason.trim() }
      if (status === 'listed') payload.listingUrl = listingUrl.trim() || null
      if (status === 'rented_out') {
        payload.disposition = disposition || null
        payload.leaseStartDate = leaseStartDate || null
        payload.leaseDurationMonths = leaseDurationMonths ? Number(leaseDurationMonths) : null
      }
      return leadsApi.updateStatus(lead._id, payload)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success('Lead status updated')
      onUpdated(res.data?.data?.lead)
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update status')),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (reason.trim().length < 3) { setError('Add a reason — at least 3 characters'); return }
    setError('')
    mut.mutate()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div data-lead-dialog className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-[#111111] dark:text-white">Change Status</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[220px]">{lead.landlordName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 my-5 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
            <LeadStatusBadge status={lead.status} />
            <ArrowRight className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
            <LeadStatusBadge status={status} />
          </div>

          <div className="space-y-4">
            <Field label="New Status" required>
              {options ? (
                <div className="space-y-2">
                  {opts.map((o) => {
                    const Icon = o.icon
                    const active = status === o.value
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setStatus(o.value)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          active ? '' : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] bg-white dark:bg-[#202020]'
                        }`}
                        style={active ? { backgroundColor: `${o.color}10`, borderColor: o.color } : {}}
                      >
                        {Icon && (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${o.color}18` }}>
                            <Icon className="w-4 h-4" style={{ color: o.color }} strokeWidth={1.75} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#111111] dark:text-white">{o.label}</p>
                          {o.hint && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{o.hint}</p>}
                        </div>
                        {active && <Check className="w-4 h-4 mt-1.5 flex-shrink-0" style={{ color: o.color }} strokeWidth={2.5} />}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls(false)}>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Reason" required error={error} hint="Shown to the cold caller and saved to this lead's history">
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => { setReason(e.target.value); if (error) setError('') }}
                placeholder="e.g. Landlord confirmed the unit was rented out this week"
                rows={3}
                className={`${inputCls(Boolean(error))} resize-none`}
              />
            </Field>

            {status === 'listed' && (
              <Field label="Property Listing Link" hint="Optional — paste the live listing URL (Property24, Private Property, etc.) for a rich preview">
                <ListingUrlInput
                  value={listingUrl}
                  onChange={setListingUrl}
                  initialPreview={lead.listingUrl ? lead.listingPreview : null}
                  initialUrl={lead.listingUrl}
                />
              </Field>
            )}

            {status === 'rented_out' && (
              <>
                <Field label="Who Closed This Deal?" hint="Optional — helps track commission eligibility">
                  <DispositionPicker value={disposition} onChange={setDisposition} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date Rented Out">
                    <DateField value={leaseStartDate} onChange={setLeaseStartDate} allowPast className={inputCls(false)} />
                  </Field>
                  <Field label="Lease Length (months)" hint="Any whole number">
                    <input
                      type="number" min="1" max="120" placeholder="e.g. 12"
                      value={leaseDurationMonths}
                      onChange={(e) => setLeaseDurationMonths(e.target.value)}
                      className={inputCls(false)}
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Status
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ─── Delete Confirm Dialog ───────────────────────────────────────────────── */

function DeleteDialog({ lead, invalidateQueryKey, onClose, onDeleted }) {
  useEscapeToClose(onClose)
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: () => leadsApi.remove(lead._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success('Lead deleted')
      onDeleted()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Delete failed')),
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div data-lead-dialog className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">Delete Lead</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
            Are you sure you want to delete the lead for{' '}
            <span className="font-semibold text-[#111111] dark:text-white">{lead.landlordName}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Small display helpers ──────────────────────────────────────────────── */

function InfoCard({ icon: Icon, title, action, children }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111]">
        <Icon className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex-1">{title}</p>
        {action}
      </div>
      <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">{children}</div>
    </div>
  )
}

/**
 * Opens (or creates) a conversation with `targetUser` and jumps to the current role's
 * Messages inbox with that conversation preselected and this lead pre-attached to the
 * composer — so the next message sent carries a clickable "lead card" both sides can
 * click back into. Hidden by the caller when targetUser is the viewer themselves.
 */
function ChatWithButton({ targetUser, targetLabel, lead, chatBasePath }) {
  const navigate = useNavigate()
  const mut = useMutation({
    mutationFn: () => chatApi.openConversation(targetUser._id),
    onSuccess: (data) => {
      navigate(`${chatBasePath}/chat`, {
        state: {
          conversationId: data.conversation._id,
          attachLead: { _id: lead._id, landlordName: lead.landlordName, propertyAddress: lead.propertyAddress, status: lead.status },
        },
      })
    },
    onError: () => toast.error('Could not open conversation'),
  })

  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      title={`Chat with ${targetLabel}`}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/20 disabled:opacity-50 transition-colors flex-shrink-0"
    >
      {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
      Chat
    </button>
  )
}

const ROLE_LABEL = { admin: 'Admin', follow_up_manager: 'Follow-up manager', cold_caller: 'Cold caller', agency: 'Company' }

// Who is working the lead, and how to reach them — so admin and follow-up managers can see
// exactly which agent a company put on one of our leads.
function AssignedAgentDetails({ agent, agency, assignedBy, assignedAt }) {
  const initials = `${agent.firstName?.[0] ?? ''}${agent.lastName?.[0] ?? ''}`.toUpperCase()
  const byLabel = assignedBy
    ? `${assignedBy.firstName} ${assignedBy.lastName}${assignedBy.role === 'agency' ? (agency ? ` · ${agency.name} manager` : ' · company manager') : ` · ${ROLE_LABEL[assignedBy.role] ?? ''}`}`
    : null
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[#F95C4B] to-[#E11D48] flex-shrink-0">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{agent.firstName} {agent.lastName}</p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate flex items-center gap-1">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            {agency ? agency.name : 'Reliable Touch'} · {agent.isAgencyManager ? 'Company manager' : 'Agent'}
          </p>
        </div>
      </div>
      <InfoRow icon={Phone} label="Agent phone" value={agent.phone} href={agent.phone ? `tel:${cleanPhone(agent.phone)}` : undefined} />
      <InfoRow icon={Mail} label="Agent email" value={agent.email} href={agent.email ? `mailto:${agent.email}` : undefined} />
      {byLabel && assignedAt && (
        <InfoRow icon={Calendar} label="Assigned by" value={`${byLabel} · ${format(new Date(assignedAt), 'd MMM yyyy, HH:mm')}`} />
      )}
    </>
  )
}

function InfoRow({ icon: Icon, label, value, href }) {
  if (!value) return null
  const inner = (
    <>
      <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0 group-hover:text-[#F95C4B] transition-colors" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        <p className="text-sm text-[#111111] dark:text-white break-words group-hover:text-[#F95C4B] transition-colors">{value}</p>
      </div>
      {href?.startsWith('tel:') && (
        <PhoneCall className="w-3.5 h-3.5 text-[#6B7280]/40 dark:text-[#A1A1AA]/40 group-hover:text-[#F95C4B] transition-colors mt-1 flex-shrink-0" strokeWidth={1.75} />
      )}
    </>
  )
  if (href) {
    return (
      <a href={href} className="flex items-start gap-3 px-4 py-3 group hover:bg-[#F95C4B]/5 transition-colors">
        {inner}
      </a>
    )
  }
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {inner}
    </div>
  )
}

/* ─── Main screen ─────────────────────────────────────────────────────────── */

/**
 * Full-page lead detail screen shared by every role (admin, cold caller, follow-up
 * manager, agency) — each role's thin wrapper page fetches the lead and passes its own
 * capability flags in; this component owns the layout, editing, status/delete dialogs,
 * and the page itself: the journey hero (LeadLive), one-tap actions, the Follow-up chat
 * beside the live activity column, and "More about this lead" (details form, appointments,
 * deal, call logs, history) one section at a time. Panel and full page share the layout.
 */
export default function LeadDetailScreen({
  lead: initialLead,
  onBack,
  onDeleted,
  invalidateQueryKey,
  editableFields,
  showAdminFields = false,
  canAssignAgency = false,
  canChangeStatus = false,
  statusOptions = null,
  assignableTeam = null,
  canDelete = false,
  canComment = false,
  // "Call" button: dial the landlord and log the call on this lead. `callNotifiesManager`
  // — the caller is a company agent, whose manager is told about the call.
  canCall = false,
  callNotifiesManager = false,
  currentUserId,
  currentUserRole,
  showSourceBadge = false,
  // 'panel' = shown in the Leads list's side panel: compact header (prev/next, open full
  // page, close), more tabs, single column. `panel` = { onClose, onExpand, onPrev, onNext,
  // hasPrev, hasNext, position: { index, total } }.
  variant = 'page',
  panel = null,
}) {
  const qc = useQueryClient()
  const [lead, setLead] = useState(initialLead)
  const [tab, setTab] = useState('details')
  const [statusDialog, setStatusDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)

  const chatBasePath = currentUserRole ? `/${currentUserRole.replace(/_/g, '-')}` : null

  const contact = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const area = (lead.area && typeof lead.area === 'object') ? lead.area : null
  const creator = resolveUser(lead.createdBy)
  const assignedAgentUser = resolveUser(lead.assignedAgent)
  const assignedAgency = resolveAgency(lead.agencyId)
  const assignedAgentByUser = resolveUser(lead.assignedAgentBy)
  const canEdit = editableFields.size > 0 || canAssignAgency

  const [form, setForm] = useState(() => formFromLead(initialLead))
  // Fields this person has changed but not saved yet — a fresh copy of the lead from the
  // server (someone else in the company edited it) never overwrites those.
  const dirtyRef = useRef(new Set())

  // The page refetches the lead when it changes elsewhere (see SocketContext's
  // lead_activity) — show the newer copy in place.
  useEffect(() => {
    if (!initialLead?.updatedAt || !lead?.updatedAt) return
    if (new Date(initialLead.updatedAt) <= new Date(lead.updatedAt)) return
    setLead(initialLead)
    const fresh = formFromLead(initialLead)
    setForm((f) => {
      const next = { ...f }
      Object.keys(fresh).forEach((k) => { if (!dirtyRef.current.has(k)) next[k] = fresh[k] })
      return next
    })
  }, [initialLead]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live: admins see "viewing / editing <lead>" on their floor; changes by anyone else
  // refresh this screen and say who made them
  useLeadPresence(lead)
  const [liveNote, setLiveNote] = useState(null)
  useEffect(() => onLeadEvent((event, p) => {
    if (event !== 'lead:changed' || p?.leadId !== lead._id || p.byId === currentUserId) return
    qc.invalidateQueries({ queryKey: ['lead', lead._id] })
    if (invalidateQueryKey) qc.invalidateQueries({ queryKey: invalidateQueryKey })
    setLiveNote(`${p.byName ?? 'Someone'} just ${p.type === 'comment' ? 'commented' : p.type === 'call' ? 'logged a call' : 'updated this lead'}`)
  }), [lead._id, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!liveNote) return undefined
    const t = setTimeout(() => setLiveNote(null), 6000)
    return () => clearTimeout(t)
  }, [liveNote])

  function setField(k, v) {
    if (dirtyRef.current.size === 0) reportActivity('editing', { leadId: lead._id, leadName: lead.landlordName })
    dirtyRef.current.add(k)
    setForm((f) => ({ ...f, [k]: v }))
  }
  function has(field) { return editableFields.has(field) }

  const saveMut = useMutation({
    mutationFn: (payload) => leadsApi.update(lead._id, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success('Lead updated')
      dirtyRef.current.clear()
      reportActivity('viewing', { leadId: lead._id, leadName: lead.landlordName })
      setLead(res.data.data.lead)
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update lead')),
  })

  // Standalone quick-save for just the follow-up date — saving the whole form (below)
  // works too, but setting the next follow-up is common enough on its own (and the
  // trigger for the due-date reminder job) to deserve a one-click path that doesn't
  // require touching or re-submitting every other field.
  const quickFollowUpMut = useMutation({
    mutationFn: (value) => leadsApi.update(lead._id, { followUpDate: value || null }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success('Follow-up date set')
      setLead(res.data.data.lead)
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to set follow-up date')),
  })
  const followUpDateDirty = form.followUpDate !== (lead.followUpDate ? lead.followUpDate.slice(0, 10) : '')

  function handleSave(e) {
    e.preventDefault()
    const payload = {}
    for (const key of editableFields) {
      const v = form[key]
      payload[key] = v === '' ? null : v
    }
    if (canAssignAgency) {
      payload.assignedAgent = form.assignedAgent || null
      payload.agencyId = form.agencyId || null
    }
    if (showAdminFields) {
      payload.adminReviewed = form.adminReviewed
      payload.adminNotes = form.adminNotes.trim() || null
    }
    saveMut.mutate(payload)
  }

  const isPanel = variant === 'panel'
  const historyCount = lead.statusHistory?.length ?? 0

  // The live side: journey, who has it open, every open and change, read receipts
  const { data: live, isLoading: liveLoading } = useLeadActivity(lead._id)
  const [more, setMore] = useState(null) // the one "More about this lead" section that's open
  const moreRef = useRef(null)
  const openMore = (k) => { setMore(k); setTimeout(() => moreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }
  // A quick action saved the lead — take it, and keep the edit form in step so a later
  // "Save changes" doesn't put the old follow-up date / agent back
  const takeLead = (l) => {
    setLead(l)
    const fresh = formFromLead(l)
    setForm((f) => ({ ...f, followUpDate: fresh.followUpDate, assignedAgent: fresh.assignedAgent, agencyId: fresh.agencyId }))
  }

  const appointmentsEl = (
    <LeadAppointments
      lead={lead}
      canBook={canEdit}
      agencyMode={currentUserRole === 'agency'
        ? { isManager: canAssignAgency, teamMembers: assignableTeam, currentUserId }
        : undefined}
    />
  )

  const events = (live?.timeline ?? [])
    .filter((t) => ['assigned', 'status'].includes(t.type))
    .map((t) => ({ id: t.id, at: t.at, text: `${t.who.me ? 'You' : t.who.name === 'System' ? 'The system' : t.who.name.split(' ')[0]} ${t.text}` }))
  const commentsEl = (
    <FollowUpComments
      lead={lead}
      currentUserId={currentUserId}
      canComment={canComment}
      onAdded={setLead}
      seen={live?.seen ?? []}
      events={events}
      quickReplies={canComment ? QUICK_REPLIES[currentUserRole] ?? [] : []}
      placeholder={currentUserRole === 'cold_caller' ? 'Add something you heard on the call…' : 'Write to everyone on this lead…'}
    />
  )

  const fum = resolveUser(lead.followUpManager) ?? resolveUser(lead.lastFollowUpBy)
  const peopleEl = (
    <InfoCard icon={User} title="Contact & team">
      <InfoRow icon={Phone} label="Landlord phone" value={contact?.phone ?? lead.phone} href={(contact?.phone ?? lead.phone) ? `tel:${cleanPhone(contact?.phone ?? lead.phone)}` : undefined} />
      {contact?.altPhone && <InfoRow icon={Phone} label="Alt phone" value={contact.altPhone} href={`tel:${cleanPhone(contact.altPhone)}`} />}
      <InfoRow icon={Mail} label="Email" value={contact?.email ?? lead.email} href={(contact?.email ?? lead.email) ? `mailto:${contact?.email ?? lead.email}` : undefined} />
      {area && <InfoRow icon={MapPin} label="Area" value={`${area.name}${area.region ? `, ${area.region}` : ''}`} />}
      {creator && (
        <div className="flex items-center gap-3 px-4 py-3">
          <User className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{lead.source === 'agency_self_sourced' ? 'Created by' : 'Cold caller'}</p>
            <p className="text-sm text-[#111111] dark:text-white truncate">{creator._id === currentUserId ? 'You' : `${creator.firstName} ${creator.lastName}`}</p>
          </div>
          {chatBasePath && creator._id !== currentUserId && <ChatWithButton targetUser={creator} targetLabel="cold caller" lead={lead} chatBasePath={chatBasePath} />}
        </div>
      )}
      {fum && <InfoRow icon={MessagesSquare} label="Follow-up" value={fum._id === currentUserId ? 'You' : `${fum.firstName} ${fum.lastName}`} />}
      {assignedAgentUser ? (
        <>
          <AssignedAgentDetails agent={assignedAgentUser} agency={assignedAgency} assignedBy={assignedAgentByUser} assignedAt={lead.assignedAgentAt} />
          {chatBasePath && assignedAgentUser._id !== currentUserId && (
            <div className="px-4 py-2.5 flex justify-end"><ChatWithButton targetUser={assignedAgentUser} targetLabel="agent" lead={lead} chatBasePath={chatBasePath} /></div>
          )}
        </>
      ) : assignedAgency ? (
        <>
          <InfoRow icon={Building2} label="Company" value={assignedAgency.name} />
          {assignedAgency.contactPhone && <InfoRow icon={Phone} label="Company phone" value={assignedAgency.contactPhone} href={`tel:${cleanPhone(assignedAgency.contactPhone)}`} />}
        </>
      ) : (
        <p className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#A1A1AA] italic">No agent yet</p>
      )}
    </InfoCard>
  )

  const showDeal = ['admin', 'agency'].includes(currentUserRole)
    && (lead.assignedAgent || lead.agencyId || ['still_negotiating', 'listed', 'rented_out', 'sold'].includes(lead.status) || lead.deal?.updatedAt)
  const MORE = [
    { key: 'details', label: 'Lead details', sub: canEdit ? 'Landlord, listing, dates — edit and save' : 'Landlord, listing and dates', icon: FileText },
    { key: 'appointments', label: 'Appointments', sub: lead.appointmentDate ? `Next: ${format(new Date(lead.appointmentDate), 'd MMM')}${lead.appointmentTime ? `, ${lead.appointmentTime}` : ''}` : 'None booked yet', icon: CalendarCheck },
    showDeal && { key: 'deal', label: 'Deal', sub: 'Tenant, rent, fees and payments', icon: Key },
    { key: 'calls', label: 'Call logs', sub: 'Every call to the landlord', icon: PhoneCall },
    { key: 'history', label: 'History & audit', sub: `${historyCount} status change${historyCount === 1 ? '' : 's'} and every edit`, icon: History },
  ].filter(Boolean)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        {isPanel ? (
          <div className="flex items-center gap-1">
            {[{ dir: 'prev', icon: ChevronUp, on: panel?.onPrev, ok: panel?.hasPrev, title: 'Previous lead (↑)' },
              { dir: 'next', icon: ChevronDown, on: panel?.onNext, ok: panel?.hasNext, title: 'Next lead (↓)' }].map((b) => (
              <button key={b.dir} type="button" onClick={b.on} disabled={!b.ok} title={b.title}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#2A2A2A] hover:text-[#F95C4B] hover:border-[#F95C4B]/40 disabled:opacity-35 disabled:pointer-events-none active:scale-95 transition-all">
                <b.icon className="w-4 h-4" />
              </button>
            ))}
            {panel?.position && <span className="ml-1.5 text-[11px] text-[#9CA3AF] tabular-nums">{panel.position.index} of {panel.position.total.toLocaleString()}</span>}
          </div>
        ) : (
          <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to leads
          </button>
        )}
        <div className="flex items-center gap-1">
          {panel?.onExpand && (
            <button type="button" onClick={panel.onExpand} title="Open full page"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {isPanel && (
            <button type="button" onClick={panel?.onClose ?? onBack} title="Close (Esc)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {liveNote && (
        <div className="relative z-20 flex justify-center -mb-9 pointer-events-none">
          <span className="selection-bar-in mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-solid text-xs font-semibold text-[#111111] dark:text-white shadow-lg">
            <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-[#10B981]" /></span>
            {liveNote}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto thin-scroll bg-[#FAFAF9] dark:bg-[#0B0B0B]">
        <div className={`space-y-4 ${isPanel ? 'px-4 sm:px-5 py-4' : 'max-w-7xl mx-auto px-4 sm:px-6 xl:px-8 py-6'}`}>
          <LeadHero lead={lead} data={live} showSourceBadge={showSourceBadge} />

          <QuickActions
            lead={lead}
            onLead={takeLead}
            invalidateQueryKey={invalidateQueryKey}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            canCall={canCall}
            callNotifiesManager={callNotifiesManager}
            canChangeStatus={canChangeStatus}
            onStatus={() => setStatusDialog(true)}
            canSetFollowUp={has('followUpDate')}
            canBook={canEdit}
            canAssign={canAssignAgency}
            assignableTeam={assignableTeam}
            canEdit={editableFields.size > 0}
            onEdit={() => openMore('details')}
            canDelete={canDelete}
            onDelete={() => setDeleteDialog(true)}
          />

          <div className={isPanel ? 'space-y-4' : 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start'}>
            <div className="min-w-0 space-y-4">{commentsEl}</div>
            <div className="space-y-4 min-w-0">
              <ActivityFeed data={live} isLoading={liveLoading} />
              <FirstCallCard data={live} />
              {peopleEl}
            </div>
          </div>

          {/* More about this lead — one section open at a time */}
          <div ref={moreRef} className="scroll-mt-4 rounded-3xl border border-[#E5E7EB] dark:border-[#262626] bg-white dark:bg-[#151515] overflow-hidden divide-y divide-[#F1EFEC] dark:divide-[#232323]">
            {MORE.map((m) => {
              const isOpen = more === m.key
              return (
                <div key={m.key}>
                  <button type="button" onClick={() => setMore(isOpen ? null : m.key)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#FAFAF9] dark:hover:bg-[#1A1A1A] transition-colors">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-[#F95C4B] text-white' : 'bg-[#F95C4B]/10 text-[#F95C4B]'}`}><m.icon className="w-4 h-4" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-[#111111] dark:text-white">{m.label}</span>
                      <span className="block text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{m.sub}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="files-collapse px-5 pb-5 pt-1">
                      {m.key === 'details' && (
                        <div className="space-y-5">
                          {contact && <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-4"><PropertyFromContact contact={contact} /></div>}
              <form id="lead-detail-form" onSubmit={handleSave} className="space-y-5">
                <InfoCard icon={FileText} title="Lead Details">
                  <div className="p-4 space-y-4">
                    <Field label="Landlord Name">
                      {has('landlordName') ? (
                        <input value={form.landlordName} onChange={(e) => setField('landlordName', e.target.value)} className={inputCls(false)} />
                      ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.landlordName || '—'}</p>}
                    </Field>

                    {(has('listingType') || lead.listingType) && (
                      has('listingType') ? (
                        <ListingFields form={form} setField={setField} errors={{}} />
                      ) : (
                        <div className="flex items-center gap-3">
                          <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
                        </div>
                      )
                    )}

                    {(has('listingUrl') || lead.listingUrl) && (
                      <Field
                        label="Property Listing Link"
                        hint={has('listingUrl') ? 'Optional — paste the live listing URL (Property24, Private Property, etc.) for a rich preview' : undefined}
                      >
                        {has('listingUrl') ? (
                          <ListingUrlInput
                            value={form.listingUrl}
                            onChange={(v) => setField('listingUrl', v)}
                            initialPreview={lead.listingUrl === form.listingUrl ? lead.listingPreview : null}
                            initialUrl={lead.listingUrl}
                          />
                        ) : lead.listingPreview?.title || lead.listingPreview?.image || lead.listingPreview?.description ? (
                          <LinkPreviewCard preview={lead.listingPreview} url={lead.listingUrl} compact />
                        ) : (
                          <a href={lead.listingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#F95C4B] hover:underline break-all">
                            {lead.listingUrl}
                          </a>
                        )}
                      </Field>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Phone">
                        {has('phone') ? (
                          <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputCls(false)} />
                        ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.phone || '—'}</p>}
                      </Field>
                      <Field label="Email">
                        {has('email') ? (
                          <input value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls(false)} />
                        ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.email || '—'}</p>}
                      </Field>
                    </div>

                    <Field label="Comments" hint="Anything useful for whoever picks this up">
                      {has('comments') ? (
                        <textarea value={form.comments} onChange={(e) => setField('comments', e.target.value)} rows={3} className={`${inputCls(false)} resize-none`} />
                      ) : <p className="text-sm text-[#111111] dark:text-white py-1 whitespace-pre-wrap">{lead.comments || '—'}</p>}
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Availability">
                        {has('availability') ? (
                          <input value={form.availability} onChange={(e) => setField('availability', e.target.value)} className={inputCls(false)} />
                        ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.availability || '—'}</p>}
                      </Field>
                      <Field label="Best Call Time">
                        {has('bestCallTime') ? (
                          <input value={form.bestCallTime} onChange={(e) => setField('bestCallTime', e.target.value)} className={inputCls(false)} />
                        ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.bestCallTime || '—'}</p>}
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Follow-up Date">
                        {has('followUpDate') ? (
                          <div className="flex items-center gap-2">
                            <DateField value={form.followUpDate} onChange={(v) => setField('followUpDate', v)} className={inputCls(false)} />
                            <button
                              type="button"
                              onClick={() => quickFollowUpMut.mutate(form.followUpDate)}
                              disabled={quickFollowUpMut.isPending || !followUpDateDirty}
                              title="Save just this date, without submitting the rest of the form"
                              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[#F95C4B]/10 text-[#F95C4B] hover:bg-[#F95C4B]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {quickFollowUpMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
                            </button>
                          </div>
                        ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.followUpDate ? format(new Date(lead.followUpDate), 'd MMM yyyy') : '—'}</p>}
                      </Field>
                      <Field label="Appointment Date">
                        {has('appointmentDate') ? (
                          <DateField value={form.appointmentDate} onChange={(v) => setField('appointmentDate', v)} className={inputCls(false)} />
                        ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.appointmentDate ? format(new Date(lead.appointmentDate), 'd MMM yyyy') : '—'}</p>}
                      </Field>
                    </div>

                    <Field label="Appointment Time">
                      {has('appointmentTime') ? (
                        <TimeField value={form.appointmentTime} onChange={(v) => setField('appointmentTime', v)} className={inputCls(false)} />
                      ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.appointmentTime || '—'}</p>}
                    </Field>
                  </div>
                </InfoCard>

                {(has('disposition') || has('leaseStartDate') || has('leaseDurationMonths') || lead.disposition || lead.leaseEndDate) && (
                  <InfoCard icon={Key} title="Deal Details">
                    <div className="p-4 space-y-4">
                      {has('disposition') ? (
                        <Field label="Who Closed This Deal?" hint="Only applies once the property is Rented Out">
                          <DispositionPicker value={form.disposition} onChange={(v) => setField('disposition', v)} />
                        </Field>
                      ) : lead.disposition ? (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">Who Closed This Deal?</p>
                          <DispositionBadge disposition={lead.disposition} />
                        </div>
                      ) : null}

                      {(has('leaseStartDate') || has('leaseDurationMonths') || lead.leaseDurationMonths) && (
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Date Rented Out">
                            {has('leaseStartDate') ? (
                              <DateField value={form.leaseStartDate} onChange={(v) => setField('leaseStartDate', v)} allowPast className={inputCls(false)} />
                            ) : (
                              <p className="text-sm text-[#111111] dark:text-white py-1">
                                {lead.leaseStartDate ? format(new Date(lead.leaseStartDate), 'd MMM yyyy') : '—'}
                              </p>
                            )}
                          </Field>
                          <Field label="Lease Length (months)">
                            {has('leaseDurationMonths') ? (
                              <input
                                type="number" min="1" max="120" placeholder="e.g. 12"
                                value={form.leaseDurationMonths}
                                onChange={(e) => setField('leaseDurationMonths', e.target.value)}
                                className={inputCls(false)}
                              />
                            ) : <p className="text-sm text-[#111111] dark:text-white py-1">{lead.leaseDurationMonths ?? '—'}</p>}
                          </Field>
                        </div>
                      )}

                      {lead.leaseEndDate && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Lease Ends</p>
                            <p className="text-sm font-bold text-[#111111] dark:text-white">{format(new Date(lead.leaseEndDate), 'd MMM yyyy')}</p>
                          </div>
                          <LeaseCountdownChip leaseEndDate={lead.leaseEndDate} />
                        </div>
                      )}
                    </div>
                  </InfoCard>
                )}

                {showAdminFields && (
                  <InfoCard icon={ShieldCheck} title="Admin">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox" id="adminReviewed"
                          checked={form.adminReviewed}
                          onChange={(e) => setField('adminReviewed', e.target.checked)}
                          className="w-4 h-4 accent-[#F95C4B] cursor-pointer"
                        />
                        <label htmlFor="adminReviewed" className="text-sm text-[#111111] dark:text-white cursor-pointer">Mark as admin reviewed</label>
                      </div>
                      <Field label="Admin Notes">
                        <textarea value={form.adminNotes} onChange={(e) => setField('adminNotes', e.target.value)} placeholder="Internal notes…" rows={3} className={`${inputCls(false)} resize-none`} />
                      </Field>
                    </div>
                  </InfoCard>
                )}

                {canEdit && (
                  <button
                    type="submit"
                    disabled={saveMut.isPending}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                  >
                    {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                  </button>
                )}
              </form>
                          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                            Created {format(new Date(lead.createdAt), 'd MMM yyyy, HH:mm')}
                            {creator && ` by ${creator.firstName} ${creator.lastName}`}
                            {' · '}Updated {format(new Date(lead.updatedAt), 'd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      )}
                      {m.key === 'appointments' && appointmentsEl}
                      {m.key === 'deal' && <LeadDealCard lead={lead} isAdmin={currentUserRole === 'admin'} onSaved={setLead} />}
                      {m.key === 'calls' && (contact ? <ContactCallHistory contactId={contact._id} /> : <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-6">No contact linked to this lead.</p>)}
                      {m.key === 'history' && <LeadHistory leadId={lead._id} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {statusDialog && (
        <StatusChangeDialog
          lead={lead}
          invalidateQueryKey={invalidateQueryKey}
          options={statusOptions}
          onClose={() => setStatusDialog(false)}
          onUpdated={(updated) => { setStatusDialog(false); if (updated) setLead(updated); qc.invalidateQueries({ queryKey: invalidateQueryKey }); qc.invalidateQueries({ queryKey: ['lead-activity', lead._id] }) }}
        />
      )}
      {deleteDialog && (
        <DeleteDialog
          lead={lead}
          invalidateQueryKey={invalidateQueryKey}
          onClose={() => setDeleteDialog(false)}
          onDeleted={() => onDeleted?.()}
        />
      )}
    </div>
  )
}
