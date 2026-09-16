import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { isPast } from 'date-fns'
import {
  Flame, Search, X, AlertTriangle, Loader2, Users,
  ChevronDown, ChevronUp, CalendarCheck, CheckCircle2,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import {
  ListingBadge, ListingTypeFilter, LeadStatusBadge, FollowUpChip,
  LastFollowUpCommentCell, LastFollowUpByCell, isLeadFollowedUpToday, isLeadFollowedUpByMeToday,
} from '../../components/leads/leadShared'
import { useAuthStore } from '../../store/authStore'

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
          <span className="normal-case tracking-normal font-bold text-[#8B5CF6]">
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

function LeadRow({ lead, onOpen, currentUserId }) {
  const contactObj = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const agentUser  = resolveUser(lead.assignedAgent)
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
        ) : (
          <span className="text-xs text-[#F59E0B] font-semibold">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <LeadStatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3.5">
        <FollowUpChip date={lead.followUpDate} />
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
      <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
        <Flame className="w-7 h-7 text-[#8B5CF6]" strokeWidth={1.5} />
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
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [fumFilter, setFumFilter] = useState('')
  const [followedUpFilter, setFollowedUpFilter] = useState('')
  const [fumFilterCollapsed, setFumFilterCollapsed] = useState(false)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fum-leads', { search: debouncedSearch, listingType: listingTypeFilter, lastFollowUpBy: fumFilter, followedUpWithin: followedUpFilter }],
    queryFn: () => leadsApi.list({
      search:      debouncedSearch    || undefined,
      listingType: listingTypeFilter  || undefined,
      lastFollowUpBy: fumFilter       || undefined,
      followedUpWithin: followedUpFilter || undefined,
      limit: 100,
    }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const leads = data?.leads ?? []
  const total = leads.length
  const unassignedCount = leads.filter((l) => !l.assignedAgent).length
  const overdueCount = leads.filter((l) => l.followUpDate && isPast(new Date(l.followUpDate))).length
  const hasFilters = Boolean(search || listingTypeFilter || fumFilter || followedUpFilter)

  // A dedicated count, not leads.filter(...) on the loaded page — the hot-leads queue can
  // exceed the 100-lead page size, and this stat is exactly the "has anyone already
  // handled this today?" safeguard the feature exists for, so it needs to be right even
  // when the lead in question isn't part of whatever's currently sorted into view.
  const { data: followedUpTodayCount = 0 } = useQuery({
    queryKey: ['fum-leads-followed-up-today-count'],
    queryFn: () => leadsApi.list({ followedUpWithin: 'today', limit: 1 }).then((r) => r.data.data?.total ?? 0),
    staleTime: 15_000,
  })

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-[#8B5CF6]">{isLoading ? '—' : total}</p>
            <p className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mt-0.5">Hot Leads</p>
          </div>
          <div className="bg-[#10B981]/8 rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-[#10B981] flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> {isLoading ? '—' : followedUpTodayCount}
            </p>
            <p className="text-[10px] font-semibold text-[#10B981]/80 uppercase tracking-wide mt-0.5">Followed Up Today</p>
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

      {/* ── Filter by Follow-Up Manager strip ───────────────────────────── */}
      <FollowUpManagerStrip
        fumFilter={fumFilter}
        onFumChange={setFumFilter}
        collapsed={fumFilterCollapsed}
        onToggleCollapsed={() => setFumFilterCollapsed((v) => !v)}
      />

      <div className="px-5 sm:px-8 py-3 flex flex-col sm:flex-row gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative flex-1 max-w-sm">
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
        <ListingTypeFilter value={listingTypeFilter} onChange={setListingTypeFilter} accent="#8B5CF6" />

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
      </div>

      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load leads. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Landlord / Address</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Contact</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Agent</th>
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
