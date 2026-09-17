import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  TrendingUp, Search, X, ChevronLeft, ChevronRight, Loader2,
  MapPin, Phone, User, Clock, Home, AlertCircle,
} from 'lucide-react'
import { agentsApi } from '../../services/agentsApi'
import { ListingBadge, ListingTypeFilter, LastFollowUpCommentCell, FollowUpActivityFilters } from '../../components/leads/leadShared'
import { useAuthStore } from '../../store/authStore'

const STATUS_META = {
  cold:       { label: 'Cold',       color: '#6B7280', bg: '#6B728018' },
  warm:       { label: 'Warm',       color: '#F59E0B', bg: '#F59E0B18' },
  hot:        { label: 'Hot',        color: '#EF4444', bg: '#EF444418' },
  listed:     { label: 'Listed',     color: '#8B5CF6', bg: '#8B5CF618' },
  rented_out: { label: 'Rented Out', color: '#10B981', bg: '#10B98118' },
  sold:       { label: 'Sold',       color: '#F95C4B', bg: '#F95C4B18' },
  lost:       { label: 'Lost',       color: '#9CA3AF', bg: '#9CA3AF18' },
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'cold', label: 'Cold' },
  { key: 'warm', label: 'Warm' },
  { key: 'hot', label: 'Hot' },
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
      className="group w-full text-left bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#3B82F6]/40 hover:shadow-sm transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#111111] dark:text-white truncate">
              {lead.landlordName ?? 'Unknown Landlord'}
            </h3>
            <StatusBadge status={lead.status} />
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
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#3B82F6] group-hover:gap-1.5 transition-all">
          View details <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  )
}

export default function AgencyLeadsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [status, setStatus] = useState('')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [hasFollowUpFilter, setHasFollowUpFilter] = useState(false)
  const [hasCommentFilter, setHasCommentFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const params = {
    page, limit: 20,
    ...(status ? { status } : {}),
    ...(listingTypeFilter ? { listingType: listingTypeFilter } : {}),
    ...(hasFollowUpFilter ? { hasFollowUp: 'true' } : {}),
    ...(hasCommentFilter ? { hasComment: 'true' } : {}),
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-leads', params],
    queryFn: () => agentsApi.myLeads(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

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

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#111111] dark:text-white">My Leads</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{total} lead{total !== 1 ? 's' : ''} assigned to you</p>
          </div>
        </div>

        <div className="sm:ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full sm:w-64 pl-8 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#3B82F6] transition-all"
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
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#3B82F6]/40 hover:text-[#3B82F6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ListingTypeFilter value={listingTypeFilter} onChange={handleListingTypeChange} accent="#3B82F6" />
          <FollowUpActivityFilters
            hasFollowUp={hasFollowUpFilter}
            onHasFollowUpChange={handleHasFollowUpChange}
            hasComment={hasCommentFilter}
            onHasCommentChange={handleHasCommentChange}
          />
        </div>
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
          <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-[#3B82F6]" strokeWidth={1.5} />
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
    </div>
  )
}
