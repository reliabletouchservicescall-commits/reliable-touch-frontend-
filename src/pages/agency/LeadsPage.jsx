import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  TrendingUp, Search, X, ChevronLeft, ChevronRight, Loader2,
  MapPin, Phone, User, Clock, Home, AlertCircle, Plus, UserPlus, ArrowLeft,
} from 'lucide-react'
import { agentsApi } from '../../services/agentsApi'
import { agenciesApi } from '../../services/agenciesApi'
import { leadsApi } from '../../services/leadsApi'
import { contactsApi } from '../../services/contactsApi'
import { areasApi } from '../../services/areasApi'
import {
  ListingBadge, ListingTypeFilter, LastFollowUpCommentCell, FollowUpActivityFilters, CreatedDateRangeFilter,
  LeadSourceBadge, SearchableContactSelect, SearchableAreaSelect, Field, inputCls, getApiErrorMessage,
} from '../../components/leads/leadShared'
import CreateLeadDrawer from '../../components/leads/CreateLeadDrawer'
import SidePanel from '../../components/common/SidePanel'
import { useAuthStore } from '../../store/authStore'

const STATUS_META = {
  cold:              { label: 'Cold',              color: '#6B7280', bg: '#6B728018' },
  warm:              { label: 'Warm',               color: '#F59E0B', bg: '#F59E0B18' },
  hot:               { label: 'Hot',                color: '#EF4444', bg: '#EF444418' },
  still_negotiating: { label: 'Still Negotiating',  color: '#F59E0B', bg: '#F59E0B18' },
  listed:            { label: 'Listed',              color: '#8B5CF6', bg: '#8B5CF618' },
  rented_out:        { label: 'Rented Out',          color: '#10B981', bg: '#10B98118' },
  sold:              { label: 'Sold',                color: '#F95C4B', bg: '#F95C4B18' },
  lost:              { label: 'Lost',                color: '#9CA3AF', bg: '#9CA3AF18' },
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'cold', label: 'Cold' },
  { key: 'warm', label: 'Warm' },
  { key: 'hot', label: 'Hot' },
  { key: 'still_negotiating', label: 'Negotiating' },
  { key: 'listed', label: 'Listed' },
  { key: 'rented_out', label: 'Rented Out' },
  { key: 'sold', label: 'Sold' },
  { key: 'lost', label: 'Lost' },
]

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#6B7280', bg: '#6B728018' }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'd MMM yyyy')
}

function LeadCard({ lead, onClick, currentUserId }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#F95C4B]/40 hover:shadow-sm transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#111111] dark:text-white truncate">
              {lead.landlordName ?? 'Unknown Landlord'}
            </h3>
            <StatusBadge status={lead.status} />
          </div>
          <div className="mt-1.5">
            <LeadSourceBadge source={lead.source} />
          </div>
          {lead.propertyAddress && (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 mt-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {lead.propertyAddress}
            </p>
          )}
          <div className="mt-2">
            <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {lead.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
            <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{lead.phone}</span>
          </div>
        )}
        {lead.area && (
          <div className="flex items-center gap-1.5">
            <Home className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
            <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
              {typeof lead.area === 'object' ? lead.area.name : lead.area}
            </span>
          </div>
        )}
        {lead.createdBy && (
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
            <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
              {typeof lead.createdBy === 'object'
                ? `${lead.createdBy.firstName ?? ''} ${lead.createdBy.lastName ?? ''}`.trim()
                : '—'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{fmtDate(lead.createdAt)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
        <LastFollowUpCommentCell lead={lead} currentUserId={currentUserId} maxWidthClass="max-w-full" />
      </div>

      <div className="flex items-center justify-end mt-3 pt-3 border-t border-[#F5F5F4] dark:border-[#202020]">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#F95C4B] group-hover:gap-1.5 transition-all">
          View details <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  )
}

/* ─── Quick-add contact (person not in the system yet) ──────────────────── */
// Only what a lead needs: name + phone, plus the property details that the lead form
// would otherwise ask for straight after. A manager's contact lands in the company pool;
// an agent's is assigned to them (handled server-side) — either way it's then selectable.
function QuickAddContactForm({ prefill, onBack, onCreated }) {
  const qc = useQueryClient()
  const looksLikePhone = /^[+\d\s()-]{6,}$/.test(prefill ?? '')
  const [form, setForm] = useState({
    name: looksLikePhone ? '' : (prefill ?? ''),
    phone: looksLikePhone ? prefill : '',
    altPhone: '', sectionalScheme: '', unitNumber: '', address: '', area: '',
  })
  const [errors, setErrors] = useState({})

  const { data: areas } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })

  const mut = useMutation({
    mutationFn: (payload) => contactsApi.create(payload).then((r) => r.data.data.contact),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: ['contacts-search'] })
      qc.invalidateQueries({ queryKey: ['agency-contacts'] })
      qc.invalidateQueries({ queryKey: ['agent-contacts'] })
      toast.success(`${contact.name} added — now fill in the lead`)
      onCreated(contact)
    },
    onError: (e) => {
      const msg = getApiErrorMessage(e, 'Could not add contact')
      if (e.response?.status === 409) setErrors((x) => ({ ...x, phone: msg }))
      toast.error(msg)
    },
  })

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: null }))
  }

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 2) errs.name = 'Enter the contact\'s full name'
    if (!form.phone.trim()) errs.phone = 'A phone number is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    const payload = { source: 'manual' }
    Object.entries(form).forEach(([k, v]) => { if (String(v).trim()) payload[k] = String(v).trim() })
    mut.mutate(payload)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to contact search
      </button>

      <Field label="Full name" required error={errors.name}>
        <input autoFocus={!looksLikePhone} value={form.name} onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Thabo Nkosi" className={inputCls(errors.name)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" required error={errors.phone}>
          <input autoFocus={looksLikePhone} value={form.phone} onChange={(e) => set('phone', e.target.value)}
            placeholder="082 123 4567" inputMode="tel" className={inputCls(errors.phone)} />
        </Field>
        <Field label="Alt phone">
          <input value={form.altPhone} onChange={(e) => set('altPhone', e.target.value)}
            placeholder="Optional" inputMode="tel" className={inputCls(false)} />
        </Field>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-3.5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5">
          <Home className="w-3.5 h-3.5" /> Property — optional, saves a step on the lead
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sectional scheme">
            <input value={form.sectionalScheme} onChange={(e) => set('sectionalScheme', e.target.value)}
              placeholder="e.g. Phoenix View" className={inputCls(false)} />
          </Field>
          <Field label="Unit">
            <input value={form.unitNumber} onChange={(e) => set('unitNumber', e.target.value)}
              placeholder="e.g. 14" className={inputCls(false)} />
          </Field>
        </div>
        <Field label="Address">
          <input value={form.address} onChange={(e) => set('address', e.target.value)}
            placeholder="Street address" className={inputCls(false)} />
        </Field>
        <Field label="Area">
          <SearchableAreaSelect areas={areas ?? []} value={form.area} onChange={(v) => set('area', v)} placeholder="Select area…" allowAdd />
        </Field>
      </div>

      <button type="submit" disabled={mut.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50">
        {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Add contact & continue to lead
      </button>
    </form>
  )
}

