import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Users, AlertTriangle, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function CallerCard({ caller, onViewContacts }) {
  const { callerName, totalAssigned, called, remaining, lastCalledAt, hasPendingRequest } = caller
  const exhausted = totalAssigned > 0 && remaining === 0
  const pct = totalAssigned > 0 ? Math.round((called / totalAssigned) * 100) : 0

  return (
    <div className={`bg-white dark:bg-[#181818] rounded-2xl border p-5 transition-colors ${
      exhausted ? 'border-[#EF4444]/30' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'
    }`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-[#3B82F6]">{initials(callerName)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{callerName}</p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
            {lastCalledAt
              ? `Last called ${formatDistanceToNow(new Date(lastCalledAt), { addSuffix: true })}`
              : totalAssigned > 0 ? 'No calls logged yet' : 'Nothing assigned yet'}
          </p>
        </div>
      </div>

      {(exhausted || hasPendingRequest) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {exhausted && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-[#EF4444]/10 text-[#EF4444]">
              <AlertTriangle className="w-3 h-3" /> Needs more contacts
            </span>
          )}
          {hasPendingRequest && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-[#F59E0B]/10 text-[#F59E0B]">
              <Clock className="w-3 h-3" /> Request pending
            </span>
          )}
        </div>
      )}

      <div className="mb-1.5 h-2 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: exhausted ? '#EF4444' : '#10B981' }}
        />
      </div>
      <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mb-4">{pct}% called</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
          <p className="text-base font-bold text-[#111111] dark:text-white">{totalAssigned}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Assigned</p>
        </div>
        <div className="text-center py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
          <p className="text-base font-bold text-[#10B981]">{called}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Called</p>
        </div>
        <div className="text-center py-2 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
          <p className={`text-base font-bold ${exhausted ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>{remaining}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA]">Left</p>
        </div>
      </div>

      <button
        onClick={onViewContacts}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/5 transition-colors"
      >
        View Contacts <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-[#3B82F6]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">No cold callers yet</h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
        Add a cold caller under Users to start assigning contacts.
      </p>
    </div>
  )
}

export default function CallerWorkloadPage() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['caller-workload'],
    queryFn: () => contactsApi.callerWorkload().then((r) => r.data.data.callers),
    staleTime: 15_000,
  })

  const callers = data ?? []
  // Needs-attention first — exhausted, then pending-request, then most contacts left.
  const sorted = [...callers].sort((a, b) => {
    const aExhausted = a.totalAssigned > 0 && a.remaining === 0
    const bExhausted = b.totalAssigned > 0 && b.remaining === 0
    if (aExhausted !== bExhausted) return aExhausted ? -1 : 1
    if (a.hasPendingRequest !== b.hasPendingRequest) return a.hasPendingRequest ? -1 : 1
    return b.remaining - a.remaining
  })

  const totalAssigned = callers.reduce((s, c) => s + c.totalAssigned, 0)
  const totalCalled   = callers.reduce((s, c) => s + c.called, 0)
  const exhaustedCount = callers.filter((c) => c.totalAssigned > 0 && c.remaining === 0).length

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
          Caller Workload
        </h1>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
          {isLoading ? 'Loading…' : `${callers.length} cold caller${callers.length !== 1 ? 's' : ''} · ${totalAssigned} assigned · ${totalCalled} called${exhaustedCount > 0 ? ` · ${exhaustedCount} need${exhaustedCount !== 1 ? '' : 's'} more contacts` : ''}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Failed to load caller workload.
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-28"><Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" /></div>
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((c) => (
              <CallerCard
                key={c.callerId}
                caller={c}
                onViewContacts={() => navigate(`/admin/contacts?assignedTo=${c.callerId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
