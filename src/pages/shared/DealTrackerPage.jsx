import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format, isToday } from 'date-fns'
import {
  Handshake, Search, X, ChevronDown, Bell, MessageSquare, MessagesSquare, PhoneCall, Sparkles, Flame, UserCheck,
  CalendarCheck, Home, KeyRound, Wallet, BadgePercent, TrendingUp, Building2, Table2, Workflow,
  GitBranch, ExternalLink, Info, Loader2, AlertTriangle, Trophy,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import axiosClient from '../../lib/axios'
import LiquidTabs from '../../components/common/LiquidTabs'
import SidePanel from '../../components/common/SidePanel'
import { LeadStatusBadge } from '../../components/leads/leadShared'
import DealFlowCanvas from '../../components/deals/DealFlowCanvas'

// Deal Tracker — every deal from the cold call that found it to the commission it earned:
// a table like the team's old deal board (money, payments, splits, sums per group), the
// same deals as workflows (each step, who did it and when, and every notification and
// message sent along the way), and the whole pipeline as one flow. Read-only; the deal
// itself is filled in on the lead (Deal section). Admin sees every company, a company's
// manager their own, an agent their own deals and a cold caller the deals that grew from the
// leads they found — with the points each deal is worth to them (the server leaves out the
// money they shouldn't see: data.viewer.hide).

/* ─── Bits ──────────────────────────────────────────────────────────────── */

const R = (v) => (v == null ? '—' : `R${Number(v).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`)
const day = (d) => (d ? format(new Date(d), 'd MMM yyyy') : '—')
const short = (d) => (d ? format(new Date(d), 'd MMM') : '—')

const PAY = {
  paid: ['Paid', '#00C875'],
  awaiting_balance: ['Awaiting balance', '#A25DDC'],
  tpn_in_progress: ['TPN in progress', '#FDAB3D'],
  not_yet_paid: ['Not yet paid', '#E2445C'],
  cancelled: ['Cancelled', '#A3A3A3'],
  not_started: ['Not started', '#C4C4C4'],
}
const DESK = { not_owing: ['Not owing', '#E2445C'], owing: ['Owing', '#FDAB3D'], deducted: ['Deducted', '#00C875'] }
const COMMISSION = { paid: ['Paid', '#00C875'], pending: ['Pending', '#FDAB3D'], invoiced: ['Invoiced', '#579BFC'], overdue: ['Overdue', '#E2445C'] }

function Pill({ value, map, empty = '' }) {
  if (!value) return <span className="block h-full min-h-[30px] bg-[#F5F5F4] dark:bg-[#202020]">{empty}</span>
  const [label, color] = map[value] ?? [String(value).replace(/_/g, ' '), '#9CA3AF']
  return <span className="flex items-center justify-center h-full min-h-[30px] px-2 text-[11px] font-semibold text-white whitespace-nowrap" style={{ backgroundColor: color }}>{label}</span>
}

function SplitPill({ split }) {
  if (!split || [split.agentPct, split.agencyPct, split.reliablePct, split.sharedAgentPct].every((v) => v == null)) {
    return <span className="block h-full min-h-[30px] bg-[#F5F5F4] dark:bg-[#202020]" title="Not recorded yet — Reliable Touch admin sets this on the lead" />
  }
  const color = split.sharedAgentPct ? '#A25DDC' : '#579BFC'
  const label = split.label || [split.agentPct != null && `${split.agentPct}`, split.agencyPct != null && `${split.agencyPct}`].filter(Boolean).join('/')
  return (
    <span className="flex items-center justify-center h-full min-h-[30px] px-2 text-[11px] font-semibold text-white whitespace-nowrap" style={{ backgroundColor: color }}
      title={[split.agentPct != null && `Agent ${split.agentPct}%`, split.sharedAgentPct != null && `${split.sharedAgent ?? 'Shared agent'} ${split.sharedAgentPct}%`, split.agencyPct != null && `Company ${split.agencyPct}%`, split.reliablePct != null && `Reliable Touch ${split.reliablePct}%`].filter(Boolean).join(' · ')}>
      {label}
    </span>
  )
}

function Chance({ p, compact }) {
  if (!p) return <span className="text-[11px] text-[#9CA3AF]">—</span>
  const color = p.probability >= 60 ? '#10B981' : p.probability >= 30 ? '#F59E0B' : '#EF4444'
  return (
    <span className="flex items-center gap-2 min-w-[120px]" title={p.reasons.join('\n')}>
      <span className="w-14 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden flex-shrink-0">
        <span className="block h-full rounded-full mac-grow-x" style={{ width: `${p.probability}%`, backgroundColor: color }} />
      </span>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{p.probability}%</span>
      {!compact && <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap">{p.label}</span>}
    </span>
  )
}

/* ─── Table ─────────────────────────────────────────────────────────────── */

const GROUPS = {
  active: { title: 'Current active deals', sub: 'Listed, negotiating, or closed with payments still to finish', color: '#579BFC' },
  completed: { title: 'Completed deals', sub: 'Closed, paid and occupied', color: '#00C875' },
  pipeline: { title: 'On the way — predicted', sub: 'With an agent or company, not closed yet', color: '#FDAB3D' },
}

const COLS = [
  { key: 'points', label: 'Your points', w: 120, mine: true },
  { key: 'agent', label: 'Agent', w: 150 },
  { key: 'date', label: 'Date', w: 92 },
  { key: 'stage', label: 'Stage', w: 120 },
  { key: 'client', label: 'Client', w: 130, pill: true },
  { key: 'landlord', label: 'Landlord', w: 130, pill: true },
  { key: 'split', label: 'Commission split', w: 130, pill: true },
  { key: 'commission', label: 'Commission paid', w: 120, pill: true },
  { key: 'desk', label: 'Desk fees', w: 110, pill: true },
  { key: 'tenant', label: 'Tenant', w: 140 },
  { key: 'coldCaller', label: 'Cold caller', w: 130 },
  { key: 'monthlyRental', label: 'Monthly rental', w: 112, money: true },
  { key: 'procurementFee', label: 'Procurement', w: 110, money: true },
  { key: 'agentShare', label: 'Agent share', w: 104, money: true },
  { key: 'sharedAgentShare', label: 'Shared agent', w: 104, money: true },
  { key: 'agencyShare', label: 'Company share', w: 110, money: true },
  { key: 'reliableShare', label: 'Reliable Touch', w: 110, money: true },
  { key: 'adminFee', label: 'Admin fee', w: 92, money: true },
  { key: 'dealFee', label: 'Deal fee', w: 88, money: true },
  { key: 'tpnFee', label: 'TPN', w: 80, money: true },
  { key: 'ownerPayout', label: 'Owner payout', w: 106, money: true },
  { key: 'agencyRevenue', label: 'Company revenue', w: 120, money: true },
  { key: 'totalRevenue', label: 'Total revenue', w: 112, money: true },
  { key: 'occupation', label: 'Occupation', w: 100 },
  { key: 'leaseEnd', label: 'Lease ends', w: 100 },
  { key: 'notified', label: 'Notifications', w: 150 },
  { key: 'messages', label: 'Messages', w: 96 },
  { key: 'chance', label: 'Will it close?', w: 190 },
]

function cell(r, key) {
  const m = r.money
  switch (key) {
    case 'agent': return (
      <span className="block truncate">
        <span className="text-[#111111] dark:text-white">{r.agent?.name ?? <i className="text-[#9CA3AF]">No agent</i>}</span>
        {r.company && <span className="block text-[10px] text-[#9CA3AF] truncate">{r.company.name}</span>}
      </span>
    )
    case 'points': return r.points ? (
      <span className="flex flex-col">
        <span className="font-bold text-[#111111] dark:text-white tabular-nums">{r.points.now} pts</span>
        {r.points.toGain > 0 && <span className="text-[10px] font-semibold text-[#10B981] whitespace-nowrap">+{r.points.toGain} if it closes</span>}
      </span>
    ) : '—'
    case 'date': return short(r.closedAt ?? r.createdAt)
    case 'stage': return <LeadStatusBadge status={r.status} />
    case 'client': return <Pill value={r.deal.clientPayment} map={PAY} />
    case 'landlord': return <Pill value={r.deal.landlordPayment} map={PAY} />
    case 'split': return <SplitPill split={r.deal.split} />
    case 'commission': return <Pill value={r.commission?.status ?? (r.deal.agentCommissionPaid ? 'paid' : r.deal.agentCommissionPaid === false ? 'pending' : null)} map={COMMISSION} />
    case 'desk': return <Pill value={r.deal.deskFee} map={DESK} />
    case 'tenant': return r.deal.tenantName ?? <span className="text-[#D4D4D8]">—</span>
    case 'coldCaller': return r.coldCaller ?? '—'
    case 'occupation': return short(r.deal.occupationDate ?? r.lease.start)
    case 'leaseEnd': return short(r.lease.end)
    case 'notified': {
      const last = [...r.touches].reverse().find((t) => t.kind === 'notification')
      return (
        <span className="flex items-center gap-1.5 min-w-0" title={last ? `${last.title} → ${last.to}` : 'Nothing sent yet'}>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#F95C4B]/12 text-[#F95C4B] flex-shrink-0"><Bell className="w-3 h-3" />{r.touchCounts.notifications}</span>
          <span className="text-[10px] text-[#9CA3AF] truncate">{last ? `${short(last.at)} · ${last.to}` : 'none'}</span>
        </span>
      )
    }
    case 'messages': return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#8B5CF6]/12 text-[#8B5CF6]"><MessageSquare className="w-3 h-3" />{r.touchCounts.comments + r.touchCounts.chats}</span>
    )
    case 'chance': return r.group === 'completed' ? <span className="text-[11px] font-semibold text-[#10B981]">Closed</span> : (
      <span className="flex flex-col gap-0.5">
        <Chance p={r.prediction} compact />
        {r.prediction && <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap">{r.prediction.expectedValue != null ? `${r.prediction.estimatedValue ? '~' : ''}${R(r.prediction.expectedValue)} · ` : ''}by {short(r.prediction.expectedCloseDate)}</span>}
      </span>
    )
    default: return m[key] != null ? R(m[key]) : <span className="text-[#D4D4D8]">—</span>
  }
}

function DealTable({ rows, groups, onOpen, cols: COLS }) {
  const [closed, setClosed] = useState(() => new Set())
  const toggle = (k) => setClosed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  return (
    <div className="space-y-6">
      {['active', 'completed', 'pipeline'].map((g, gi) => {
        const meta = GROUPS[g]
        const list = rows.filter((r) => r.group === g)
        const totals = groups.find((x) => x.key === g)?.totals ?? {}
        const sum = (k) => list.reduce((s, r) => s + (r.money[k] ?? 0), 0)
        const open = !closed.has(g)
        return (
          <section key={g} className="glass-in" style={{ '--d': `${gi * 80}ms` }}>
            <button type="button" onClick={() => toggle(g)} className="flex items-center gap-2 mb-2 text-left">
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? '' : '-rotate-90'}`} style={{ color: meta.color }} />
              <span className="text-[15px] font-bold" style={{ color: meta.color }}>{meta.title}</span>
              <span className="text-xs text-[#9CA3AF]">{list.length} · {meta.sub}</span>
            </button>
            {open && (list.length === 0 ? (
              <p className="ml-6 py-6 text-xs text-[#9CA3AF]">{g === 'completed' ? 'Deals land here once the client and landlord are both marked Paid on the lead’s Deal section.' : 'Nothing here.'}</p>
            ) : (
              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden" style={{ borderLeft: `4px solid ${meta.color}` }}>
                <div className="overflow-x-auto thin-scroll">
                  <table className="text-xs border-collapse" style={{ minWidth: 260 + COLS.reduce((s, c) => s + c.w, 0) }}>
                    <thead>
                      <tr className="bg-[#FAFAF9] dark:bg-[#111111] text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                        <th className="sticky left-0 z-10 bg-[#FAFAF9] dark:bg-[#111111] text-left font-semibold px-3 py-2.5 border-b border-r border-[#E5E7EB] dark:border-[#2A2A2A]" style={{ width: 260, minWidth: 260 }}>Deal</th>
                        {COLS.map((c) => (
                          <th key={c.key} className={`font-semibold px-2 py-2.5 border-b border-r border-[#F1EFEC] dark:border-[#232323] whitespace-nowrap ${c.money ? 'text-right' : c.pill ? 'text-center' : 'text-left'}`} style={{ width: c.w, minWidth: c.w }}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={r.id} onClick={() => onOpen(r)} className="mac-in group cursor-pointer" style={{ '--d': `${Math.min(i, 15) * 18}ms` }}>
                          <td className="sticky left-0 z-10 bg-white dark:bg-[#181818] group-hover:bg-[#FAFAF9] dark:group-hover:bg-[#1C1C1C] px-3 py-2 border-b border-r border-[#F1EFEC] dark:border-[#232323]">
                            <span className="block font-semibold text-[#111111] dark:text-white truncate uppercase tracking-tight" title={r.landlordName}>{r.landlordName}</span>
                            <span className="block text-[10px] text-[#9CA3AF] truncate">{r.address}</span>
                          </td>
                          {COLS.map((c) => (
                            <td key={c.key} className={`border-b border-r border-[#F1EFEC] dark:border-[#232323] group-hover:bg-[#FAFAF9] dark:group-hover:bg-[#1C1C1C] ${c.pill ? 'p-0' : 'px-2 py-2'} ${c.money ? 'text-right tabular-nums text-[#111111] dark:text-white' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                              {cell(r, c.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-[#FAFAF9] dark:bg-[#111111] font-semibold">
                        <td className="sticky left-0 z-10 bg-[#FAFAF9] dark:bg-[#111111] px-3 py-2.5 text-[11px] text-[#9CA3AF] border-r border-[#E5E7EB] dark:border-[#2A2A2A]">Sum · {list.length} deal{list.length === 1 ? '' : 's'}</td>
                        {COLS.map((c) => (
                          <td key={c.key} className={`px-2 py-2.5 border-r border-[#F1EFEC] dark:border-[#232323] ${c.money ? 'text-right tabular-nums text-[#111111] dark:text-white' : ''}`}>
                            {c.money ? <><span className="block">{R(sum(c.key) || totals[c.key] || 0)}</span><span className="block text-[9px] font-normal text-[#9CA3AF]">sum</span></> : null}
                            {c.key === 'notified' && <span className="text-[11px] text-[#F95C4B]">{list.reduce((s, r) => s + r.touchCounts.notifications, 0)} sent</span>}
                            {c.key === 'chance' && g !== 'completed' && <span className="text-[11px] text-[#111111] dark:text-white">{R(list.reduce((s, r) => s + (r.prediction?.weightedValue ?? 0), 0))} <span className="text-[9px] font-normal text-[#9CA3AF]">expected</span></span>}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

/* ─── Workflow ──────────────────────────────────────────────────────────── */

const STEP_ICON = {
  call: PhoneCall, lead: Sparkles, follow: MessagesSquare, hot: Flame, agent: UserCheck, appt: CalendarCheck,
  listed: Home, closed: KeyRound, lease: CalendarCheck, paid: Wallet, commission: BadgePercent,
}

// Flow-editor style: the deals on the left, the chosen deal's workflow on a canvas
function WorkflowList({ rows, onOpen }) {
  const [id, setId] = useState(null)
  const [limit, setLimit] = useState(60)
  const row = rows.find((r) => r.id === id) ?? rows[0]
  if (!rows.length) return <p className="py-16 text-center text-sm text-[#9CA3AF]">No deals match.</p>
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
      <div className="glass-in rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden">
        <p className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#F1EFEC] dark:border-[#232323]">{rows.length} deal{rows.length === 1 ? '' : 's'}</p>
        <ul className="thin-scroll max-h-[640px] overflow-y-auto divide-y divide-[#F5F5F4] dark:divide-[#202020]">
          {rows.slice(0, limit).map((r) => {
            const on = r.id === row.id
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setId(r.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${on ? 'bg-[#F95C4B]/[0.07]' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C]'}`}
                  style={{ boxShadow: on ? 'inset 3px 0 0 #F95C4B' : `inset 3px 0 0 ${GROUPS[r.group].color}40` }}>
                  <span className="flex items-center gap-2">
                    <span className={`flex-1 min-w-0 text-[13px] font-semibold truncate uppercase tracking-tight ${on ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>{r.landlordName}</span>
                    <LeadStatusBadge status={r.status} />
                  </span>
                  <span className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[11px] text-[#9CA3AF] truncate">{r.agent?.name ?? r.company?.name ?? 'No agent'}{r.area ? ` · ${r.area}` : ''}</span>
                    {r.group === 'completed' ? <span className="text-[10px] font-semibold text-[#10B981]">Closed</span> : <Chance p={r.prediction} compact />}
                  </span>
                </button>
              </li>
            )
          })}
          {rows.length > limit && (
            <li><button type="button" onClick={() => setLimit((l) => l + 60)} className="w-full py-3 text-xs font-semibold text-[#F95C4B] hover:bg-[#F95C4B]/5">Show more</button></li>
          )}
        </ul>
      </div>
      <div className="glass-in min-w-0 space-y-3" style={{ '--d': '80ms' }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-bold text-[#111111] dark:text-white uppercase tracking-tight">{row.landlordName}</h3>
          <LeadStatusBadge status={row.status} />
          <span className="text-xs text-[#9CA3AF]">{row.address}{row.company ? ` · ${row.company.name}` : ''}</span>
          <button type="button" onClick={() => onOpen(row)} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#F95C4B] hover:underline">
            Full details <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
        <DealFlowCanvas key={row.id} row={row} />
      </div>
    </div>
  )
}

/* ─── Pipeline map ──────────────────────────────────────────────────────── */

function PipelineMap({ flow, rows }) {
  const steps = flow.filter((f) => f.key !== 'lease')
  const max = Math.max(1, ...steps.map((f) => Math.max(f.count, (f.count ?? 0) + (f.predicted ?? 0))))
  const H = 260, W = 112, GAP = 40, TOP = 34
  const width = steps.length * (W + GAP)
  const y = (v) => TOP + (H - TOP) - (v / max) * (H - TOP)
  const total = Math.max(1, ...steps.map((f) => f.count))
  const notified = rows.reduce((s, r) => s + r.touchCounts.notifications, 0)
  const msgs = rows.reduce((s, r) => s + r.touchCounts.comments + r.touchCounts.chats, 0)
  return (
    <div className="glass-in rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-xs">
        <p className="text-[15px] font-bold text-[#111111] dark:text-white">How deals flow</p>
        <span className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#A1A1AA]"><span className="w-3 h-3 rounded bg-[#F95C4B]" />Reached</span>
        <span className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#A1A1AA]"><span className="w-3 h-3 rounded border-2 border-dashed border-[#F59E0B]" />Expected to get there (prediction)</span>
        <span className="ml-auto flex items-center gap-3 text-[#6B7280] dark:text-[#A1A1AA]">
          <span className="flex items-center gap-1"><Bell className="w-3.5 h-3.5 text-[#F95C4B]" />{notified.toLocaleString()} notifications sent</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-[#8B5CF6]" />{msgs.toLocaleString()} messages</span>
        </span>
      </div>
      <div className="overflow-x-auto thin-scroll">
        <svg width={width} height={H + 90} className="block">
          <defs>
            <linearGradient id="dt-band" x1="0" x2="1"><stop offset="0" stopColor="#F95C4B" stopOpacity="0.28" /><stop offset="1" stopColor="#F95C4B" stopOpacity="0.12" /></linearGradient>
          </defs>
          {steps.map((f, i) => {
            if (i === 0) return null
            const prev = steps[i - 1]
            const x0 = (i - 1) * (W + GAP) + W, x1 = i * (W + GAP)
            const a0 = y(prev.count), a1 = y(f.count)
            return <path key={`b${f.key}`} className="mac-in" style={{ '--d': `${i * 60}ms` }} d={`M${x0},${a0} C${x0 + GAP / 2},${a0} ${x1 - GAP / 2},${a1} ${x1},${a1} L${x1},${H} L${x0},${H} Z`} fill="url(#dt-band)" />
          })}
          {steps.map((f, i) => {
            const x = i * (W + GAP)
            const conv = Math.round((f.count / total) * 100)
            const Icon = STEP_ICON[f.key] ?? Sparkles
            return (
              <g key={f.key} className="mac-in" style={{ '--d': `${i * 60}ms` }}>
                {f.predicted ? <rect x={x} y={y(f.count + f.predicted)} width={W} height={y(f.count) - y(f.count + f.predicted) + Math.max(4, H - y(f.count))} rx="10" fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="6 5" /> : null}
                <rect x={x} y={y(f.count)} width={W} height={Math.max(4, H - y(f.count))} rx="10" fill="#F95C4B" />
                <text x={x + W / 2} y={y(f.count) - 8} textAnchor="middle" className="fill-[#111111] dark:fill-white" fontSize="16" fontWeight="700">{f.count}</text>
                {f.predicted ? <text x={x + W / 2} y={y(f.count + f.predicted) - 8} textAnchor="middle" fill="#F59E0B" fontSize="11" fontWeight="600">+{Math.round(f.predicted)} expected</text> : null}
                <foreignObject x={x} y={H + 10} width={W} height="70">
                  <div className="flex flex-col items-center text-center">
                    <Icon className="w-4 h-4 text-[#F95C4B]" />
                    <span className="text-[11px] font-semibold text-[#111111] dark:text-white leading-tight mt-0.5">{f.label}</span>
                    <span className="text-[10px] text-[#9CA3AF]">{conv}% of deals</span>
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-[#9CA3AF] flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Counts are deals in this view that reached each step (some skip steps — e.g. a lead handed straight to an agent). Expected numbers add up each open deal&apos;s chance of closing.</p>
    </div>
  )
}

/* ─── Deal drawer ───────────────────────────────────────────────────────── */

const TOUCH = {
  notification: { icon: Bell, color: '#F95C4B', label: 'Notification' },
  comment: { icon: MessageSquare, color: '#8B5CF6', label: 'Follow-up message' },
  chat: { icon: MessagesSquare, color: '#3B82F6', label: 'Chat message' },
}

function MoneySplit({ r, hide = [] }) {
  const m = r.money
  const parts = [
    ['Agent', m.agentShare, '#F95C4B'], [r.deal.split?.sharedAgent ?? 'Shared agent', m.sharedAgentShare, '#A25DDC'],
    ['Company', m.agencyShare, '#579BFC'], ['Reliable Touch', m.reliableShare, '#00C875'],
  ].filter(([, v]) => v)
  const total = parts.reduce((s, [, v]) => s + v, 0)
  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">Money</p>
      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
        {[['Monthly rental', m.monthlyRental, 'monthlyRental'], ['Procurement', m.procurementFee, 'procurementFee'], ['Total revenue', m.totalRevenue, 'totalRevenue'], ['Admin fee', m.adminFee, 'adminFee'], ['Deal fee', m.dealFee, 'dealFee'], ['Owner payout', m.ownerPayout, 'ownerPayout']].filter(([, , k]) => !hide.includes(k)).map(([k, v]) => (
          <div key={k}><p className="text-[#9CA3AF]">{k}</p><p className="font-bold text-[#111111] dark:text-white tabular-nums">{R(v)}</p></div>
        ))}
      </div>
      {total > 0 ? (
        <>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {parts.map(([k, v, c]) => <span key={k} className="mac-grow-x h-full" style={{ width: `${(v / total) * 100}%`, backgroundColor: c }} title={`${k} ${R(v)}`} />)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
            {parts.map(([k, v, c]) => <span key={k} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />{k} <b className="text-[#111111] dark:text-white">{R(v)}</b></span>)}
          </div>
          {r.deal.split?.label && <p className="mt-1.5 text-[10px] text-[#9CA3AF]">Split: {r.deal.split.label}</p>}
        </>
      ) : <p className="text-[11px] text-[#9CA3AF]">How the commission is shared hasn&apos;t been recorded yet — Reliable Touch admin sets it in the lead&apos;s Deal section.</p>}
    </div>
  )
}

// What this deal means for the cold caller / agent looking at it
function PointsCard({ row }) {
  const p = row.points
  if (!p) return null
  const won = row.group === 'completed' || ['rented_out', 'sold'].includes(row.status)
  return (
    <div className="mac-pop rounded-xl p-4 bg-gradient-to-r from-[#F43F5E] to-[#F95C4B] text-white flex items-center gap-4">
      <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"><Trophy className="w-5 h-5" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold">{p.now} points from this deal so far</p>
        <p className="text-sm text-white/85">
          {won ? 'Closed — the points are yours.' : row.status === 'lost' ? 'This one was lost.' : `+${p.toGain} more when it closes (${p.ifClosed} in all)${row.prediction ? ` · ${row.prediction.probability}% chance` : ''}`}
        </p>
      </div>
    </div>
  )
}

function DealDrawer({ row, onClose, leadBase, hide = [] }) {
  const navigate = useNavigate()
  const [only, setOnly] = useState('all')
  const touchesFor = (k) => row.touches.filter((t) => t.step === k && (only === 'all' || t.kind === only))
  return (
    <SidePanel onClose={onClose} icon={Handshake} title={row.landlordName} subtitle={`${row.address ?? ''}${row.company ? ` · ${row.company.name}` : ''}`} widthClass="sm:max-w-2xl">
      <div className="p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <LeadStatusBadge status={row.status} size="lg" />
          {row.group !== 'completed' && row.prediction && (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAFAF9] dark:bg-[#202020] text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-[#F95C4B]" /> <Chance p={row.prediction} />
              <span className="text-[#9CA3AF]">· by {day(row.prediction.expectedCloseDate)}{row.prediction.expectedValue != null ? ` · ${row.prediction.estimatedValue ? '~' : ''}${R(row.prediction.expectedValue)}` : ''}</span>
            </span>
          )}
          <button type="button" onClick={() => navigate(`${leadBase}?lead=${row.id}`)} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#F95C4B] hover:underline">
            Open lead <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
        {row.prediction && row.group !== 'completed' && (
          <ul className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] space-y-0.5 -mt-2">
            {row.prediction.reasons.map((x) => <li key={x}>· {x}</li>)}
          </ul>
        )}

        <PointsCard row={row} />
        {!hide.includes('split') ? <MoneySplit r={row} hide={hide} /> : row.money.monthlyRental != null && (
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Monthly rental <b className="text-[#111111] dark:text-white">{R(row.money.monthlyRental)}</b></p>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] flex-1">Workflow — every step, notification and message</p>
            {[['all', 'All'], ['notification', 'Notifications'], ['comment', 'Follow-ups'], ['chat', 'Chat']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setOnly(k)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold ${only === k ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]' : 'text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'}`}>{l}</button>
            ))}
          </div>
          <ol className="relative">
            {row.journey.map((s, i) => {
              const Icon = STEP_ICON[s.key] ?? Sparkles
              const done = s.state === 'done', current = s.state === 'current'
              const touches = touchesFor(s.key)
              const last = i === row.journey.length - 1
              return (
                <li key={s.key} className="mac-slide-in relative pl-12 pb-5" style={{ '--d': `${i * 45}ms` }}>
                  {!last && <span className={`absolute left-[18px] top-10 bottom-0 w-0.5 ${done ? 'bg-[#F95C4B]/50' : 'bg-[repeating-linear-gradient(180deg,#D4D4D8_0_4px,transparent_4px_8px)]'}`} />}
                  <span className={`absolute left-0 top-0 w-9 h-9 rounded-full flex items-center justify-center ${done ? 'bg-[#F95C4B] text-white' : current ? 'bg-[#F59E0B] text-white' : 'border-2 border-dashed border-[#D4D4D8] dark:border-[#3F3F46] text-[#9CA3AF]'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap pt-1.5">
                    <p className={`text-sm font-semibold ${done || current ? 'text-[#111111] dark:text-white' : 'text-[#9CA3AF]'}`}>{s.label}</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {s.at ? format(new Date(s.at), 'd MMM yyyy, HH:mm') : s.predictedAt ? <span className="text-[#F59E0B]">expected ~{day(s.predictedAt)}</span> : s.state === 'skipped' ? 'skipped' : done ? 'done (no date recorded)' : 'not yet'}
                      {s.by ? ` · ${s.by}` : ''}
                    </p>
                  </div>
                  {s.detail && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{s.detail}</p>}
                  {touches.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {touches.map((t) => {
                        const meta = TOUCH[t.kind]
                        return (
                          <li key={t.id} className="flex gap-2.5 p-2.5 rounded-xl bg-[#FAFAF9] dark:bg-[#141414] border border-[#F1EFEC] dark:border-[#232323]">
                            <meta.icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                            <div className="min-w-0 flex-1 text-xs">
                              <p className="text-[#6B7280] dark:text-[#A1A1AA]">
                                <b className="font-semibold" style={{ color: meta.color }}>{meta.label}</b>
                                {t.from ? <> from <b className="text-[#111111] dark:text-white">{t.from}</b></> : null}
                                {' '}to <b className="text-[#111111] dark:text-white">{t.to}</b>
                                <span className="text-[#9CA3AF]"> · {isToday(new Date(t.at)) ? format(new Date(t.at), 'HH:mm') : format(new Date(t.at), 'd MMM, HH:mm')}</span>
                                {t.kind === 'notification' && t.channels?.length ? <span className="text-[#9CA3AF]"> · {t.channels.join(', ')}{t.read ? ' · read' : ''}</span> : null}
                              </p>
                              {t.title && <p className="font-semibold text-[#111111] dark:text-white mt-0.5">{t.title}</p>}
                              <p className="text-[#6B7280] dark:text-[#A1A1AA] break-words">{t.text}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </SidePanel>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

const VIEWS = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'workflow', label: 'Workflow', icon: Workflow },
  { key: 'map', label: 'Pipeline map', icon: GitBranch },
]

export default function DealTrackerPage({ role = 'admin' }) {
  const userId = useAuthStore((s) => s.user?._id)
  const [view, setView] = useState(() => { try { return localStorage.getItem('rt-deals-view') || 'table' } catch { return 'table' } })
  const chooseView = (v) => { setView(v); try { localStorage.setItem('rt-deals-view', v) } catch { /* private mode */ } }
  const [company, setCompany] = useState('')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')
  const [open, setOpen] = useState(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['deal-tracker', userId, company],
    queryFn: () => axiosClient.get('/deals', { params: { agencyId: company || undefined } }).then((r) => r.data.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const q = search.trim().toLowerCase()
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (group === 'all' || r.group === group) && (!q || [r.landlordName, r.address, r.agent?.name, r.company?.name, r.deal.tenantName, r.coldCaller].some((x) => x?.toLowerCase().includes(q)))), [data, group, q])
  const all = data?.rows ?? []
  const sum = (list, k) => list.reduce((s, r) => s + (r.money[k] ?? 0), 0)
  const won = all.filter((r) => ['rented_out', 'sold'].includes(r.status))
  const hide = useMemo(() => data?.viewer?.hide ?? [], [data])
  const mine = Boolean(data?.points) // a cold caller or an agent: their own deals and points
  const cols = useMemo(() => COLS.filter((c) => !hide.includes(c.key) && (!c.mine || mine)), [hide, mine])
  const pts = data?.points
  const kpis = mine ? [
    { label: 'Open deals', value: pts.openDeals, color: '#579BFC' },
    { label: 'Closed (rented / sold)', value: won.length, color: '#00C875' },
    { label: 'Points from your deals', value: `${pts.earned.toLocaleString()} pts`, color: '#F43F5E' },
    { label: 'Still to win', value: `+${pts.toGain.toLocaleString()} pts`, color: '#10B981', hint: 'If every open deal closes' },
    { label: 'Likely to win', value: `~${pts.expected.toLocaleString()} pts`, color: '#FDAB3D', hint: 'Each open deal’s points × its chance of closing' },
    hide.includes('agentShare')
      ? { label: 'Points per closed deal', value: `+${pts.perClose}`, color: '#A25DDC' }
      : { label: 'Your commission share', value: R(sum(all, 'agentShare')), color: '#A25DDC' },
  ] : data ? [
    { label: 'Active deals', value: all.filter((r) => r.group === 'active').length, color: '#579BFC' },
    { label: 'Closed (rented / sold)', value: won.length, color: '#00C875' },
    { label: 'Deal revenue', value: R(sum(all, 'totalRevenue')), color: '#111111' },
    { label: 'Reliable Touch share', value: R(sum(all, 'reliableShare')), color: '#F95C4B' },
    { label: 'Agent payouts', value: R(sum(all, 'agentShare') + sum(all, 'sharedAgentShare')), color: '#A25DDC' },
    { label: 'Expected from open deals', value: R(all.reduce((s, r) => s + (r.prediction?.weightedValue ?? 0), 0)), color: '#FDAB3D', hint: 'Each open deal’s value × its chance of closing' },
  ] : []
  const leadBase = role === 'admin' ? '/admin/leads' : role === 'cold_caller' ? '/cold-caller/leads' : '/agency/leads'

  return (
    <div className="h-full overflow-y-auto thin-scroll bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      <div className="relative p-4 sm:p-6 xl:p-8 space-y-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden">
          <span className="aurora w-[520px] h-[240px] -top-24 left-[6%] bg-[#F95C4B]/18 dark:bg-[#F95C4B]/14" />
          <span className="aurora w-[420px] h-[200px] -top-16 right-[10%] bg-[#00C875]/14 dark:bg-[#00C875]/10" style={{ animationDelay: '-9s', animationDuration: '28s' }} />
          <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FAFAF9] dark:to-[#0B0B0B]" />
        </div>

        <div className="glass-in relative flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="liquid-pill relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"><Handshake className="w-6 h-6 text-white relative z-10" /></div>
            <div>
              <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Deal Tracker</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                {role === 'cold_caller' ? 'The deals that grew from the leads you found — every step, and the points each one earns you.'
                  : mine ? 'Your deals, from the first call to the commission — every step, and the points each one earns you.'
                    : 'From the first cold call to the commission — every step, payment, split and message. Read-only.'}
              </p>
            </div>
          </div>
          <div className="lg:ml-auto flex flex-wrap items-center gap-2">
            {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-[#F95C4B]" />}
            {data?.companies && (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
                <select value={company} onChange={(e) => setCompany(e.target.value)}
                  className="appearance-none pl-8 pr-8 py-2.5 rounded-xl text-sm border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#111111] dark:text-white outline-none cursor-pointer">
                  <option value="">All companies</option>
                  {data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deal, agent, tenant…"
                className="w-60 pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F95C4B]" />
              {search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </div>

        {mine && pts.openDeals > 0 && (
          <div className="glass-in relative overflow-hidden rounded-2xl px-5 py-4 bg-gradient-to-r from-[#F43F5E] to-[#F95C4B] text-white shadow-[0_18px_40px_-20px_rgba(244,63,94,0.9)]">
            <span aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Trophy className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold">Every deal that closes is <span className="mac-pop inline-block">+{pts.perClose} points</span> for you</p>
                <p className="text-sm text-white/85">{pts.openDeals} open deal{pts.openDeals === 1 ? '' : 's'} could bring you {pts.toGain.toLocaleString()} more points — about {pts.expected.toLocaleString()} at today&apos;s odds. Keep them moving.</p>
              </div>
            </div>
          </div>
        )}

        <div className="relative grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
          {isLoading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer h-[84px] rounded-2xl" />) : kpis.map((k, i) => (
            <div key={k.label} className="mac-pop rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] px-4 py-3" style={{ '--d': `${i * 50}ms` }} title={k.hint}>
              <p className="flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />{k.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#111111] dark:text-white tabular-nums tracking-tight">{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</p>
            </div>
          ))}
        </div>

        <div className="relative flex flex-wrap items-center gap-3">
          <LiquidTabs tabs={VIEWS} value={view} onChange={chooseView} />
          <div className="flex gap-1.5">
            {[['all', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['pipeline', 'On the way']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setGroup(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${group === k ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
          {data?.model && (
            <span className="ml-auto text-[11px] text-[#9CA3AF] flex items-center gap-1.5" title={Object.entries(data.model.rate).map(([k, v]) => `${k}: ${v}% close (${data.model.sample[k]} leads)`).join('\n')}>
              <TrendingUp className="w-3.5 h-3.5" /> Predictions learn from how {data.model.sample.cold?.toLocaleString()} past leads went
            </span>
          )}
        </div>

        {isError ? (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
            <AlertTriangle className="w-4 h-4" /> Couldn&apos;t load the deals. <button type="button" onClick={() => refetch()} className="ml-auto font-semibold underline">Try again</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}</div>
        ) : (
          <div key={view} className="relative">
            {view === 'table' && <DealTable rows={rows} groups={data.groups} onOpen={setOpen} cols={cols} />}
            {view === 'workflow' && <WorkflowList rows={rows} onOpen={setOpen} />}
            {view === 'map' && <PipelineMap flow={data.flow} rows={rows} />}
          </div>
        )}
      </div>

      {open && <DealDrawer row={open} onClose={() => setOpen(null)} leadBase={leadBase} hide={hide} />}
    </div>
  )
}

