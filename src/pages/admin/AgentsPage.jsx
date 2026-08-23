import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Users, TrendingUp, Home, CheckCircle2, Clock, Eye,
  ChevronDown, Search, MapPin, Calendar, DollarSign,
  ArrowUpRight, Filter, RefreshCw,
} from 'lucide-react'
import { usersApi } from '../../services/usersApi'
import { agentsApi } from '../../services/agentsApi'

/* ── Constants ─────────────────────────────────────────────────────────── */
const OUTCOME_META = {
  appointment_completed:   { label: 'Appointment Completed', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300' },
  listing_signed:          { label: 'Listing Signed',        color: '#10B981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
  still_negotiating:       { label: 'Negotiating',           color: '#F59E0B', bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-300' },
  follow_up_required:      { label: 'Follow-up Required',    color: '#8B5CF6', bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300' },
  property_still_available:{ label: 'Still Available',       color: '#6B7280', bg: 'bg-gray-50 dark:bg-gray-800',       text: 'text-gray-600 dark:text-gray-400' },
  rented_out:              { label: 'Rented Out',            color: '#F95C4B', bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-300' },
  sold:                    { label: 'Sold',                  color: '#059669', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
}

const DISPOSITION_LABELS = {
  rented_by_me:              'Rented by Me',
  rented_by_another_agent:   'Rented by Another Agent',
  rented_by_another_agency:  'Rented by Another Agency',
  owner_rented_privately:    'Owner Rented Privately',
  listing_cancelled:         'Listing Cancelled',
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function initials(agent) {
  return `${agent.firstName?.[0] ?? ''}${agent.lastName?.[0] ?? ''}`.toUpperCase()
}

function formatCurrency(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(amount)
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl p-5 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent + '18' }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-[#111111] dark:text-white text-2xl font-bold leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function AgentCard({ agent, visits, onClick, isSelected }) {
  const agentVisits = visits.filter(v => {
    const vid = v.agentId?._id ?? v.agentId
    return vid?.toString() === agent._id?.toString()
  })

  const totalVisits = agentVisits.length
  const rented = agentVisits.filter(v => v.outcome === 'rented_out').length
  const sold   = agentVisits.filter(v => v.outcome === 'sold').length
  const signed = agentVisits.filter(v => v.outcome === 'listing_signed').length

  const lastVisit = agentVisits.length > 0
    ? agentVisits.reduce((a, b) => new Date(a.visitedAt) > new Date(b.visitedAt) ? a : b)
    : null

  const totalRevenue = agentVisits
    .filter(v => v.rentalAmount != null)
    .reduce((sum, v) => sum + (v.rentalAmount ?? 0), 0)

  const successRate = totalVisits > 0
    ? Math.round(((rented + sold) / totalVisits) * 100)
    : 0

  return (
    <button
      onClick={() => onClick(isSelected ? null : agent._id)}
      className={[
        'w-full text-left bg-white dark:bg-[#181818] border rounded-xl p-5 transition-all',
        isSelected
          ? 'border-[#F95C4B] ring-1 ring-[#F95C4B]/30 shadow-md'
          : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#F95C4B]/50 hover:shadow-sm',
      ].join(' ')}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-[#F95C4B] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{initials(agent)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#111111] dark:text-white font-semibold text-sm truncate">
            {agent.firstName} {agent.lastName}
          </p>
          <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs mt-0.5 truncate">{agent.email}</p>
          {agent.phone && (
            <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">{agent.phone}</p>
          )}
        </div>
        <span className={[
          'shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
          agent.isActive
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
        ].join(' ')}>
          {agent.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-[#FAFAF9] dark:bg-[#0B0B0B] rounded-lg">
          <p className="text-[#111111] dark:text-white font-bold text-lg">{totalVisits}</p>
          <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">Visits</p>
        </div>
        <div className="text-center p-2 bg-[#FAFAF9] dark:bg-[#0B0B0B] rounded-lg">
          <p className="text-[#F95C4B] font-bold text-lg">{rented + sold}</p>
          <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">Deals</p>
        </div>
        <div className="text-center p-2 bg-[#FAFAF9] dark:bg-[#0B0B0B] rounded-lg">
          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">{successRate}%</p>
          <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">Rate</p>
        </div>
      </div>

      {totalRevenue > 0 && (
        <div className="flex items-center gap-1.5 mb-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <DollarSign size={13} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-700 dark:text-emerald-300 text-xs font-medium">
            {formatCurrency(totalRevenue)} total rent
          </span>
        </div>
      )}

      {signed > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          <CheckCircle2 size={13} className="text-blue-500" />
          <span className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">{signed} listing{signed !== 1 ? 's' : ''} signed</span>
        </div>
      )}

      {lastVisit && (
        <div className="flex items-center gap-1.5 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
          <Clock size={12} className="text-[#6B7280] dark:text-[#A1A1AA]" />
          <span className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">
            Last visit {formatDistanceToNow(new Date(lastVisit.visitedAt), { addSuffix: true })}
          </span>
        </div>
      )}

      {totalVisits === 0 && (
        <div className="flex items-center gap-1.5 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
          <Clock size={12} className="text-[#6B7280] dark:text-[#A1A1AA]" />
          <span className="text-[#6B7280] dark:text-[#A1A1AA] text-xs italic">No visits logged yet</span>
        </div>
      )}

      {isSelected && (
        <div className="mt-3 pt-2 flex items-center gap-1 text-[#F95C4B] text-xs font-medium">
          <Filter size={11} />
          <span>Filtering visits by this agent</span>
        </div>
      )}
    </button>
  )
}

function OutcomeBadge({ outcome }) {
  const meta = OUTCOME_META[outcome] ?? { label: outcome, bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  )
}

function VisitRow({ visit }) {
  const [expanded, setExpanded] = useState(false)

  const lead = visit.leadId ?? {}
  const agent = visit.agentId ?? {}
  const isFinancial = visit.rentalAmount != null || visit.commissionAmount != null

  return (
    <>
      <tr className="hover:bg-[#FAFAF9] dark:hover:bg-[#111111] transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F95C4B]/15 flex items-center justify-center shrink-0">
              <span className="text-[#F95C4B] text-xs font-bold">
                {`${agent.firstName?.[0] ?? ''}${agent.lastName?.[0] ?? ''}`.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-[#111111] dark:text-white text-sm font-medium">
                {agent.firstName} {agent.lastName}
              </p>
              <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">{agent.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div>
            <p className="text-[#111111] dark:text-white text-sm font-medium truncate max-w-[200px]">
              {lead.landlordName ?? '—'}
            </p>
            {lead.propertyAddress && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={11} className="text-[#6B7280] dark:text-[#A1A1AA] shrink-0" />
                <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs truncate max-w-[180px]">
                  {lead.propertyAddress}
                </p>
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <OutcomeBadge outcome={visit.outcome} />
          {visit.disposition && (
            <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs mt-0.5">
              {DISPOSITION_LABELS[visit.disposition] ?? visit.disposition}
            </p>
          )}
        </td>
        <td className="px-4 py-3">
          {isFinancial ? (
            <div>
              {visit.rentalAmount != null && (
                <p className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  {formatCurrency(visit.rentalAmount)}/mo
                </p>
              )}
              {visit.commissionAmount != null && (
                <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">
                  Comm: {formatCurrency(visit.commissionAmount)}
                </p>
              )}
            </div>
          ) : (
            <span className="text-[#6B7280] dark:text-[#A1A1AA] text-sm">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Calendar size={12} className="text-[#6B7280] dark:text-[#A1A1AA]" />
            <span className="text-[#6B7280] dark:text-[#A1A1AA] text-sm">
              {format(new Date(visit.visitedAt), 'dd MMM yyyy')}
            </span>
          </div>
          <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs ml-4">
            {formatDistanceToNow(new Date(visit.visitedAt), { addSuffix: true })}
          </p>
        </td>
        <td className="px-4 py-3">
          {visit.notes && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[#F95C4B] text-xs font-medium hover:opacity-75 transition-opacity"
            >
              <Eye size={12} />
              Notes
              <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </td>
      </tr>
      {expanded && visit.notes && (
        <tr className="bg-[#FAFAF9] dark:bg-[#111111]">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <div className="ml-9 p-3 bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg">
              <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-1">Visit Notes</p>
              <p className="text-[#111111] dark:text-white text-sm leading-relaxed">{visit.notes}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Main Page ─────────────────────────────────────────────────────────── */
export default function AgentsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState(null)
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['users', 'agencies'],
    queryFn: () => usersApi.list({ role: 'agency', limit: 50 }).then(r => r.data?.data),
    staleTime: 60_000,
  })

  const { data: visitsData, isLoading: visitsLoading, refetch: refetchVisits } = useQuery({
    queryKey: ['agent-visits'],
    queryFn: () => agentsApi.listVisits({ limit: 100 }).then(r => r.data?.data),
    staleTime: 30_000,
  })

  const agents = agentsData?.users ?? []
  const allVisits = visitsData?.visits ?? []

  /* ── Summary stats ─────────────────────────────────────────────────── */
  const totalDeals   = allVisits.filter(v => v.outcome === 'rented_out' || v.outcome === 'sold').length
  const totalSigned  = allVisits.filter(v => v.outcome === 'listing_signed').length
  const totalRevenue = allVisits.filter(v => v.rentalAmount != null).reduce((s, v) => s + (v.rentalAmount ?? 0), 0)
  const avgDealsPerAgent = agents.length > 0 ? (totalDeals / agents.length).toFixed(1) : '0'

  /* ── Filtered visits ──────────────────────────────────────────────── */
  const filteredVisits = useMemo(() => {
    let v = allVisits
    if (selectedAgentId) {
      v = v.filter(visit => {
        const vid = visit.agentId?._id ?? visit.agentId
        return vid?.toString() === selectedAgentId?.toString()
      })
    }
    if (outcomeFilter) v = v.filter(visit => visit.outcome === outcomeFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      v = v.filter(visit => {
        const lead = visit.leadId ?? {}
        const agent = visit.agentId ?? {}
        return (
          lead.landlordName?.toLowerCase().includes(s) ||
          lead.propertyAddress?.toLowerCase().includes(s) ||
          `${agent.firstName} ${agent.lastName}`.toLowerCase().includes(s)
        )
      })
    }
    return v
  }, [allVisits, selectedAgentId, outcomeFilter, search])

  const isLoading = agentsLoading || visitsLoading

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#111111] dark:text-white text-2xl font-bold">Agents</h1>
          <p className="text-[#6B7280] dark:text-[#A1A1AA] text-sm mt-0.5">
            Performance overview and visit history for your field team
          </p>
        </div>
        <button
          onClick={() => refetchVisits()}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[#6B7280] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg bg-white dark:bg-[#181818] hover:border-[#F95C4B] transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Total Agents"   value={agents.length}             accent="#3B82F6" />
        <StatCard icon={CheckCircle2} label="Deals Closed"  value={totalDeals}  sub={`${avgDealsPerAgent} avg/agent`} accent="#F95C4B" />
        <StatCard icon={ArrowUpRight} label="Listings Signed" value={totalSigned}             accent="#10B981" />
        <StatCard icon={DollarSign}  label="Total Rent Placed" value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '—'} accent="#8B5CF6" />
      </div>

      {/* Agent cards grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#111111] dark:text-white font-semibold text-sm">
            Field Agents
            {selectedAgentId && (
              <span className="ml-2 text-[#F95C4B] text-xs font-normal">• 1 agent selected</span>
            )}
          </h2>
          {selectedAgentId && (
            <button
              onClick={() => setSelectedAgentId(null)}
              className="text-xs text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
                  <div className="flex-1">
                    <div className="h-4 bg-[#E5E7EB] dark:bg-[#2A2A2A] rounded w-3/4 mb-2" />
                    <div className="h-3 bg-[#E5E7EB] dark:bg-[#2A2A2A] rounded w-1/2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-14 bg-[#E5E7EB] dark:bg-[#2A2A2A] rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl p-12 text-center">
            <Users size={32} className="mx-auto text-[#6B7280] dark:text-[#A1A1AA] mb-3" />
            <p className="text-[#111111] dark:text-white font-medium">No agents found</p>
            <p className="text-[#6B7280] dark:text-[#A1A1AA] text-sm mt-1">Add agent users to see performance cards here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent._id}
                agent={agent}
                visits={allVisits}
                onClick={setSelectedAgentId}
                isSelected={selectedAgentId === agent._id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Visits log */}
      <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div>
            <h2 className="text-[#111111] dark:text-white font-semibold text-sm">Visit Log</h2>
            <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs mt-0.5">
              {filteredVisits.length} visit{filteredVisits.length !== 1 ? 's' : ''}
              {selectedAgentId || outcomeFilter ? ' (filtered)' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search landlord or agent..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg bg-[#FAFAF9] dark:bg-[#0B0B0B] text-[#111111] dark:text-white placeholder-[#6B7280] dark:placeholder-[#A1A1AA] focus:outline-none focus:border-[#F95C4B] transition-colors"
              />
            </div>

            {/* Outcome filter */}
            <div className="relative">
              <select
                value={outcomeFilter}
                onChange={e => setOutcomeFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg bg-[#FAFAF9] dark:bg-[#0B0B0B] text-[#111111] dark:text-white focus:outline-none focus:border-[#F95C4B] transition-colors cursor-pointer"
              >
                <option value="">All Outcomes</option>
                {Object.entries(OUTCOME_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        {visitsLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-[#E5E7EB] dark:bg-[#2A2A2A] rounded animate-pulse" />
            ))}
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="p-12 text-center">
            <Home size={32} className="mx-auto text-[#6B7280] dark:text-[#A1A1AA] mb-3" />
            <p className="text-[#111111] dark:text-white font-medium">
              {outcomeFilter || selectedAgentId || search ? 'No visits match filters' : 'No visits logged yet'}
            </p>
            <p className="text-[#6B7280] dark:text-[#A1A1AA] text-sm mt-1">
              {outcomeFilter || selectedAgentId || search
                ? 'Try adjusting your filters above'
                : 'Visits will appear here once agents log their property visits'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Agent</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Property</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Outcome</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Financials</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Visit Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {filteredVisits.map(visit => (
                  <VisitRow key={visit._id} visit={visit} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer stats bar */}
        {filteredVisits.length > 0 && (
          <div className="px-5 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#0B0B0B] flex flex-wrap gap-4">
            {Object.entries(
              filteredVisits.reduce((acc, v) => {
                acc[v.outcome] = (acc[v.outcome] ?? 0) + 1
                return acc
              }, {})
            ).map(([outcome, count]) => {
              const meta = OUTCOME_META[outcome]
              return (
                <div key={outcome} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: meta?.color ?? '#6B7280' }}
                  />
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">
                    {meta?.label ?? outcome}: <strong className="text-[#111111] dark:text-white">{count}</strong>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
