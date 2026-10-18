import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Flame, Search, X, AlertTriangle, Loader2, Users,
  ChevronDown, ChevronUp, CalendarCheck,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import {
  ListingBadge, ListingTypeFilter, LeadStatusBadge, FollowUpChip,
  LastFollowUpCommentCell, LastFollowUpByCell, isLeadFollowedUpToday, isLeadFollowedUpByMeToday,
  FollowUpActivityFilters, CreatedDateRangeFilter, QuickFollowUpDateButton,
} from '../../components/leads/leadShared'
import { useAuthStore } from '../../store/authStore'
import {
  LeadsHeader, CountTiles, LeadsRail, Panel, useLeadInsights,
  ActiveFilterChips, FetchBar, TableSkeleton, FOCUS_LABELS,
} from '../../components/leads/LeadsHub'

// Leads load in batches of 300 ("Load more" appends the next batch).
const PAGE_SIZE = 300

const FOLLOWED_UP_OPTIONS = [
  { value: '',      label: 'Any time' },
  { value: 'today', label: 'Followed up today' },
  { value: 'week',  label: 'Followed up this week' },
  { value: 'month', label: 'Followed up this month' },
]

const FUM_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F95C4B', '#84CC16',
]

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function resolveUser(obj) {
  if (!obj) return null
  if (typeof obj === 'object' && obj.firstName) return obj
  return null
}

function resolveAgency(obj) {
  if (!obj) return null
  if (typeof obj === 'object' && obj.name) return obj
  return null
}

/* ─── Filter by Follow-Up Manager strip ──────────────────────────────────── */

