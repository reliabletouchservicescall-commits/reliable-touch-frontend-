import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PhoneCall,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  PhoneOff,
  PhoneMissed,
  AlertCircle,
  Clock,
  Calendar,
  User,
  MessageSquare,
  X,
} from 'lucide-react'
import { callLogsApi } from '../../services/callLogsApi'

const OUTCOMES = [
  { value: '',                  label: 'All Outcomes' },
  { value: 'interested',        label: 'Interested' },
  { value: 'no_answer',         label: 'No Answer' },
  { value: 'callback_requested',label: 'Callback Requested' },
  { value: 'wrong_number',      label: 'Wrong Number' },
  { value: 'remove_me',         label: 'Remove Me' },
  { value: 'voicemail',         label: 'Voicemail' },
  { value: 'not_interested',    label: 'Not Interested' },
]

const OUTCOME_META = {
  interested:         { label: 'Interested',         icon: CheckCircle,  color: '#10B981', bg: '#10B981/10' },
  no_answer:          { label: 'No Answer',          icon: PhoneMissed,  color: '#F59E0B', bg: '#F59E0B/10' },
  callback_requested: { label: 'Callback',           icon: Clock,        color: '#3B82F6', bg: '#3B82F6/10' },
  wrong_number:       { label: 'Wrong Number',       icon: AlertCircle,  color: '#8B5CF6', bg: '#8B5CF6/10' },
  remove_me:          { label: 'Remove Me',          icon: XCircle,      color: '#EF4444', bg: '#EF4444/10' },
  voicemail:          { label: 'Voicemail',          icon: MessageSquare,color: '#6B7280', bg: '#6B7280/10' },
  not_interested:     { label: 'Not Interested',     icon: PhoneOff,     color: '#F97316', bg: '#F97316/10' },
}

function OutcomeBadge({ outcome }) {
  const meta = OUTCOME_META[outcome] ?? { label: outcome, icon: PhoneCall, color: '#6B7280' }
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

function formatDuration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function timeAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDateTime(iso)
}

