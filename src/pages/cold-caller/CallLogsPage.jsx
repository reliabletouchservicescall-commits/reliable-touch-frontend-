import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PhoneCall,
  CheckCircle,
  XCircle,
  PhoneOff,
  PhoneMissed,
  AlertCircle,
  Clock,
  Calendar,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react'
import { callLogsApi } from '../../services/callLogsApi'

const OUTCOMES = [
  { value: '',                   label: 'All Outcomes' },
  { value: 'interested',         label: 'Interested' },
  { value: 'no_answer',          label: 'No Answer' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'wrong_number',       label: 'Wrong Number' },
  { value: 'remove_me',          label: 'Remove Me' },
  { value: 'voicemail',          label: 'Voicemail' },
  { value: 'not_interested',     label: 'Not Interested' },
]

const OUTCOME_META = {
  interested:         { label: 'Interested',     icon: CheckCircle,   color: '#10B981' },
  no_answer:          { label: 'No Answer',      icon: PhoneMissed,   color: '#F59E0B' },
  callback_requested: { label: 'Callback',       icon: Clock,         color: '#3B82F6' },
  wrong_number:       { label: 'Wrong Number',   icon: AlertCircle,   color: '#8B5CF6' },
  remove_me:          { label: 'Remove Me',      icon: XCircle,       color: '#EF4444' },
  voicemail:          { label: 'Voicemail',      icon: MessageSquare, color: '#6B7280' },
  not_interested:     { label: 'Not Interested', icon: PhoneOff,      color: '#F97316' },
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
  if (!secs) return null
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

function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

export default function ColdCallerCallLogsPage() {
  const [page, setPage] = useState(1)
  const [outcome, setOutcome] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const queryKey = ['cc-call-logs', { page, outcome, startDate, endDate }]

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      callLogsApi.list({
        page,
        limit: 20,
        outcome: outcome || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    keepPreviousData: true,
  })

  const logs = data?.data?.data?.callLogs ?? []
  const total = data?.data?.data?.total ?? 0
  const totalPages = data?.data?.data?.totalPages ?? 1

  const todayCount = logs.filter((l) => isToday(l.calledAt)).length
  const interestedCount = logs.filter((l) => l.outcome === 'interested').length
  const hasActiveFilters = outcome || startDate || endDate

  function clearFilters() {
    setOutcome(''); setStartDate(''); setEndDate('')
    setPage(1)
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[#111111] dark:text-white font-bold text-xl tracking-tight">My Call Logs</h1>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Your complete call history</p>
      </div>

      {/* Quick stats */}
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Calls', value: total, color: '#3B82F6' },
            { label: 'Today', value: todayCount, color: '#10B981' },
            { label: 'Interested', value: interestedCount, color: '#F95C4B' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-4 text-center"
            >
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
              <p className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-wrap flex-1">
          {OUTCOMES.slice(1).map((o) => (
            <button
              key={o.value}
              onClick={() => { setOutcome(outcome === o.value ? '' : o.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                outcome === o.value
                  ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                  : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#3B82F6] hover:text-[#3B82F6]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
            startDate || endDate
              ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
              : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#3B82F6] hover:text-[#3B82F6]'
          }`}
        >
          <Filter className="w-3 h-3" />
          Date
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/8 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#3B82F6] outline-none text-xs text-[#111111] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wide mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#3B82F6] outline-none text-xs text-[#111111] dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Logs list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#3B82F6] border-t-transparent animate-spin" />
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Loading your call logs…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center">
              <PhoneCall className="w-6 h-6 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#111111] dark:text-white">No calls yet</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                {hasActiveFilters ? 'No calls match those filters' : 'Your call history will appear here'}
              </p>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-[#3B82F6] font-medium hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          logs.map((log) => {
            const today = isToday(log.calledAt)
            return (
              <div
                key={log._id}
                className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#3B82F6]">
                        {log.contactId?.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#111111] dark:text-white">
                          {log.contactId?.name ?? 'Unknown Contact'}
                        </p>
                        {today && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#10B981]/10 text-[#10B981] text-[9px] font-bold uppercase tracking-wide">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[#6B7280] dark:text-[#A1A1AA]">
                        {log.contactId?.phone ?? '—'}
                      </p>
                    </div>
                  </div>
                  <OutcomeBadge outcome={log.outcome} />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateTime(log.calledAt)}
                  </span>
                  {formatDuration(log.durationSeconds) && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(log.durationSeconds)}
                    </span>
                  )}
                </div>

                {log.notes && (
                  <p className="mt-2.5 text-xs text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] rounded-lg px-3 py-2">
                    {log.notes}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
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
                  className={`w-8 h-8 rounded-xl text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-[#3B82F6] text-white'
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
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
