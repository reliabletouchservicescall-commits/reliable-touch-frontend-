import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  TrendingUp, Search, X, ChevronLeft, ChevronRight, Loader2,
  MapPin, Phone, User, Clock, Home, AlertCircle, Plus, UserPlus, ArrowLeft,
} from 'lucide-react'
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
import {
  LeadsHeader, PrimaryButton, CountTiles, statusTileItems, Panel, useLeadInsights,
  ActiveFilterChips, FetchBar, FOCUS_LABELS, LEAD_STATUS_TILES,
} from '../../components/leads/LeadsHub'
import LeadSidePanel, { useLeadPanel, leadRowProps } from '../../components/leads/LeadSidePanel'
import { InsightStrip, SmartViews, LeadListTable } from '../../components/leads/LeadsWorkbench'
import { AgencyLeadDetail } from './LeadDetailPage'

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

function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function AgencyLeadsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  // The dashboard deep-links here with ?status= / ?source= / ?focus= / ?province= — read once
  // as the starting filters, then they're ordinary on-screen filters.
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '')
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get('source') ?? '')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [hasFollowUpFilter, setHasFollowUpFilter] = useState(false)
  const [hasCommentFilter, setHasCommentFilter] = useState(false)
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo,   setCreatedTo]   = useState('')
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState(() => searchParams.get('focus') ?? '') // one-click Quick insight filter
  // { kind: 'area', value: areaId, label } from Top areas, or { kind: 'province', ... } from the dashboard map
  const [place, setPlace] = useState(() => {
    const province = searchParams.get('province')
    return province ? { kind: 'province', value: province, label: province } : null
  })
  const [page, setPage] = useState(1)
  const [showNewLead, setShowNewLead] = useState(false)
  const isManager = Boolean(user?.isAgencyManager)
  const agentFilter = isManager ? (searchParams.get('agent') ?? '') : ''
  const debouncedSearch = useDebounce(search.trim())

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

  // GET /leads is scoped server-side exactly like the old /agents/me/leads (company for a
  // manager, own leads for an agent) and also honours search, the date range and focus —
  // search now covers every lead, not just the 20 on screen.
  const params = {
    page, limit: 24,
    ...scopeParams,
    ...(status ? { status } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(listingTypeFilter ? { listingType: listingTypeFilter } : {}),
    ...(hasFollowUpFilter ? { hasFollowUp: 'true' } : {}),
    ...(hasCommentFilter ? { hasComment: 'true' } : {}),
    ...(createdFrom ? { createdAfter: new Date(createdFrom).toISOString() } : {}),
    ...(createdTo ? { createdBefore: new Date(createdTo).toISOString() } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(focus ? { focus } : {}),
    ...(place ? (place.kind === 'province' ? { province: place.value } : { area: place.value }) : {}),
  }
  // Same as params but without status/page — feeds the per-status tile counts.
  const { status: _status, page: _page, limit: _limit, ...statsParams } = params

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['agent-leads', params],
    queryFn: () => leadsApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['agent-leads-stats', statsParams],
    queryFn: () => leadsApi.getStats(statsParams).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  // Report for the right rail: the whole company (or the one agent a manager picked).
  const { data: insights } = useLeadInsights(agentFilter && agentFilter !== 'unassigned' ? { assignedAgent: agentFilter } : {})

  const leads = data?.leads ?? []
  // Side panel: clicking a lead opens it beside the list (?lead=<id>); ↑/↓ step through
  const leadIdsKey = leads.map((l) => l._id).join(',')
  const leadIds = useMemo(() => (leadIdsKey ? leadIdsKey.split(',') : []), [leadIdsKey])
  const leadPanel = useLeadPanel(leadIds)
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const hasFilters = Boolean(status || sourceFilter || listingTypeFilter || hasFollowUpFilter || hasCommentFilter || createdFrom || createdTo || debouncedSearch || focus || place)
  const refreshing = isFetching && !isLoading

  function reset(fn) { return (...args) => { fn(...args); setPage(1) } }
  const setStatusR = reset(setStatus)
  const setFocusR = reset(setFocus)
  const setPlaceR = reset(setPlace)
  const chips = [
    focus && { key: 'focus', label: 'Insight', value: FOCUS_LABELS[focus], onClear: () => setFocusR('') },
    status && { key: 'status', label: 'Status', value: LEAD_STATUS_TILES.find((t) => t.key === status)?.label ?? status, onClear: () => setStatusR('') },
    place && { key: 'place', label: place.kind === 'province' ? 'Province' : 'Area', value: place.label, onClear: () => setPlaceR(null) },
    sourceFilter && { key: 'source', label: 'Source', value: sourceFilter === 'reliable_touch' ? 'From Reliable Touch' : 'Self-sourced', onClear: () => { setSourceFilter(''); setPage(1) } },
    listingTypeFilter && { key: 'intent', label: 'Intent', value: listingTypeFilter === 'sale' ? 'For sale' : 'For rental', onClear: () => { setListingTypeFilter(''); setPage(1) } },
  ].filter(Boolean)
  function clearAllFilters() {
    setFocus(''); setStatus(''); setPlace(null); setSourceFilter(''); setListingTypeFilter('')
    setHasFollowUpFilter(false); setHasCommentFilter(false); setCreatedFrom(''); setCreatedTo(''); setSearch(''); setPage(1)
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 xl:p-8 space-y-5">
      <LeadsHeader
        icon={TrendingUp}
        title={isManager ? 'Company leads' : 'My Leads'}
        subtitle={`${(statsData?.total ?? total).toLocaleString()} lead${(statsData?.total ?? total) !== 1 ? 's' : ''} ${isManager ? (agentFilter ? 'in this view' : 'attached to your company') : 'assigned to you'}`}
        insights={insights}
        extra={isManager && (
          <select
            value={agentFilter}
            onChange={(e) => changeAgentFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#F95C4B] cursor-pointer"
          >
            <option value="">Whole company</option>
            <option value="unassigned">Not yet with anyone</option>
            {team.map((m) => (
              <option key={m._id} value={m._id}>{m.firstName} {m.lastName}{m.isAgencyManager ? ' (you)' : ''}</option>
            ))}
          </select>
        )}
        action={<PrimaryButton icon={Plus} onClick={() => setShowNewLead(true)}>New Lead</PrimaryButton>}
      />

      <CountTiles items={statusTileItems(statsData)} value={status} onChange={setStatusR} />

      <InsightStrip insights={insights} focus={focus} onFocus={setFocusR} />
      <SmartViews insights={insights} focus={focus} onFocus={setFocusR} />

      <div className="grid grid-cols-1 gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <LeadSidePanel panel={leadPanel}>
            {(id) => (
              <AgencyLeadDetail
                id={id}
                panel={{
                  onClose: leadPanel.close,
                  onExpand: () => navigate(`/agency/leads/${id}`),
                  onPrev: leadPanel.prev,
                  onNext: leadPanel.next,
                  hasPrev: leadPanel.hasPrev,
                  hasNext: leadPanel.hasNext,
                  position: leadPanel.position,
                }}
              />
            )}
          </LeadSidePanel>
          <ActiveFilterChips chips={chips} count={chips.length ? total : null} onClearAll={clearAllFilters} />
          <FetchBar active={refreshing} />

          <Panel className="p-4 space-y-3" delay={140}>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search landlord, address or phone…"
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F95C4B] focus:bg-white dark:focus:bg-[#181818] transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <ListingTypeFilter value={listingTypeFilter} onChange={reset(setListingTypeFilter)} accent="#F95C4B" />
              <CreatedDateRangeFilter from={createdFrom} to={createdTo} onChange={reset(({ from, to }) => { setCreatedFrom(from); setCreatedTo(to) })} accent="#F95C4B" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FollowUpActivityFilters
                hasFollowUp={hasFollowUpFilter}
                onHasFollowUpChange={reset(setHasFollowUpFilter)}
                hasComment={hasCommentFilter}
                onHasCommentChange={reset(setHasCommentFilter)}
              />
              <span className="w-px h-6 bg-[#E5E7EB] dark:bg-[#2A2A2A] mx-1 hidden sm:block" />
              {[
                { key: '', label: 'All sources' },
                { key: 'agency_self_sourced', label: 'Self-sourced' },
                { key: 'reliable_touch', label: 'From Reliable Touch' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setSourceFilter(t.key); setPage(1) }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    sourceFilter === t.key
                      ? 'bg-[#F95C4B]/10 text-[#F95C4B] border border-[#F95C4B]/40'
                      : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Panel>

          {isError && (
            <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Failed to load leads. Please try again.
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="shimmer h-[86px] rounded-2xl" />)}</div>
          ) : leads.length === 0 ? (
            <Panel className="flex flex-col items-center justify-center py-20 gap-3 text-center" delay={180}>
              <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-[#111111] dark:text-white">
                {hasFilters ? 'No leads match these filters' : isManager ? 'No leads attached to your company yet' : 'No leads assigned to you yet'}
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                {hasFilters ? 'Try clearing a filter or the quick insight' : 'Add one with New Lead, or wait for Reliable Touch to send some'}
              </p>
            </Panel>
          ) : (
            <>
              <LeadListTable leads={leads} onOpen={(id) => leadPanel.open(id)} rowProps={(id) => leadRowProps(leadPanel, id)} refreshing={refreshing} />

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  Showing {(page - 1) * params.limit + 1}–{Math.min(page * params.limit, total)} of {total.toLocaleString()} lead{total !== 1 ? 's' : ''}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-9 h-9 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold text-[#111111] dark:text-white tabular-nums">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-9 h-9 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {showNewLead && (
        <NewLeadFlow
          team={team}
          isManager={isManager}
          currentUserId={user?._id}
          onClose={() => setShowNewLead(false)}
          onCreated={() => {
            setShowNewLead(false)
            qc.invalidateQueries({ queryKey: ['agent-leads'] })
            qc.invalidateQueries({ queryKey: ['agent-leads-stats'] })
            qc.invalidateQueries({ queryKey: ['lead-insights'] })
          }}
        />
      )}
    </div>
  )
}
