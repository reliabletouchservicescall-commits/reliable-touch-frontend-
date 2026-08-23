import { useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast } from 'date-fns'
import {
  DollarSign, Search, X, Eye, ChevronLeft, ChevronRight,
  Loader2, Clock, CheckCircle2, AlertTriangle, FileText, CreditCard,
} from 'lucide-react'
import { commissionsApi } from '../../services/commissionsApi'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const STATUS_META = {
  pending:  { label: 'Pending',  color: '#F59E0B', bg: '#F59E0B18', Icon: Clock },
  invoiced: { label: 'Invoiced', color: '#3B82F6', bg: '#3B82F618', Icon: FileText },
  paid:     { label: 'Paid',     color: '#10B981', bg: '#10B98118', Icon: CheckCircle2 },
  overdue:  { label: 'Overdue',  color: '#EF4444', bg: '#EF444418', Icon: AlertTriangle },
}

const STATUS_TABS = [
  { key: '',         label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid',     label: 'Paid' },
  { key: 'overdue',  label: 'Overdue' },
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

function resolveAgency(raw) {
  if (raw && typeof raw === 'object') return raw.name ?? '—'
  return '—'
}

/* ─── Status Badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending
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

function CommissionDrawer({ commission, onClose }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(commission.status)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)

  const visit = commission.agentVisitId

  async function handleSave() {
    if (status === commission.status) { onClose(); return }
    setSaving(true)
    try {
      await commissionsApi.update(commission._id, { status })
      qc.invalidateQueries({ queryKey: ['commissions'] })
      toast.success('Commission updated')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update commission')
    } finally {
      setSaving(false)
    }
  }

  async function handlePaynow() {
    setPaying(true)
    try {
      const res = await commissionsApi.initiatePaynow(commission._id)
      qc.invalidateQueries({ queryKey: ['commissions'] })
      toast.success(res.data?.message ?? 'Paynow payment initiated')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to initiate payment')
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">Commission Details</h2>
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
            <InfoRow label="Amount" value={fmtCurrency(commission.amount)} />
            <InfoRow label="Due Date" value={fmtDate(commission.dueDate)} highlight={!commission.paidAt && isPast(new Date(commission.dueDate))} />
            <InfoRow label="Agency" value={resolveAgency(commission.agencyId)} />
            <InfoRow label="Paid At" value={fmtDate(commission.paidAt)} />
            <InfoRow label="Agent" value={resolveAgent(visit)} />
            <InfoRow label="Rental Amount" value={fmtCurrency(visit?.rentalAmount)} />
          </div>

          {commission.paynowReference && (
            <InfoRow label="Paynow Reference" value={commission.paynowReference} />
          )}

          {/* Status update */}
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

          {/* Paynow */}
          {commission.status !== 'paid' && (
            <div className="pt-1">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
                Payment
              </label>
              <button
                onClick={handlePaynow}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] disabled:opacity-60 transition-all"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {paying ? 'Processing…' : 'Initiate Paynow Payment'}
              </button>
            </div>
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

function InfoRow({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-[#EF4444]' : 'text-[#111111] dark:text-white'}`}>{value ?? '—'}</p>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function CommissionsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [viewing, setViewing]           = useState(null)

  const params = { page, limit: 20 }
  if (statusFilter) params.status = statusFilter

  const { data, isLoading, isError } = useQuery({
    queryKey: ['commissions', params],
    queryFn:  () => commissionsApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const commissions  = data?.commissions ?? []
  const total        = data?.total ?? 0
  const totalPages   = data?.totalPages ?? 1

  const filtered = search.trim()
    ? commissions.filter((c) => {
        const q = search.toLowerCase()
        const agent = resolveAgent(c.agentVisitId).toLowerCase()
        const lead  = resolveLead(c.agentVisitId).toLowerCase()
        const agency = resolveAgency(c.agencyId).toLowerCase()
        return agent.includes(q) || lead.includes(q) || agency.includes(q)
      })
    : commissions

  function handleTabChange(key) {
    setStatusFilter(key)
    setPage(1)
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#111111] dark:text-white">Commissions</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{total} record{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Search */}
        <div className="sm:ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent, lead, agency…"
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
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Failed to load commissions</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <DollarSign className="w-8 h-8 text-[#6B7280]/30" />
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">No commissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  {['Agent', 'Lead / Property', 'Agency', 'Amount', 'Due Date', 'Status', ''].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {filtered.map((c) => {
                  const visit = c.agentVisitId
                  const overdue = !c.paidAt && c.status !== 'paid' && isPast(new Date(c.dueDate))
                  return (
                    <tr key={c._id} className="hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111111] dark:text-white">{resolveAgent(visit)}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{visit?.agentId?.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111111] dark:text-white truncate max-w-[180px]">{resolveLead(visit)}</p>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] dark:text-[#A1A1AA]">
                        {resolveAgency(c.agencyId)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#111111] dark:text-white">
                        {fmtCurrency(c.amount)}
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium ${overdue ? 'text-[#EF4444]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                        {fmtDate(c.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewing(c)}
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
      {viewing && <CommissionDrawer commission={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
