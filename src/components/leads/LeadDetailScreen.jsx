import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowLeft, Trash2, Repeat, ArrowRight, Phone, Mail, User, Building2,
  History, FileText, Loader2, ShieldCheck, AlertTriangle, MapPin, PhoneCall,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { appointmentsApi } from '../../services/appointmentsApi'
import ContactCallHistory from '../contacts/ContactCallHistory'
import LeadAppointments from '../appointments/LeadAppointments'
import {
  LeadStatusBadge, ListingBadge, ListingFields, PropertyFromContact, FollowUpComments,
  Field, inputCls, LEAD_STATUS_META, getApiErrorMessage,
} from './leadShared'
import { DateField, TimeField } from '../common/DateTimeFields'

const STATUS_OPTS = ['cold', 'warm', 'hot', 'listed', 'rented_out', 'sold', 'lost']

function resolveUser(obj) {
  return (obj && typeof obj === 'object' && obj.firstName) ? obj : null
}

/* ─── Status Change Dialog — shared, brand accent ────────────────────────── */

function StatusChangeDialog({ lead, invalidateQueryKey, onClose, onUpdated }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(lead.status)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => leadsApi.updateStatus(lead._id, { status, reason: reason.trim() }),
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
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
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls(false)}>
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
                ))}
              </select>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111]">
        <Icon className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{title}</p>
      </div>
      <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        <p className="text-sm text-[#111111] dark:text-white break-words">{value}</p>
      </div>
    </div>
  )
}

/* ─── Main screen ─────────────────────────────────────────────────────────── */