function FollowUpManagerStrip({ fumFilter, onFumChange, collapsed, onToggleCollapsed }) {
  const { data: fumData } = useQuery({
    queryKey: ['follow-up-managers-select'],
    queryFn: () => leadsApi.followUpManagers().then((r) => r.data.data.users),
    staleTime: 60_000,
  })
  const fumList = Array.isArray(fumData) ? fumData : []

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['fum-leads-all-count'],
    queryFn: () => leadsApi.list({ limit: 1 }).then((r) => r.data.data?.total ?? 0),
    staleTime: 30_000,
  })

  const { data: counts = {} } = useQuery({
    queryKey: ['fum-leads-counts', fumList.map((u) => u._id)],
    queryFn: async () => {
      const results = await Promise.all(
        fumList.map((u) =>
          leadsApi.list({ lastFollowUpBy: u._id, limit: 1 }).then((r) => [u._id, r.data.data?.total ?? 0])
        )
      )
      return Object.fromEntries(results)
    },
    enabled: fumList.length > 0,
    staleTime: 30_000,
  })

  if (!fumList.length) return null

  return (
    <div className="px-5 sm:px-8 py-3.5 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
      <button
        onClick={onToggleCollapsed}
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white mb-2.5 transition-colors"
      >
        Filter by Follow-Up Manager
        {fumFilter && !collapsed && (
          <span className="normal-case tracking-normal font-bold text-[#F95C4B]">
            · {fumList.find((u) => u._id === fumFilter)?.firstName ?? '1 selected'}
          </span>
        )}
        {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>
      {!collapsed && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onFumChange('')}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
              fumFilter === ''
                ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] shadow-sm'
                : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#111111] dark:hover:border-white hover:text-[#111111] dark:hover:text-white',
            ].join(' ')}
          >
            <Users className="w-3.5 h-3.5" />
            All
            <span className={[
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
              fumFilter === ''
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#111111]'
                : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white',
            ].join(' ')}>
              {totalCount}
            </span>
          </button>

          {fumList.map((u, idx) => {
            const color    = FUM_COLORS[idx % FUM_COLORS.length]
            const count    = counts[u._id] ?? 0
            const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase()
            const isActive = fumFilter === u._id

            return (
              <button
                key={u._id}
                onClick={() => onFumChange(isActive ? '' : u._id)}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                  isActive ? 'shadow-sm' : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white',
                ].join(' ')}
                style={isActive ? { backgroundColor: color, color: 'white', borderColor: 'transparent' } : {}}
              >
                <span
                  className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${color}18`, color: isActive ? 'white' : color }}
                >
                  {initials}
                </span>
                {u.firstName} {u.lastName}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : `${color}18`, color: isActive ? 'white' : color }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Lead Row ───────────────────────────────────────────────────────────── */

function LeadRow({ lead, onOpen, currentUserId, onFollowUpSaved }) {
  const contactObj = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const agentUser  = resolveUser(lead.assignedAgent)
  const agency     = resolveAgency(lead.agencyId)
  const callerUser = resolveUser(lead.createdBy)
  const followedUpToday = isLeadFollowedUpToday(lead)
  const followedUpByMeToday = isLeadFollowedUpByMeToday(lead, currentUserId)

  return (
    <tr
      onClick={onOpen}
      className={[
        'transition-colors cursor-pointer border-l-2',
        followedUpByMeToday
          ? 'bg-[#10B981]/[0.05] hover:bg-[#10B981]/[0.08] dark:bg-[#10B981]/[0.07] dark:hover:bg-[#10B981]/10 border-l-transparent animate-glow-pulse-ring'
          : followedUpToday
            ? 'bg-[#10B981]/[0.04] hover:bg-[#10B981]/[0.07] dark:bg-[#10B981]/[0.06] dark:hover:bg-[#10B981]/10 border-l-[#10B981]'
            : 'border-l-transparent hover:bg-[#FAFAF9] dark:hover:bg-[#111111]',
      ].join(' ')}
    >
      <td className="px-4 py-3.5">
        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[180px]">{lead.landlordName}</p>
        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[180px]">{lead.propertyAddress}</p>
        <div className="mt-1">
          <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-sm text-[#111111] dark:text-white">{contactObj?.name ?? lead.landlordName}</p>
        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">{lead.phone}</p>
      </td>
      <td className="px-4 py-3.5">
        {callerUser ? (
          <p className="text-sm text-[#111111] dark:text-white">{callerUser.firstName} {callerUser.lastName}</p>
        ) : (
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">Unknown</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {agentUser ? (
          <p className="text-sm text-[#111111] dark:text-white">{agentUser.firstName} {agentUser.lastName}</p>
        ) : agency ? (
          <p className="text-sm text-[#111111] dark:text-white">{agency.name}</p>
        ) : (
          <span className="text-xs text-[#F59E0B] font-semibold">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{format(new Date(lead.createdAt), 'd MMM yyyy')}</p>
      </td>
      <td className="px-4 py-3.5">
        <LeadStatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          <FollowUpChip date={lead.followUpDate} />
          <QuickFollowUpDateButton lead={lead} onSaved={onFollowUpSaved} />
        </div>
      </td>
      <td className="px-4 py-3.5">
        <LastFollowUpCommentCell lead={lead} currentUserId={currentUserId} />
      </td>
      <td className="px-4 py-3.5">
        <LastFollowUpByCell lead={lead} />
      </td>
    </tr>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <Flame className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No hot leads found' : 'No hot leads right now'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
        {hasFilters ? 'Try adjusting your search or filters.' : 'Leads land here automatically once they heat up — nothing to work yet.'}
      </p>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function FollowUpManagerLeadsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [fumFilter, setFumFilter] = useState('')
  const [followedUpFilter, setFollowedUpFilter] = useState('')
  const [hasFollowUpFilter, setHasFollowUpFilter] = useState(false)
  const [hasCommentFilter, setHasCommentFilter] = useState(false)
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo,   setCreatedTo]   = useState('')
  const [fumFilterCollapsed, setFumFilterCollapsed] = useState(false)
  const [focus, setFocus] = useState('') // one-click Quick insight filter
  const [place, setPlace] = useState(null) // { kind: 'province', value, label } from Top provinces
  const debouncedSearch = useDebounce(search)

  // Loaded 300 at a time (PAGE_SIZE) via "Load more" rather than a hard-capped single page — the hot
  // leads queue can exceed the old 100-lead cap, which silently hid leads beyond it and
  // under-reported the total.
  const {
    data, isLoading, isError, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['fum-leads', { search: debouncedSearch, listingType: listingTypeFilter, lastFollowUpBy: fumFilter, followedUpWithin: followedUpFilter, hasFollowUp: hasFollowUpFilter, hasComment: hasCommentFilter, createdFrom, createdTo, focus, province: place?.value }],
    queryFn: ({ pageParam }) => leadsApi.list({
      search:      debouncedSearch    || undefined,
      listingType: listingTypeFilter  || undefined,
      lastFollowUpBy: fumFilter       || undefined,
      followedUpWithin: followedUpFilter || undefined,
      hasFollowUp: hasFollowUpFilter ? 'true' : undefined,
      hasComment:  hasCommentFilter  ? 'true' : undefined,
      createdAfter:  createdFrom ? new Date(createdFrom).toISOString() : undefined,
      createdBefore: createdTo   ? new Date(createdTo).toISOString()   : undefined,
      focus:         focus || undefined,
      province:      place?.value || undefined,
      limit: PAGE_SIZE,
      page: pageParam,
    }).then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    placeholderData: keepPreviousData,
  })

  const leads = data?.pages?.flatMap((p) => p.leads) ?? []
  const total = data?.pages?.[0]?.total ?? 0
  const hasFilters = Boolean(search || listingTypeFilter || fumFilter || followedUpFilter || hasFollowUpFilter || hasCommentFilter || createdFrom || createdTo || focus || place)
  const refreshing = isFetching && !isLoading && !isFetchingNextPage
  const chips = [
    focus && { key: 'focus', label: 'Insight', value: FOCUS_LABELS[focus], onClear: () => setFocus('') },
    followedUpFilter && { key: 'fu', label: 'Followed up', value: followedUpFilter === 'today' ? 'Today' : followedUpFilter === 'week' ? 'This week' : 'This month', onClear: () => setFollowedUpFilter('') },
    place && { key: 'place', label: 'Province', value: place.label, onClear: () => setPlace(null) },
    listingTypeFilter && { key: 'intent', label: 'Intent', value: listingTypeFilter === 'sale' ? 'For sale' : 'For rental', onClear: () => setListingTypeFilter('') },
  ].filter(Boolean)
  function clearAllFilters() {
    setFocus(''); setPlace(null); setFollowedUpFilter(''); setListingTypeFilter(''); setFumFilter('')
    setHasFollowUpFilter(false); setHasCommentFilter(false); setCreatedFrom(''); setCreatedTo(''); setSearch('')
  }

  // Report for the hot-leads queue (server-scoped to hot leads for this role); follows the
  // "filter by follow-up manager" strip so a manager can see one colleague's progress.
  const { data: insights } = useLeadInsights({ lastFollowUpBy: fumFilter || undefined })

  // Follow-up progress tiles — the follow-up manager's own "status row" (every lead here
  // is hot, so status tiles would say nothing). Each tile maps onto an existing filter.
  const TILE_FILTERS = {
    '': () => { setFollowedUpFilter(''); setFocus('') },
    followed_today: () => { setFocus(''); setFollowedUpFilter('today') },
    followed_week: () => { setFocus(''); setFollowedUpFilter('week') },
    due_today: () => { setFollowedUpFilter(''); setFocus('due_today') },
    overdue: () => { setFollowedUpFilter(''); setFocus('overdue') },
    never_followed_up: () => { setFollowedUpFilter(''); setFocus('never_followed_up') },
    no_agent: () => { setFollowedUpFilter(''); setFocus('no_agent') },
  }
  const activeTile = focus || (followedUpFilter === 'today' ? 'followed_today' : followedUpFilter === 'week' ? 'followed_week' : '')
  const progressTiles = [
    { key: '', label: 'Hot leads', count: insights?.total ?? total, icon: Flame },
    { key: 'followed_today', label: 'Followed up today', count: insights?.followedUpToday ?? 0, color: '#10B981' },
    { key: 'followed_week', label: 'This week', count: insights?.followedUpWeek ?? 0, color: '#34D399' },
    { key: 'due_today', label: 'Due today', count: insights?.dueToday ?? 0, color: '#F59E0B' },
    { key: 'overdue', label: 'Overdue', count: insights?.overdue ?? 0, color: '#DC2626' },
    { key: 'never_followed_up', label: 'Never followed up', count: insights?.neverFollowedUp ?? 0, color: '#111111' },
    { key: 'no_agent', label: 'No agency yet', count: insights?.noAgent ?? 0, color: '#F95C4B' },
  ]

  function handleFollowUpSaved() {
    qc.invalidateQueries({ queryKey: ['fum-leads'] })
    qc.invalidateQueries({ queryKey: ['lead-insights'] })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      <div className="p-4 sm:p-6 xl:p-8 space-y-5">
        <LeadsHeader
          icon={Flame}
          title="Hot Leads"
          subtitle={isLoading ? 'Loading…' : `${total.toLocaleString()} hot lead${total !== 1 ? 's' : ''} to work${hasFilters ? ' match your filters' : ''}`}
          insights={insights}
        />

        <CountTiles items={progressTiles} value={activeTile} onChange={(k) => TILE_FILTERS[k]?.()} />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <ActiveFilterChips chips={chips} count={chips.length ? total : null} onClearAll={clearAllFilters} />

            <Panel className="overflow-hidden" delay={120}>
              {/* ── Filter by Follow-Up Manager strip ───────────────────────────── */}
      <FollowUpManagerStrip
        fumFilter={fumFilter}
        onFumChange={setFumFilter}
        collapsed={fumFilterCollapsed}
        onToggleCollapsed={() => setFumFilterCollapsed((v) => !v)}
      />
            </Panel>

            <Panel className="p-4 flex flex-col sm:flex-row sm:flex-wrap gap-3" delay={160}>
              <div className="relative flex-1 min-w-[240px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search landlord, address, phone…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <ListingTypeFilter value={listingTypeFilter} onChange={setListingTypeFilter} accent="#F95C4B" />

        <div className={[
          'flex items-center gap-2 px-3 py-2.5 rounded-xl border self-start transition-colors',
          followedUpFilter
            ? 'bg-[#10B981]/8 border-[#10B981]/30'
            : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A]',
        ].join(' ')}>
          <CalendarCheck className={`w-3.5 h-3.5 flex-shrink-0 ${followedUpFilter ? 'text-[#10B981]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`} />
          <select
            value={followedUpFilter}
            onChange={(e) => setFollowedUpFilter(e.target.value)}
            className={`bg-transparent text-sm outline-none cursor-pointer ${followedUpFilter ? 'text-[#10B981] font-semibold' : 'text-[#111111] dark:text-white'}`}
          >
            {FOLLOWED_UP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <FollowUpActivityFilters
          hasFollowUp={hasFollowUpFilter}
          onHasFollowUpChange={setHasFollowUpFilter}
          hasComment={hasCommentFilter}
          onHasCommentChange={setHasCommentFilter}
        />

        <CreatedDateRangeFilter
          from={createdFrom}
          to={createdTo}
          onChange={({ from, to }) => { setCreatedFrom(from); setCreatedTo(to) }}
        />
            </Panel>

            <div className="space-y-2">
              <FetchBar active={refreshing} />
              {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load leads. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : leads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className={`bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Landlord / Address</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Contact</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Agent</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Created</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Status</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Follow-up</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Last Follow-Up</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Followed Up By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                  {leads.map((lead) => (
                    <LeadRow
                      key={lead._id}
                      lead={lead}
                      onOpen={() => navigate(`/follow-up-manager/leads/${lead._id}`)}
                      currentUserId={user?._id}
                      onFollowUpSaved={handleFollowUpSaved}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoading && leads.length > 0 && (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              Showing {leads.length} of {total} lead{total !== 1 ? 's' : ''}
            </p>
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60 transition-colors"
              >
                {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                Load {Math.min(PAGE_SIZE, total - leads.length)} more
              </button>
            )}
          </div>
        )}
            </div>
          </div>

          <LeadsRail role="follow_up_manager" insights={insights} focus={focus} onFocus={(k) => { setFollowedUpFilter(''); setFocus(k) }} places="provinces" place={place} onPlace={setPlace} />
        </div>
      </div>
    </div>
  )
}
