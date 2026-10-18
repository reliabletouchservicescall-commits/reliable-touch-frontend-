import { format, isPast, isToday } from 'date-fns'
import {
  Clock, AlertTriangle, CheckCircle2, FileText, CalendarClock, ChevronRight, DollarSign, RotateCcw,
} from 'lucide-react'

// Recent commissions + lease renewals, side by side — moved as-is from the old admin
// dashboard so the new command-centre layout keeps it.

/* ─── Commission Status Badge ─────────────────────────────────────────────── */

const COMM_STATUS = {
  pending:  { label: 'Pending',  color: '#F59E0B', bg: '#F59E0B18', Icon: Clock },
  invoiced: { label: 'Invoiced', color: '#3B82F6', bg: '#3B82F618', Icon: FileText },
  paid:     { label: 'Paid',     color: '#10B981', bg: '#10B98118', Icon: CheckCircle2 },
  overdue:  { label: 'Overdue',  color: '#EF4444', bg: '#EF444418', Icon: AlertTriangle },
}

const RENEWAL_STATUS = {
  upcoming: { label: 'Upcoming', color: '#3B82F6', bg: '#3B82F618', Icon: CalendarClock },
  due:      { label: 'Due',      color: '#F59E0B', bg: '#F59E0B18', Icon: Clock },
  renewed:  { label: 'Renewed',  color: '#10B981', bg: '#10B98118', Icon: CheckCircle2 },
  lapsed:   { label: 'Lapsed',   color: '#EF4444', bg: '#EF444418', Icon: AlertTriangle },
}

function Badge({ meta }) {
  const Icon = meta.Icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: meta.bg }}>
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {meta.label}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'd MMM yyyy')
}

function fmtCurrency(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
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

/* ─── Finance Panel (Commissions + Renewals side by side) ─────────────────── */

export default function FinancePanel({ commissions, renewals, loading, navigate }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
            <div className="h-4 w-32 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-4" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-10 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-2" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Commissions */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Commissions</span>
          </div>
          <button
            onClick={() => navigate('/admin/commissions')}
            className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {commissions.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-8">No commissions yet</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {commissions.map((c) => {
              const visit = c.agentVisitId
              const meta = COMM_STATUS[c.status] ?? COMM_STATUS.pending
              const overdue = c.status !== 'paid' && isPast(new Date(c.dueDate))
              return (
                <div key={c._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {resolveAgent(visit)}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
                      {resolveLead(visit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold text-[#111111] dark:text-white">{fmtCurrency(c.amount)}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge meta={meta} />
                      <span className={`text-[10px] font-medium ${overdue ? 'text-[#EF4444]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                        Due {fmtDate(c.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lease Renewals */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#EC4899]/10 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-[#EC4899]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Lease Renewals</span>
          </div>
          <button
            onClick={() => navigate('/admin/lease-renewals')}
            className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {renewals.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-8">No lease renewals yet</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {renewals.map((r) => {
              const visit = r.agentVisitId
              const meta = RENEWAL_STATUS[r.status] ?? RENEWAL_STATUS.upcoming
              const isDue = r.renewalDate && (isToday(new Date(r.renewalDate)) || isPast(new Date(r.renewalDate)))
              return (
                <div key={r._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {resolveAgent(visit)}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
                      {resolveLead(visit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge meta={meta} />
                    <span className={`text-[10px] font-medium ${isDue && r.status !== 'renewed' ? 'text-[#F59E0B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                      {fmtDate(r.renewalDate)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