function DeleteModal({ log, onConfirm, onCancel, loading }) {
  if (!log) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#EF4444]/10 mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-[#EF4444]" />
        </div>
        <h3 className="text-sm font-bold text-[#111111] dark:text-white text-center mb-1">Delete Call Log</h3>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center mb-6">
          Remove call to <span className="font-semibold text-[#111111] dark:text-white">{log.contactId?.name ?? 'Unknown'}</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-sm font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CallLogsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [outcome, setOutcome] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const queryKey = ['admin-call-logs', { page, outcome, search, startDate, endDate }]

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      callLogsApi.list({ page, limit: 20, outcome: outcome || undefined, startDate: startDate || undefined, endDate: endDate || undefined }),
    keepPreviousData: true,
  })

  const deleteMut = useMutation({
    mutationFn: (id) => callLogsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-call-logs'] })
      setDeleteTarget(null)
    },
  })

  const logs = data?.data?.data?.callLogs ?? []
  const total = data?.data?.data?.total ?? 0
  const totalPages = data?.data?.data?.totalPages ?? 1

  function applySearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function clearFilters() {
    setOutcome(''); setStartDate(''); setEndDate('')
    setSearch(''); setSearchInput('')
    setPage(1)
  }

  const hasActiveFilters = outcome || startDate || endDate || search

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#111111] dark:text-white font-bold text-xl tracking-tight">Call Logs</h1>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
            {total > 0 ? `${total.toLocaleString()} total call${total !== 1 ? 's' : ''}` : 'All recorded calls'}
          </p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
            hasActiveFilters
              ? 'border-[#F95C4B] bg-[#F95C4B]/5 text-[#F95C4B]'
              : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="w-4 h-4 rounded-full bg-[#F95C4B] text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {[outcome, startDate, endDate, search].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide">Filter Calls</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[10px] text-[#F95C4B] font-medium hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          {/* Search */}
          <form onSubmit={applySearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by contact name or caller…"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] outline-none text-xs text-[#111111] dark:text-white placeholder:text-[#9CA3AF]"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#F95C4B] text-white text-xs font-semibold hover:bg-[#e04d3d] transition-colors">
              Search
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Outcome */}
            <div>
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={(e) => { setOutcome(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] outline-none text-xs text-[#111111] dark:text-white"
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] outline-none text-xs text-[#111111] dark:text-white"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] outline-none text-xs text-[#111111] dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#F95C4B] border-t-transparent animate-spin" />
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Loading call logs…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center">
              <PhoneCall className="w-6 h-6 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#111111] dark:text-white">No call logs found</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Calls will appear here once made'}
              </p>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-[#F95C4B] font-medium hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                    {['Contact', 'Called By', 'Outcome', 'Duration', 'Called At', 'Last Called', 'Notes', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide text-[10px] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#2A2A2A]">
                  {logs.map((log) => (
                    <tr
                      key={log._id}
                      className="group hover:bg-[#FAFAF9] dark:hover:bg-[#202020] transition-colors"
                    >
                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#F95C4B]/10 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-[#F95C4B]">
                              {log.contactId?.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-[#111111] dark:text-white">
                              {log.contactId?.name ?? 'Unknown'}
                            </p>
                            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">
                              {log.contactId?.phone ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Called By */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
                          <span className="text-[#111111] dark:text-white font-medium">
                            {log.calledBy
                              ? `${log.calledBy.firstName} ${log.calledBy.lastName}`
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Outcome */}
                      <td className="px-4 py-3">
                        <OutcomeBadge outcome={log.outcome} />
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-[#6B7280] dark:text-[#A1A1AA]">
                          <Clock className="w-3 h-3" />
                          {formatDuration(log.durationSeconds)}
                        </div>
                      </td>

                      {/* Called At */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[#6B7280] dark:text-[#A1A1AA]">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>{formatDateTime(log.calledAt)}</span>
                        </div>
                      </td>

                      {/* Last Called (contact's lastCalledAt) */}
                      <td className="px-4 py-3 whitespace-nowrap text-[#6B7280] dark:text-[#A1A1AA]">
                        {log.contactId?.lastCalledAt ? timeAgo(log.contactId.lastCalledAt) : '—'}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {log.notes ? (
                          <p
                            className="text-[#6B7280] dark:text-[#A1A1AA] truncate"
                            title={log.notes}
                          >
                            {log.notes}
                          </p>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(log)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-[#EF4444]/8 transition-all"
                          title="Delete log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#F5F5F4] dark:divide-[#2A2A2A]">
              {logs.map((log) => (
                <div key={log._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F95C4B]/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#F95C4B]">
                          {log.contactId?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                          {log.contactId?.name ?? 'Unknown'}
                        </p>
                        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">
                          {log.contactId?.phone ?? '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <OutcomeBadge outcome={log.outcome} />
                      <button
                        onClick={() => setDeleteTarget(log)}
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-[#EF4444]/8 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#A1A1AA]">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {log.calledBy ? `${log.calledBy.firstName} ${log.calledBy.lastName}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#A1A1AA]">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{formatDuration(log.durationSeconds)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#A1A1AA] col-span-2">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{formatDateTime(log.calledAt)}</span>
                    </div>
                    {log.notes && (
                      <div className="col-span-2 text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] rounded-lg px-2.5 py-1.5">
                        {log.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                  Page {page} of {totalPages} · {total.toLocaleString()} logs
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p
                    if (totalPages <= 5) p = i + 1
                    else if (page <= 3) p = i + 1
                    else if (page >= totalPages - 2) p = totalPages - 4 + i
                    else p = page - 2 + i
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        disabled={isFetching}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          p === page
                            ? 'bg-[#F95C4B] text-white'
                            : 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isFetching}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DeleteModal
        log={deleteTarget}
        onConfirm={() => deleteMut.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  )
}
