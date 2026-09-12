import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast, differenceInDays } from 'date-fns'
import {
  Flame, Search, X, Loader2, AlertTriangle, MapPin, Phone, Building2, Repeat, ArrowRight,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { appointmentsApi } from '../../services/appointmentsApi'
import { useAuthStore } from '../../store/authStore'
import {
  ListingFields, ListingBadge, PropertyFromContact, LeadStatusBadge, FollowUpComments,
  Field, inputCls, LEAD_STATUS_META, getApiErrorMessage,
} from '../../components/leads/leadShared'
import LeadAppointments from '../../components/appointments/LeadAppointments'

const STATUS_OPTS = ['warm', 'hot', 'listed', 'rented_out', 'sold', 'lost']

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function FollowUpChip({ date }) {
  if (!date) return <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">No follow-up set</span>
  const d = new Date(date)
  const overdue = isPast(d)
  const days = differenceInDays(d, new Date())
  const soon = !overdue && days <= 3
  if (overdue) return <span className="text-xs font-semibold text-[#EF4444]">{format(d, 'd MMM yyyy')} (overdue)</span>
  if (soon) return <span className="text-xs font-semibold text-[#F59E0B]">{format(d, 'd MMM yyyy')}</span>
  return <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{format(d, 'd MMM yyyy')}</span>
}

/* ─── Lead Card ──────────────────────────────────────────────────────────── */

function LeadCard({ lead, onOpen }) {
  const areaObj = (lead.area && typeof lead.area === 'object') ? lead.area : null
  const agentObj = (lead.assignedAgent && typeof lead.assignedAgent === 'object') ? lead.assignedAgent : null
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#8B5CF6]/40 hover:shadow-card transition-all p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{lead.landlordName}</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 truncate">{lead.propertyAddress}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      <div className="mt-2.5">
        <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {lead.phone && (
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
            <Phone className="w-3 h-3 flex-shrink-0" />
            {lead.phone}
          </span>
        )}
        {areaObj && (
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {areaObj.name}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F5F5F4] dark:border-[#202020]">
        <FollowUpChip date={lead.followUpDate} />
        {agentObj ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
            <Building2 className="w-3 h-3" /> {agentObj.firstName} {agentObj.lastName}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-[#F59E0B]">No agency assigned</span>
        )}
      </div>
    </button>
  )
}

/* ─── Status Change Dialog ───────────────────────────────────────────────── */

function StatusChangeDialog({ lead, onClose, onUpdated }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(lead.status)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => leadsApi.updateStatus(lead._id, { status, reason: reason.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fum-leads'] })
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
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
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
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 flex items-center justify-center gap-2"
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

/* ─── Lead Detail Drawer ─────────────────────────────────────────────────── */

function LeadDetailDrawer({ lead: initialLead, onClose }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [lead, setLead] = useState(initialLead)
  const [statusDialog, setStatusDialog] = useState(false)
  const contact = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null

  const [form, setForm] = useState({
    landlordName: lead.landlordName ?? '',
    listingType: lead.listingType ?? '',
    priceMin: lead.priceMin ?? '',
    priceMax: lead.priceMax ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    availability: lead.availability ?? '',
    bestCallTime: lead.bestCallTime ?? '',
    followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : '',
    assignedAgent: lead.assignedAgent?._id ?? lead.assignedAgent ?? '',
  })

  const { data: assigneesData } = useQuery({
    queryKey: ['appointment-assignees'],
    queryFn: () => appointmentsApi.assignees().then((r) => r.data.data?.users ?? []),
    staleTime: 60_000,
  })
  const agencies = (assigneesData ?? []).filter((a) => a.role === 'agency')

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  const mut = useMutation({
    mutationFn: (payload) => leadsApi.update(lead._id, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fum-leads'] })
      toast.success('Lead updated')
      setLead(res.data.data.lead)
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update lead')),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {}
    Object.entries(form).forEach(([k, v]) => { payload[k] = v === '' ? null : v })
    mut.mutate(payload)
  }

  const agentObj = (lead.assignedAgent && typeof lead.assignedAgent === 'object') ? lead.assignedAgent : null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[540px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#111111] dark:text-white truncate">{lead.landlordName}</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{lead.propertyAddress}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <LeadStatusBadge status={lead.status} size="lg" />
            <button
              onClick={() => setStatusDialog(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#8B5CF6] border border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/10 transition-colors"
            >
              <Repeat className="w-3 h-3" /> Change
            </button>
          </div>

          {contact && (
            <PropertyFromContact contact={contact} />
          )}

          <form id="fum-lead-form" onSubmit={handleSubmit} className="space-y-5">
            <Field label="Landlord Name">
              <input value={form.landlordName} onChange={(e) => setField('landlordName', e.target.value)} className={inputCls(false)} />
            </Field>

            <ListingFields form={form} setField={setField} errors={{}} />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputCls(false)} />
              </Field>
              <Field label="Email">
                <input value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls(false)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Availability">
                <input value={form.availability} onChange={(e) => setField('availability', e.target.value)} className={inputCls(false)} />
              </Field>
              <Field label="Best Call Time">
                <input value={form.bestCallTime} onChange={(e) => setField('bestCallTime', e.target.value)} className={inputCls(false)} />
              </Field>
            </div>

            <Field label="Follow-up Date">
              <input type="date" value={form.followUpDate} onChange={(e) => setField('followUpDate', e.target.value)} className={inputCls(false)} />
            </Field>

            <Field label="Assign to Agency" hint="Routes this lead to an agency to handle the property visit">
              <select value={form.assignedAgent} onChange={(e) => setField('assignedAgent', e.target.value)} className={inputCls(false)}>
                <option value="">-- Unassigned --</option>
                {agencies.map((a) => (
                  <option key={a._id} value={a._id}>{a.firstName} {a.lastName}</option>
                ))}
              </select>
            </Field>
            {agentObj && (
              <p className="text-xs text-[#10B981] font-medium -mt-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Currently assigned to {agentObj.firstName} {agentObj.lastName}
              </p>
            )}
          </form>

          <LeadAppointments lead={lead} canBook />

          <FollowUpComments
            lead={lead}
            currentUserId={user?._id}
            canComment
            onAdded={(updatedLead) => setLead(updatedLead)}
          />
        </div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Close
          </button>
          <button
            type="submit" form="fum-lead-form"
            disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      {statusDialog && (
        <StatusChangeDialog
          lead={lead}
          onClose={() => setStatusDialog(false)}
          onUpdated={(updatedLead) => { setStatusDialog(false); if (updatedLead) setLead(updatedLead) }}
        />
      )}
    </>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
        <Flame className="w-7 h-7 text-[#8B5CF6]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No hot leads found' : 'No hot leads right now'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
        {hasFilters ? 'Try a different search.' : 'Leads land here automatically once they heat up — nothing to work yet.'}
      </p>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function FollowUpManagerLeadsPage() {
  const [search, setSearch] = useState('')
  const [activeLead, setActiveLead] = useState(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fum-leads', { search: debouncedSearch }],
    queryFn: () => leadsApi.list({ search: debouncedSearch || undefined, limit: 100 }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const leads = data?.leads ?? []
  const total = leads.length
  const unassignedCount = leads.filter((l) => !l.assignedAgent).length
  const overdueCount = leads.filter((l) => l.followUpDate && isPast(new Date(l.followUpDate))).length

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
              Hot Leads
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : `${total} hot lead${total !== 1 ? 's' : ''} to work`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-[#8B5CF6]">{isLoading ? '—' : total}</p>
            <p className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mt-0.5">Hot Leads</p>
          </div>
          <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-[#F59E0B]">{isLoading ? '—' : unassignedCount}</p>
            <p className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mt-0.5">No Agency Yet</p>
          </div>
          <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-[#EF4444]">{isLoading ? '—' : overdueCount}</p>
            <p className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mt-0.5">Overdue Follow-up</p>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search landlord, address, phone…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load leads. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState hasFilters={Boolean(search)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => (
              <LeadCard key={lead._id} lead={lead} onOpen={() => setActiveLead(lead)} />
            ))}
          </div>
        )}
      </div>

      {activeLead && (
        <LeadDetailDrawer lead={activeLead} onClose={() => setActiveLead(null)} />
      )}
    </div>
  )
}
