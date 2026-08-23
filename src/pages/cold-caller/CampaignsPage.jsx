import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Megaphone, Search, X, AlertTriangle, Calendar, CheckCircle2, PauseCircle } from 'lucide-react'
import { campaignsApi } from '../../services/campaignsApi'

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

const STATUS_TABS = [
  { key: '',      label: 'All' },
  { key: 'true',  label: 'Active' },
  { key: 'false', label: 'Inactive' },
]

/* ─── Campaign Card ──────────────────────────────────────────────────────── */

function CampaignCard({ campaign }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{campaign.name}</p>
          {campaign.description && (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 leading-relaxed line-clamp-2">{campaign.description}</p>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
          campaign.isActive ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'
        }`}>
          {campaign.isActive ? <CheckCircle2 className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
          {campaign.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {(campaign.startDate || campaign.endDate) && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#F5F5F4] dark:border-[#202020] text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          {campaign.startDate ? format(new Date(campaign.startDate), 'd MMM yyyy') : '—'}
          {' → '}
          {campaign.endDate ? format(new Date(campaign.endDate), 'd MMM yyyy') : 'Ongoing'}
        </div>
      )}
    </div>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
        <Megaphone className="w-8 h-8 text-[#8B5CF6]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No campaigns found' : 'No campaigns yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
        {hasFilters ? 'Try a different search or filter.' : 'Campaigns your admin sets up will appear here for context on where your contacts came from.'}
      </p>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function ColdCallerCampaignsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaigns', { search: debouncedSearch, isActive: statusFilter }],
    queryFn: () =>
      campaignsApi
        .list({ search: debouncedSearch || undefined, isActive: statusFilter || undefined, limit: 100 })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const campaigns = data?.campaigns ?? []
  const total = data?.total ?? 0
  const hasFilters = Boolean(search || statusFilter)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
            <Megaphone className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
            Campaigns
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
            {isLoading ? 'Loading…' : `${total} campaign${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex gap-0.5 overflow-x-auto pb-px">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={[
                'px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/5'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load campaigns.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((c) => <CampaignCard key={c._id} campaign={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
