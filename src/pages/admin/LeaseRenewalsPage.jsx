import { useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast, isToday } from 'date-fns'
import {
  RotateCcw, Search, X, Eye, ChevronLeft, ChevronRight,
  Loader2, Clock, CheckCircle2, AlertTriangle, CalendarClock, XCircle,
} from 'lucide-react'
import { leaseRenewalsApi } from '../../services/leaseRenewalsApi'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const STATUS_META = {
  upcoming: { label: 'Upcoming', color: '#3B82F6', bg: '#3B82F618', Icon: CalendarClock },
  due:      { label: 'Due',      color: '#F59E0B', bg: '#F59E0B18', Icon: Clock },
  renewed:  { label: 'Renewed',  color: '#10B981', bg: '#10B98118', Icon: CheckCircle2 },
  lapsed:   { label: 'Lapsed',   color: '#EF4444', bg: '#EF444418', Icon: XCircle },
}

const STATUS_TABS = [
  { key: '',         label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'due',      label: 'Due' },
  { key: 'renewed',  label: 'Renewed' },
  { key: 'lapsed',   label: 'Lapsed' },
]

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'd MMM yyyy')
}

function fmtCurrency(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n)
}

function resolveAgent(visit) {
  const a = visit?.agentId
  if (a && typeof a === 'object') return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()
  return '—'
}

function resolveLead(visit) {
  const l = visit?.leadId
  if (l && typeof l === 'object') return l.landlordName ?? l.propertyAddress ?? '—'
  return '—'
}

function resolveAddress(visit) {
  const l = visit?.leadId
  if (l && typeof l === 'object') return l.propertyAddress ?? '—'
  return '—'
}

/* ─── Status Badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.upcoming
  const Icon = meta.Icon
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: meta.bg }}>
      <Icon className="w-3 h-3" strokeWidth={2} />
      {meta.label}
    </span>
  )
}

/* ─── View / Edit Drawer ──────────────────────────────────────────────────── */

function RenewalDrawer({ renewal, onClose }) {
  const qc = useQueryClient()
  const [status, setStatus]           = useState(renewal.status)
  const [renewalDate, setRenewalDate] = useState(
    renewal.renewalDate ? renewal.renewalDate.slice(0, 10) : ''
  )
  const [markReminder, setMarkReminder] = useState(false)
  const [saving, setSaving]             = useState(false)

  const visit = renewal.agentVisitId

  async function handleSave() {
    setSaving(true)
    const payload = {}
    if (status !== renewal.status) payload.status = status
    if (renewalDate && renewalDate !== renewal.renewalDate?.slice(0, 10)) payload.renewalDate = renewalDate
    if (markReminder) payload.reminderSentAt = new Date().toISOString()

    if (Object.keys(payload).length === 0) { onClose(); return }

    try {
      await leaseRenewalsApi.update(renewal._id, payload)
      qc.invalidateQueries({ queryKey: ['lease-renewals'] })
      toast.success('Lease renewal updated')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update lease renewal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">Lease Renewal</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{resolveLead(visit)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Agent" value={resolveAgent(visit)} />
            <InfoRow label="Property" value={resolveAddress(visit)} />
            <InfoRow label="Rental Amount" value={fmtCurrency(visit?.rentalAmount)} />
            <InfoRow label="Lease Period" value={visit?.leasePeriod ? `${visit.leasePeriod} months` : '—'} />
            <InfoRow label="Reminder Sent" value={fmtDate(renewal.reminderSentAt)} />
            <InfoRow label="Visit Date" value={fmtDate(visit?.visitedAt)} />
          </div>

          {/* Renewal date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
              Renewal Date
            </label>
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
              Update Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all"
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Mark reminder */}
          {!renewal.reminderSentAt && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markReminder}
                onChange={(e) => setMarkReminder(e.target.checked)}
                className="w-4 h-4 rounded accent-[#F95C4B]"
              />
              <span className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Mark reminder as sent now</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#111111] dark:text-white">{value ?? '—'}</p>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function LeaseRenewalsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [viewing, setViewing]           = useState(null)

  const params = { page, limit: 20 }
  if (statusFilter) params.status = statusFilter

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lease-renewals', params],
    queryFn:  () => leaseRenewalsApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const renewals   = data?.renewals ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const filtered = search.trim()
    ? renewals.filter((r) => {
        const q = search.toLowerCase()
        return (
          resolveAgent(r.agentVisitId).toLowerCase().includes(q) ||
          resolveLead(r.agentVisitId).toLowerCase().includes(q) ||
          resolveAddress(r.agentVisitId).toLowerCase().includes(q)
        )
      })
    : renewals

  function handleTabChange(key) {
    setStatusFilter(key)
    setPage(1)
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#111111] dark:text-white">Lease Renewals</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{total} record{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Search */}
        <div className="sm:ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent, lead, property…"
            className="w-full sm:w-64 pl-8 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === t.key
                ? 'bg-[#F95C4B] text-white shadow-sm'
                : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Failed to load lease renewals</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <RotateCcw className="w-8 h-8 text-[#6B7280]/30" />
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">No lease renewals found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  {['Agent', 'Lead / Property', 'Rental Amount', 'Renewal Date', 'Reminder Sent', 'Status', ''].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {filtered.map((r) => {
                  const visit = r.agentVisitId
                  const isDue = r.renewalDate && (isToday(new Date(r.renewalDate)) || isPast(new Date(r.renewalDate)))
                  return (
                    <tr key={r._id} className="hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111111] dark:text-white">{resolveAgent(visit)}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{visit?.agentId?.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111111] dark:text-white truncate max-w-[200px]">{resolveLead(visit)}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[200px]">{resolveAddress(visit)}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#111111] dark:text-white">
                        {fmtCurrency(visit?.rentalAmount)}
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium ${isDue && r.status === 'upcoming' ? 'text-[#F59E0B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                        {fmtDate(r.renewalDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                        {r.reminderSentAt ? fmtDate(r.reminderSentAt) : <span className="text-[#EF4444]/70">Not sent</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewing(r)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#2A2A2A] hover:text-[#F95C4B] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] disabled:opacity-40 hover:border-[#F95C4B]/40 hover:text-[#F95C4B] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] disabled:opacity-40 hover:border-[#F95C4B]/40 hover:text-[#F95C4B] transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {viewing && <RenewalDrawer renewal={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