/* ─── New Lead: pick (or add) a contact first, then the full create form ── */
function NewLeadFlow({ team, isManager, currentUserId, onClose, onCreated }) {
  const [contactId, setContactId] = useState('')
  const [adding, setAdding] = useState(null) // null = picking; string = quick-add, prefilled with the search text
  const { data: contact, isFetching } = useQuery({
    queryKey: ['new-lead-contact', contactId],
    queryFn: () => contactsApi.getById(contactId).then((r) => r.data.data.contact),
    enabled: Boolean(contactId),
  })

  if (contact) {
    return (
      <CreateLeadDrawer
        contact={contact}
        assignment={isManager ? { teamMembers: team, defaultAssignedAgent: currentUserId } : undefined}
        onClose={onClose}
        onCreated={onCreated}
      />
    )
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={adding !== null ? UserPlus : TrendingUp}
      iconColor="#F95C4B"
      title={adding !== null ? 'New Contact' : 'New Lead'}
      subtitle={adding !== null ? 'Add the person, then carry on with the lead' : 'Pick which contact this lead is for'}
      widthClass="sm:max-w-sm"
    >
      <div className="px-5 py-5">
        {isFetching ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
        ) : adding !== null ? (
          <QuickAddContactForm
            prefill={adding}
            onBack={() => setAdding(null)}
            onCreated={(c) => { setAdding(null); setContactId(c._id) }}
          />
        ) : (
          <div className="space-y-4">
            <Field label="Contact" required hint="Search by name or phone — only your own contacts appear here">
              <SearchableContactSelect value={contactId} onChange={setContactId} placeholder="Select contact…" onAddNew={setAdding} />
            </Field>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">or</span>
              <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
            </div>
            <button type="button" onClick={() => setAdding('')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-[#F95C4B]/40 text-[#F95C4B] hover:bg-[#F95C4B]/5 hover:border-[#F95C4B]/70 transition-colors">
              <UserPlus className="w-4 h-4" /> Add a new contact
            </button>
            <p className="text-[11px] text-center text-[#9CA3AF]">For someone who isn't in your contacts yet</p>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

export default function AgencyLeadsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [status, setStatus] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [hasFollowUpFilter, setHasFollowUpFilter] = useState(false)
  const [hasCommentFilter, setHasCommentFilter] = useState(false)
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo,   setCreatedTo]   = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showNewLead, setShowNewLead] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const isManager = Boolean(user?.isAgencyManager)
  const agentFilter = isManager ? (searchParams.get('agent') ?? '') : ''

  const { data: teamData } = useQuery({
    queryKey: ['agency-team', user?.agencyId],
    queryFn: () => agenciesApi.myTeam().then((r) => r.data.data.team),
    enabled: isManager,
    staleTime: 60_000,
  })
  const team = teamData ?? []

  // A manager narrows the company's book to one person, or to the leads nobody has picked up.
  const scopeParams = agentFilter === 'unassigned'
    ? { unassigned: 'true' }
    : agentFilter ? { assignedAgent: agentFilter } : {}

  function changeAgentFilter(value) {
    setPage(1)
    setSearchParams(value ? { agent: value } : {}, { replace: true })
  }

  const params = {
    page, limit: 20,
    ...scopeParams,
    ...(status ? { status } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(listingTypeFilter ? { listingType: listingTypeFilter } : {}),
    ...(hasFollowUpFilter ? { hasFollowUp: 'true' } : {}),
    ...(hasCommentFilter ? { hasComment: 'true' } : {}),
    ...(createdFrom ? { createdAfter: new Date(createdFrom).toISOString() } : {}),
    ...(createdTo ? { createdBefore: new Date(createdTo).toISOString() } : {}),
  }
  // Same as params but without status — feeds the per-status tab counts, which need
  // every OTHER active filter applied but obviously can't themselves be status-filtered.
  const { status: _status, ...statsParams } = params

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-leads', params],
    queryFn: () => agentsApi.myLeads(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['agent-leads-stats', statsParams],
    queryFn: () => leadsApi.getStats(statsParams).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const statusCounts = statsData?.byStatus ?? {}

  const leads = data?.leads ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const filtered = search.trim()
    ? leads.filter((l) => {
        const q = search.toLowerCase()
        return (
          (l.landlordName ?? '').toLowerCase().includes(q) ||
          (l.propertyAddress ?? '').toLowerCase().includes(q) ||
          (l.phone ?? '').toLowerCase().includes(q)
        )
      })
    : leads

  function handleTabChange(key) {
    setStatus(key)
    setPage(1)
  }

  function handleListingTypeChange(key) {
    setListingTypeFilter(key)
    setPage(1)
  }

  function handleHasFollowUpChange(value) {
    setHasFollowUpFilter(value)
    setPage(1)
  }

  function handleHasCommentChange(value) {
    setHasCommentFilter(value)
    setPage(1)
  }

  function handleCreatedDateChange({ from, to }) {
    setCreatedFrom(from)
    setCreatedTo(to)
    setPage(1)
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#111111] dark:text-white">{isManager ? 'Company leads' : 'My Leads'}</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {total} lead{total !== 1 ? 's' : ''} {isManager ? 'attached to your company' : 'assigned to you'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowNewLead(true)}
          className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> New Lead
        </button>

        {isManager && (
          <select
            value={agentFilter}
            onChange={(e) => changeAgentFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#F95C4B] cursor-pointer"
          >
            <option value="">Whole company</option>
            <option value="unassigned">Not yet with anyone</option>
            {team.map((m) => (
              <option key={m._id} value={m._id}>{m.firstName} {m.lastName}{m.isAgencyManager ? ' (you)' : ''}</option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full sm:w-64 pl-8 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F95C4B] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                status === t.key
                  ? 'bg-[#F95C4B] text-white shadow-sm'
                  : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]'
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  status === t.key ? 'bg-white/20 text-white' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]'
                }`}
              >
                {t.key ? (statusCounts[t.key] ?? 0) : statsData?.total ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ListingTypeFilter value={listingTypeFilter} onChange={handleListingTypeChange} accent="#F95C4B" />
          <FollowUpActivityFilters
            hasFollowUp={hasFollowUpFilter}
            onHasFollowUpChange={handleHasFollowUpChange}
            hasComment={hasCommentFilter}
            onHasCommentChange={handleHasCommentChange}
          />
          <CreatedDateRangeFilter from={createdFrom} to={createdTo} onChange={handleCreatedDateChange} accent="#F95C4B" />
        </div>
      </div>

      {/* Source tabs — where each lead came from */}
      <div className="flex items-center gap-1">
        {[
          { key: '', label: 'All Leads' },
          { key: 'agency_self_sourced', label: 'Self-Sourced' },
          { key: 'reliable_touch', label: 'From Reliable Touch' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setSourceFilter(t.key); setPage(1) }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceFilter === t.key
                ? 'bg-[#F95C4B]/10 text-[#F95C4B] border border-[#F95C4B]/40 shadow-sm'
                : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isError && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load leads. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#F95C4B] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-[#111111] dark:text-white">
            {search ? 'No matching leads' : 'No leads assigned yet'}
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            {search ? 'Try a different search term' : 'Leads will appear here once assigned to you'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((lead) => (
              <LeadCard key={lead._id} lead={lead} onClick={() => navigate(`/agency/leads/${lead._id}`)} currentUserId={user?._id} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {showNewLead && (
        <NewLeadFlow
          team={team}
          isManager={isManager}
          currentUserId={user?._id}
          onClose={() => setShowNewLead(false)}
          onCreated={() => setShowNewLead(false)}
        />
      )}
    </div>
  )
}