/**
 * Full-page lead detail screen shared by every role (admin, cold caller, follow-up
 * manager, agency) — each role's thin wrapper page fetches the lead and passes its own
 * capability flags in; this component owns the layout, editing, status/delete dialogs,
 * the two tabs, and the chat-style comment thread.
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
  canDelete = false,
  canComment = false,
  currentUserId,
}) {
  const qc = useQueryClient()
  const [lead, setLead] = useState(initialLead)
  const [tab, setTab] = useState('details')
  const [statusDialog, setStatusDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)

  const contact = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const area = (lead.area && typeof lead.area === 'object') ? lead.area : null
  const creator = resolveUser(lead.createdBy)
  const assignedAgentUser = resolveUser(lead.assignedAgent)
  const canEdit = editableFields.size > 0 || canAssignAgency

  const [form, setForm] = useState(() => ({
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
    adminReviewed: lead.adminReviewed ?? false,
    adminNotes: lead.adminNotes ?? '',
  }))

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })) }
  function has(field) { return editableFields.has(field) }

  const { data: assigneesData } = useQuery({
    queryKey: ['appointment-assignees'],
    queryFn: () => appointmentsApi.assignees().then((r) => r.data.data?.users ?? []),
    enabled: canAssignAgency,
    staleTime: 60_000,
  })
  const agencies = (assigneesData ?? []).filter((a) => a.role === 'agency')

  const saveMut = useMutation({
    mutationFn: (payload) => leadsApi.update(lead._id, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success('Lead updated')
      setLead(res.data.data.lead)
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update lead')),
  })

  function handleSave(e) {
    e.preventDefault()
    const payload = {}
    for (const key of editableFields) {
      const v = form[key]
      payload[key] = v === '' ? null : v
    }
    if (canAssignAgency) payload.assignedAgent = form.assignedAgent || null
    if (showAdminFields) {
      payload.adminReviewed = form.adminReviewed
      payload.adminNotes = form.adminNotes.trim() || null
    }
    saveMut.mutate(payload)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight">{lead.landlordName}</h1>
              <LeadStatusBadge status={lead.status} size="lg" />
            </div>
            {lead.propertyAddress && (
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {lead.propertyAddress}
              </p>
            )}
            {lead.listingType && <div className="mt-2"><ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} size="lg" /></div>}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canChangeStatus && (
              <button
                onClick={() => setStatusDialog(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#F95C4B] border border-[#F95C4B]/30 hover:bg-[#F95C4B]/10 transition-colors"
              >
                <Repeat className="w-3.5 h-3.5" /> Change Status
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeleteDialog(true)}
                title="Delete lead"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-colors"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5">
          {[
            { key: 'details', label: 'Details', icon: FileText },
            { key: 'calls', label: 'Call Logs', icon: PhoneCall },
          ].map((t) => {
            const TIcon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap',
                  'border-b-2 transition-all rounded-t-lg',
                  tab === t.key
                    ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5 dark:bg-[#F95C4B]/8'
                    : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
                ].join(' ')}
              >
                <TIcon className="w-3.5 h-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 bg-[#FAFAF9] dark:bg-[#0B0B0B]">
        {tab === 'calls' ? (
          <div className="max-w-3xl mx-auto">
            {contact ? (
              <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-5">
                <ContactCallHistory contactId={contact._id} />
              </div>
            ) : (
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-10">No contact linked to this lead.</p>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Main column */}
            <div className="lg:col-span-3 space-y-5">
              <InfoCard icon={User} title="Contact">
                <InfoRow icon={User} label="Name" value={contact?.name ?? lead.landlordName} />
                <InfoRow icon={Phone} label="Phone" value={contact?.phone ?? lead.phone} />
                {contact?.altPhone && <InfoRow icon={Phone} label="Alt Phone" value={contact.altPhone} />}
                <InfoRow icon={Mail} label="Email" value={contact?.email ?? lead.email} />
                {area && <InfoRow icon={MapPin} label="Area" value={`${area.name}${area.region ? `, ${area.region}` : ''}`} />}
              </InfoCard>

              {creator && (
                <InfoCard icon={User} title="Cold Caller">
                  <InfoRow icon={User} label="Name" value={`${creator.firstName} ${creator.lastName}`} />
                  <InfoRow icon={Mail} label="Email" value={creator.email} />
                </InfoCard>
              )}

              <InfoCard icon={Building2} title="Assigned Agent">
                {canAssignAgency ? (
                  <div className="p-4">
                    <select
                      value={form.assignedAgent}
                      onChange={(e) => setField('assignedAgent', e.target.value)}
                      className={inputCls(false)}
                    >
                      <option value="">-- Unassigned --</option>
                      {agencies.map((a) => (
                        <option key={a._id} value={a._id}>{a.firstName} {a.lastName}</option>
                      ))}
                    </select>
                  </div>
                ) : assignedAgentUser ? (
                  <>
                    <InfoRow icon={User} label="Name" value={`${assignedAgentUser.firstName} ${assignedAgentUser.lastName}`} />
                    <InfoRow icon={Mail} label="Email" value={assignedAgentUser.email} />
                  </>
                ) : (
                  <p className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#A1A1AA] italic">Unassigned</p>
                )}
              </InfoCard>

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
                          <DateField value={form.followUpDate} onChange={(v) => setField('followUpDate', v)} className={inputCls(false)} />
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

              {lead.statusHistory?.length > 0 && (
                <InfoCard icon={History} title="Status History">
                  <div className="p-4 space-y-2.5">
                    {[...lead.statusHistory].reverse().map((h, i) => {
                      const changer = resolveUser(h.changedBy)
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                          <div className="flex-shrink-0 mt-0.5"><LeadStatusBadge status={h.status} /></div>
                          <div className="min-w-0 flex-1">
                            {h.reason && <p className="text-sm text-[#111111] dark:text-white leading-relaxed">"{h.reason}"</p>}
                            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-1">
                              {changer ? `${changer.firstName} ${changer.lastName}` : 'System'}
                              {h.changedAt && ` · ${format(new Date(h.changedAt), 'd MMM yyyy, HH:mm')}`}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </InfoCard>
              )}

              <LeadAppointments lead={lead} canBook={canEdit} />

              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                Created {format(new Date(lead.createdAt), 'd MMM yyyy, HH:mm')}
                {creator && ` by ${creator.firstName} ${creator.lastName}`}
                {' · '}Updated {format(new Date(lead.updatedAt), 'd MMM yyyy, HH:mm')}
              </p>
            </div>

            {/* Chat column */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-6">
                <FollowUpComments
                  lead={lead}
                  currentUserId={currentUserId}
                  canComment={canComment}
                  onAdded={setLead}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {statusDialog && (
        <StatusChangeDialog
          lead={lead}
          invalidateQueryKey={invalidateQueryKey}
          onClose={() => setStatusDialog(false)}
          onUpdated={(updated) => { setStatusDialog(false); if (updated) setLead(updated) }}
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
