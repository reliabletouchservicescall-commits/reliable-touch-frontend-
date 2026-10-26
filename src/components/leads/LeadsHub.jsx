import { useEffect, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import {
  CalendarClock, AlertTriangle, UserX, MessageSquareOff, CalendarX2, Sparkles, Trophy,
  MapPin, PieChart as PieIcon, Zap, X, Layers, BarChart3, Building2, ChevronDown, Search, Check,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import AnimatedNumber from '../dashboard/AnimatedNumber'

/*
 * Shared pieces of every role's Leads screen (admin, follow-up manager, company manager,
 * agent, cold caller): header, clickable status tiles, the "Quick insights" rail and the
 * active-filter banner. Numbers come from GET /leads/insights, already scoped to whoever
 * is signed in; each quick insight carries a `focus` the page passes straight to
 * GET /leads, so clicking a number shows exactly those leads.
 */

const CORAL = '#F95C4B'

export const LEAD_STATUS_TILES = [
  { key: 'cold',              label: 'Cold',        color: '#9CA3AF' },
  { key: 'warm',              label: 'Warm',        color: '#F59E0B' },
  { key: 'hot',               label: 'Hot',         color: '#EF4444' },
  { key: 'still_negotiating', label: 'Negotiating', color: '#FF8C7A' },
  { key: 'listed',            label: 'Listed',      color: '#8B5CF6' },
  { key: 'rented_out',        label: 'Rented out',  color: '#10B981' },
  { key: 'sold',              label: 'Sold',        color: CORAL },
  { key: 'lost',              label: 'Lost',        color: '#D4D4D8' },
]

export const FOCUS_LABELS = {
  due_today: 'Follow-ups due today',
  overdue: 'Overdue follow-ups',
  no_followup_date: 'No follow-up date set',
  never_followed_up: 'Never followed up',
  no_agent: 'Not with an agent yet',
  new_week: 'New this week',
  closed_month: 'Closed this month',
  warmed_week: 'Cold → Warm this week',
  hot_week: 'Turned Hot this week',
  auto_hot_week: 'Turned Hot by the system this week',
  missed_callbacks: 'Missed callbacks',
  agent_silent: 'Agent silent 48h+',
}

export function useLeadInsights(scopeParams = {}) {
  return useQuery({
    queryKey: ['lead-insights', scopeParams],
    queryFn: () => leadsApi.insights(scopeParams).then((r) => r.data.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/* ─── Role-specific quick insights ───────────────────────────────────────── */

const I = {
  due_today:         { icon: CalendarClock,    color: '#F59E0B' },
  overdue:           { icon: AlertTriangle,    color: '#DC2626' },
  no_agent:          { icon: UserX,            color: CORAL },
  never_followed_up: { icon: MessageSquareOff, color: '#111111' },
  no_followup_date:  { icon: CalendarX2,       color: '#8B5CF6' },
  new_week:          { icon: Sparkles,         color: '#0EA5E9' },
  closed_month:      { icon: Trophy,           color: '#10B981' },
}

// What matters first, per role — the order is the priority on that person's screen.
const ROLE_INSIGHTS = {
  admin: [
    ['overdue', 'Overdue follow-ups', 'overdue'],
    ['due_today', 'Follow-ups due today', 'dueToday'],
    ['no_agent', 'Hot leads awaiting an agent', 'noAgent'],
    ['never_followed_up', 'Never followed up', 'neverFollowedUp'],
    ['new_week', 'New leads this week', 'newWeek'],
    ['closed_month', 'Closed this month', 'closedMonth'],
  ],
  follow_up_manager: [
    ['never_followed_up', 'Hot leads never followed up', 'neverFollowedUp'],
    ['overdue', 'Overdue follow-ups', 'overdue'],
    ['due_today', 'Due today', 'dueToday'],
    ['no_agent', 'No agency yet', 'noAgent'],
    ['new_week', 'New hot leads this week', 'newWeek'],
  ],
  agency_manager: [
    ['no_agent', 'Not yet with an agent', 'noAgent'],
    ['overdue', 'Overdue follow-ups', 'overdue'],
    ['due_today', 'Follow-ups due today', 'dueToday'],
    ['never_followed_up', 'Never followed up', 'neverFollowedUp'],
    ['closed_month', 'Closed this month', 'closedMonth'],
    ['new_week', 'New this week', 'newWeek'],
  ],
  agent: [
    ['due_today', 'My follow-ups today', 'dueToday'],
    ['overdue', 'Overdue follow-ups', 'overdue'],
    ['no_followup_date', 'No follow-up date set', 'noFollowUpDate'],
    ['never_followed_up', 'Never followed up', 'neverFollowedUp'],
    ['closed_month', 'Closed this month', 'closedMonth'],
  ],
  cold_caller: [
    ['no_followup_date', 'Need a follow-up date', 'noFollowUpDate'],
    ['overdue', 'Overdue follow-ups', 'overdue'],
    ['due_today', 'Due today', 'dueToday'],
    ['new_week', 'Created this week', 'newWeek'],
    ['closed_month', 'Closed this month', 'closedMonth'],
  ],
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

export function LeadsHeader({ icon: Icon, title, subtitle, insights, action, extra }) {
  const d = insights
  return (
    <div className="mac-in flex flex-col lg:flex-row lg:items-center gap-4" style={{ '--d': '0ms' }}>
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-12 h-12 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-[#F95C4B]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">{title}</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">{subtitle}</p>
        </div>
      </div>
      {d && (
        <div className="flex flex-wrap gap-2 lg:ml-6">
          {[
            { label: 'new this week', value: d.newWeek, color: '#0EA5E9' },
            { label: 'overdue', value: d.overdue, color: '#DC2626' },
            { label: 'closed this month', value: d.closedMonth, color: '#10B981' },
          ].map((c, i) => (
            <span key={c.label} className="mac-pop inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A]" style={{ '--d': `${150 + i * 60}ms` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
              <b className="text-[#111111] dark:text-white tabular-nums">{(c.value ?? 0).toLocaleString()}</b>
              <span className="text-[#6B7280] dark:text-[#A1A1AA]">{c.label}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 lg:ml-auto">
        {extra}
        {action}
      </div>
    </div>
  )
}

export function PrimaryButton({ icon: Icon, children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="mac-press flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 hover:shadow-md transition-all whitespace-nowrap">
      {Icon && <Icon className="w-4 h-4" strokeWidth={2.5} />} {children}
    </button>
  )
}

/* ─── Tiles ──────────────────────────────────────────────────────────────── */

/**
 * Row of clickable count tiles. `items`: [{ key, label, count, color, icon? }] — the first
 * item is usually the "Total" tile (key ''). Clicking the active tile again clears it.
 */
export function CountTiles({ items, value, onChange }) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(118px,1fr)] gap-3 overflow-x-auto pb-1 -mx-1 px-1">
      {items.map((t, i) => {
        const active = value === t.key
        const Icon = t.icon
        return (
          <button
            key={t.key || 'all'}
            type="button"
            onClick={() => onChange(active && t.key ? '' : t.key)}
            className={`mac-in mac-lift text-left rounded-2xl border px-4 py-3 transition-colors ${
              active
                ? 'bg-[#F95C4B]/[0.06] border-[#F95C4B]/60 ring-2 ring-[#F95C4B]/15'
                : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#F95C4B]/35'
            }`}
            style={{ '--d': `${60 + i * 35}ms` }}
          >
            <div className="flex items-center gap-2">
              {Icon
                ? <span className="w-6 h-6 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-[#F95C4B]" /></span>
                : <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />}
              <span className={`text-xs font-medium truncate ${active ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{t.label}</span>
            </div>
            <p className="text-xl font-bold text-[#111111] dark:text-white mt-1 tracking-tight">
              <AnimatedNumber value={t.count ?? 0} />
            </p>
          </button>
        )
      })}
    </div>
  )
}

export function statusTileItems(stats) {
  return [
    { key: '', label: 'Total', count: stats?.total ?? 0, icon: Layers },
    ...LEAD_STATUS_TILES.map((s) => ({ ...s, count: stats?.byStatus?.[s.key] ?? 0 })),
  ]
}

/* ─── Active focus banner ────────────────────────────────────────────────── */

export function FocusBanner({ focus, onClear, count }) {
  if (!focus) return null
  return (
    <div className="mac-in flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#F95C4B]/8 border border-[#F95C4B]/25">
      <Zap className="w-4 h-4 text-[#F95C4B] flex-shrink-0" />
      <p className="text-sm text-[#111111] dark:text-white flex-1">
        Showing <b>{FOCUS_LABELS[focus] ?? focus}</b>{count != null ? <span className="text-[#6B7280] dark:text-[#A1A1AA]"> · {count.toLocaleString()} lead{count !== 1 ? 's' : ''}</span> : null}
      </p>
      <button type="button" onClick={onClear} className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:text-[#E84B3A]">
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  )
}

/* ─── Right rail ─────────────────────────────────────────────────────────── */

function RailCard({ title, icon: Icon, children, delay = 0, action }) {
  return (
    <div className="mac-in bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4" style={{ '--d': `${delay}ms` }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#F95C4B]" />
        <h3 className="text-sm font-bold text-[#111111] dark:text-white flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function QuickInsights({ role, insights, focus, onFocus }) {
  const rows = (ROLE_INSIGHTS[role] ?? ROLE_INSIGHTS.admin).map(([key, label, field]) => ({ key, label, count: insights?.[field] ?? 0, ...I[key] }))
  return (
    <RailCard title="Quick insights" icon={BarChart3} delay={120}>
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const active = focus === r.key
          const isInk = r.color === '#111111'
          return (
            <li key={r.key}>
              <button type="button" onClick={() => onFocus(active ? '' : r.key)}
                className={`mac-in w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all duration-200 ${
                  active ? 'border-[#F95C4B]/60 bg-[#F95C4B]/[0.06]' : 'border-[#F1EFEC] dark:border-[#2A2A2A] hover:border-[#F95C4B]/30 hover:translate-x-0.5'
                }`}
                style={{ '--d': `${160 + i * 45}ms` }}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isInk ? 'dark:!bg-white/10' : ''}`} style={{ backgroundColor: `${r.color}14` }}>
                  <r.icon className={`w-4 h-4 ${isInk ? 'dark:!text-white' : ''}`} style={{ color: r.color }} />
                </span>
                <span className="flex-1 text-xs font-medium text-[#111111] dark:text-white leading-snug">{r.label}</span>
                <span className={`text-sm font-bold tabular-nums ${r.count ? '' : 'text-[#D4D4D8] dark:text-[#3F3F46]'}`} style={r.count && !isInk ? { color: r.color } : undefined}>
                  <span className={r.count && isInk ? 'text-[#111111] dark:text-white' : ''}><AnimatedNumber value={r.count} /></span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-[#9CA3AF] mt-3">Tap a row to filter the list to those leads.</p>
    </RailCard>
  )
}

// `place` = the active { kind, value } pick; `onPlace(pick | null)` filters the list by it.
export function TopPlaces({ insights, mode = 'provinces', place, onPlace }) {
  const kind = mode === 'provinces' ? 'province' : 'area'
  const rows = mode === 'provinces'
    ? (insights?.topProvinces ?? []).map((p) => ({ value: p.name, name: p.name, count: p.count }))
    : (insights?.topAreas ?? []).map((a) => ({ value: String(a.areaId), name: a.name, count: a.count }))
  const max = Math.max(1, ...rows.map((r) => r.count))
  const pick = (value, label) => {
    if (!onPlace) return
    onPlace(place?.kind === kind && place?.value === value ? null : { kind, value, label })
  }
  return (
    <RailCard title={mode === 'provinces' ? 'Top provinces' : 'Top areas'} icon={MapPin} delay={200}>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9CA3AF] py-3">No areas yet</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 6).map((r, i) => {
            const active = place?.kind === kind && place?.value === r.value
            return (
              <li key={r.value} className="mac-slide-in" style={{ '--d': `${240 + i * 45}ms` }}>
                <button type="button" onClick={() => pick(r.value, r.name)} disabled={!onPlace}
                  className={`w-full text-left px-2 py-1.5 -mx-2 rounded-lg transition-all duration-200 ${active ? 'bg-[#F95C4B]/10' : onPlace ? 'hover:bg-[#FAFAF9] dark:hover:bg-[#202020]' : ''}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`truncate ${active ? 'font-semibold text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>{r.name}</span>
                    <span className="font-bold tabular-nums text-[#111111] dark:text-white">{r.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
                    <div className="mac-grow-x h-full rounded-full bg-[#F95C4B]" style={{ width: `${(r.count / max) * 100}%`, opacity: active ? 1 : 0.45 + 0.55 * (r.count / max), '--d': `${300 + i * 45}ms` }} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {mode === 'provinces' && insights?.unmappedArea > 0 && (
        <button type="button" onClick={() => pick('none', 'No province')} disabled={!onPlace}
          className={`mt-3 w-full text-left text-[10px] px-2 py-1.5 -mx-2 rounded-lg transition-colors ${
            place?.kind === 'province' && place?.value === 'none' ? 'bg-[#F59E0B]/15 text-[#B45309] dark:text-[#F59E0B] font-semibold' : 'text-[#B45309] dark:text-[#F59E0B] hover:bg-[#F59E0B]/10'
          }`}>
          {insights.unmappedArea.toLocaleString()} leads in areas without a province →
        </button>
      )}
      {onPlace && <p className="text-[10px] text-[#9CA3AF] mt-2">Tap a {kind} to filter the list.</p>}
    </RailCard>
  )
}

/* ─── Agencies (admin) ───────────────────────────────────────────────────── */

// Leads per agency under every other active filter — one grouped request (see
// GET /leads/agency-counts), shared by the filter dropdown and the rail card.
export function useAgencyCounts(params) {
  return useQuery({
    queryKey: ['lead-agency-counts', params],
    queryFn: () => leadsApi.agencyCounts(params).then((r) => r.data.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function AgencyBreakdown({ params, agency, onAgency }) {
  const { data } = useAgencyCounts(params)
  const rows = [
    ...(data?.agencies ?? []).map((a) => ({ value: String(a.agencyId), label: a.name, count: a.count, inactive: !a.isActive })),
    { value: 'none', label: 'No agency yet', count: data?.noAgency ?? 0, muted: true },
  ]
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <RailCard title="Leads by agency" icon={Building2} delay={160}
      action={<span className="text-[10px] text-[#9CA3AF] tabular-nums">{(data?.total ?? 0).toLocaleString()} total</span>}>
      <ul className="space-y-1 max-h-[300px] overflow-y-auto -mx-1 px-1">
        {rows.map((r, i) => {
          const active = agency?.value === r.value
          return (
            <li key={r.value} className="mac-slide-in" style={{ '--d': `${200 + Math.min(i, 8) * 40}ms` }}>
              <button type="button" onClick={() => onAgency(active ? null : { value: r.value, label: r.label })}
                className={`w-full text-left px-2 py-1.5 rounded-lg transition-all duration-200 ${active ? 'bg-[#F95C4B]/10' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#202020]'}`}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`truncate ${active ? 'font-semibold text-[#F95C4B]' : r.muted ? 'text-[#6B7280] dark:text-[#A1A1AA] italic' : 'text-[#111111] dark:text-white'}`}>
                    {r.label}{r.inactive && <span className="ml-1 text-[9px] text-[#9CA3AF] not-italic">(inactive)</span>}
                  </span>
                  <span className="font-bold tabular-nums text-[#111111] dark:text-white">{r.count.toLocaleString()}</span>
                </div>
                <div className="h-1.5 mt-1 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: r.muted ? '#D4D4D8' : '#F95C4B' }} />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {data?.orphaned > 0 && <p className="text-[10px] text-[#9CA3AF] mt-2">{data.orphaned} lead{data.orphaned !== 1 ? 's' : ''} point at a deleted agency.</p>}
    </RailCard>
  )
}

// Compact dropdown for the filter bar — same data as AgencyBreakdown.
export function AgencyFilter({ params, agency, onAgency }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  const { data } = useAgencyCounts(params)
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const rows = [
    { value: '', label: 'All agencies', count: data?.total ?? 0 },
    ...(data?.agencies ?? []).map((a) => ({ value: String(a.agencyId), label: a.name, count: a.count })),
    { value: 'none', label: 'No agency yet', count: data?.noAgency ?? 0 },
  ].filter((r) => !q || r.label.toLowerCase().includes(q.toLowerCase()))
  const active = Boolean(agency)
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
          active ? 'bg-[#F95C4B] border-transparent text-white shadow-sm' : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F95C4B]/40'
        }`}>
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[140px] truncate">{agency?.label ?? 'Agency'}</span>
        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${active ? 'bg-white/20' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280]'}`}>
          {(active ? (data?.agencies?.find((a) => String(a.agencyId) === agency.value)?.count ?? (agency.value === 'none' ? data?.noAgency : 0)) : data?.total ?? 0)?.toLocaleString()}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mac-in absolute z-30 mt-1.5 w-64 bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-xl overflow-hidden" style={{ '--d': '0ms' }}>
          <div className="relative p-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an agency…"
              className="w-full pl-8 pr-2 py-2 text-xs bg-[#F5F5F4] dark:bg-[#202020] rounded-lg outline-none text-[#111111] dark:text-white" />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {rows.map((r) => {
              const sel = (agency?.value ?? '') === r.value
              return (
                <li key={r.value || 'all'}>
                  <button type="button" onClick={() => { onAgency(r.value ? { value: r.value, label: r.label } : null); setOpen(false); setQ('') }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${sel ? 'bg-[#F95C4B]/8 text-[#F95C4B] font-semibold' : 'text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'}`}>
                    <span className="w-3.5">{sel && <Check className="w-3.5 h-3.5" />}</span>
                    <span className={`flex-1 truncate ${r.value === 'none' ? 'italic' : ''}`}>{r.label}</span>
                    <span className="tabular-nums text-[#6B7280] dark:text-[#A1A1AA]">{r.count.toLocaleString()}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── Active filters, loading feedback, skeletons ────────────────────────── */

/** chips: [{ key, label, value, onClear }] — one per active filter, each clearable. */
export function ActiveFilterChips({ chips, count, onClearAll }) {
  if (!chips.length) return null
  return (
    <div className="mac-in flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F95C4B]/[0.06] border border-[#F95C4B]/20" style={{ '--d': '0ms' }}>
      <Zap className="w-4 h-4 text-[#F95C4B] flex-shrink-0" />
      {chips.map((c) => (
        <span key={c.key} className="mac-pop inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs bg-white dark:bg-[#181818] border border-[#F95C4B]/30 text-[#111111] dark:text-white" style={{ '--d': '0ms' }}>
          <span className="text-[#6B7280] dark:text-[#A1A1AA]">{c.label}:</span> <b className="font-semibold">{c.value}</b>
          <button type="button" onClick={c.onClear} title={`Remove ${c.label}`} className="w-5 h-5 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F95C4B]/15 hover:text-[#F95C4B]">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {count != null && <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">· {count.toLocaleString()} lead{count !== 1 ? 's' : ''}</span>}
      <button type="button" onClick={onClearAll} className="ml-auto text-xs font-semibold text-[#F95C4B] hover:text-[#E84B3A]">Clear all</button>
    </div>
  )
}

/** Thin indeterminate bar shown while a filter change is loading — the list stays put. */
export function FetchBar({ active }) {
  return (
    <div className={`h-0.5 rounded-full overflow-hidden transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className="mac-indeterminate h-full w-1/3 rounded-full bg-[#F95C4B]" />
    </div>
  )
}

export function TableSkeleton({ rows = 8 }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
      <div className="h-11 bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-[#F5F5F4] dark:border-[#202020] last:border-0">
          <div className="flex-1 space-y-2"><div className="shimmer h-3.5 w-3/5 rounded" /><div className="shimmer h-2.5 w-2/5 rounded" /></div>
          <div className="shimmer h-3 w-24 rounded hidden sm:block" />
          <div className="shimmer h-3 w-20 rounded hidden md:block" />
          <div className="shimmer h-6 w-16 rounded-full" />
          <div className="shimmer h-3 w-20 rounded hidden lg:block" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6, className = 'grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 space-y-3">
          <div className="flex justify-between"><div className="shimmer h-4 w-1/2 rounded" /><div className="shimmer h-5 w-12 rounded-full" /></div>
          <div className="shimmer h-3 w-3/4 rounded" />
          <div className="shimmer h-5 w-20 rounded-full" />
          <div className="grid grid-cols-2 gap-2"><div className="shimmer h-3 rounded" /><div className="shimmer h-3 rounded" /></div>
          <div className="shimmer h-10 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function IntentDonut({ insights }) {
  const intent = insights?.intent ?? { sale: 0, rental: 0, none: 0 }
  const total = intent.sale + intent.rental + intent.none
  const rows = [
    { key: 'rental', label: 'For rental', count: intent.rental, color: CORAL },
    { key: 'sale', label: 'For sale', count: intent.sale, color: '#111111' },
    { key: 'none', label: 'Not set', count: intent.none, color: '#D4D4D8' },
  ]
  return (
    <RailCard title="Lead intent" icon={PieIcon} delay={280}>
      <div className="flex items-center gap-4">
        <div className="relative w-[112px] h-[112px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows.filter((r) => r.count > 0)} dataKey="count" nameKey="label" innerRadius={38} outerRadius={54} paddingAngle={2} cornerRadius={5} stroke="none" animationDuration={900}>
                {rows.filter((r) => r.count > 0).map((r) => <Cell key={r.key} fill={r.color} className={r.key === 'sale' ? 'dark:!fill-[#F5F5F4]' : ''} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [Number(v).toLocaleString(), n]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-base font-bold text-[#111111] dark:text-white"><AnimatedNumber value={total} /></p>
            <p className="text-[9px] text-[#9CA3AF]">leads</p>
          </div>
        </div>
        <ul className="flex-1 space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${r.key === 'sale' ? 'dark:!bg-[#F5F5F4]' : ''}`} style={{ backgroundColor: r.color }} />
              <span className="text-[#111111] dark:text-white">{r.label}</span>
              <span className="ml-auto font-semibold tabular-nums text-[#111111] dark:text-white">{total ? Math.round((r.count / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </RailCard>
  )
}

export function LeadsRail({ role, insights, focus, onFocus, places = 'provinces', place, onPlace, children }) {
  return (
    <aside className="space-y-4 min-w-0 xl:sticky xl:top-4 self-start">
      <QuickInsights role={role} insights={insights} focus={focus} onFocus={onFocus} />
      {children}
      <TopPlaces insights={insights} mode={places} place={place} onPlace={onPlace} />
      <IntentDonut insights={insights} />
    </aside>
  )
}

/* ─── Shared card shells for the filter bar and list ─────────────────────── */

export function Panel({ children, className = '', delay = 100 }) {
  return (
    <div className={`mac-in bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] ${className}`} style={{ '--d': `${delay}ms` }}>
      {children}
    </div>
  )
}
