import { useState } from 'react'
import { Plus, Search, X, SlidersHorizontal } from 'lucide-react'

// The top of an agent's My leads: one header with the numbers that matter, the three ways to
// split the book (everything / from Reliable Touch / their own), status tabs and quick views —
// each count opens exactly those leads. Replaces the stacked tiles, insight strip and smart
// views the company screen uses.

const STATUS_TABS = [
  { key: '', label: 'All', color: 'currentColor' },
  { key: 'hot', label: 'Hot', color: '#EF4444' },
  { key: 'warm', label: 'Warm', color: '#F59E0B' },
  { key: 'cold', label: 'Cold', color: '#3B82F6' },
  { key: 'still_negotiating', label: 'Negotiating', color: '#F97316' },
  { key: 'listed', label: 'Listed', color: '#8B5CF6' },
  { key: 'won', label: 'Rented / sold', color: '#10B981' },
  { key: 'lost', label: 'Lost', color: '#9CA3AF' },
]
const QUICK = [
  { key: 'promise_due', label: 'Promise due', hint: 'Reliable Touch landlords who haven’t heard from you in 48 hours' },
  { key: 'callback_now', label: 'Call back now', hint: 'Follow-up date is today or already passed' },
  { key: 'no_followup_date', label: 'No callback date', hint: 'Open leads without a follow-up date' },
  { key: 'never_followed_up', label: 'Never followed up', hint: 'No comment or update yet' },
  { key: 'closed_month', label: 'Closed this month', hint: 'Listed, rented or sold this month' },
]

export default function AgentLeadsTop({ counts, status, onStatus, source, onSource, focus, onFocus, search, onSearch, onAdd, managerName, moreFilters }) {
  const [more, setMore] = useState(false)
  const c = counts
  const statusCount = (k) => (k === '' ? c?.total : k === 'won' ? (c?.status?.rented_out ?? 0) + (c?.status?.sold ?? 0) : c?.status?.[k] ?? 0)
  const sources = [
    { key: '', badge: '••', title: 'All my leads', sub: 'Everything on your desk', n: c?.total, tone: 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]' },
    { key: 'reliable_touch', badge: 'RT', title: 'From Reliable Touch', sub: 'Sent to you · update every 48h', n: c?.sources?.reliable_touch, tone: 'bg-[#F95C4B]/12 text-[#F95C4B]' },
    { key: 'agency_self_sourced', badge: 'ME', title: 'My own', sub: `From your calls · only you${managerName ? ` and ${managerName}` : ' and your manager'} see these`, n: c?.sources?.own, tone: 'bg-[#10B981]/12 text-[#059669] dark:text-[#34D399]' },
  ]
  const pills = [
    c?.newWeek ? [`${c.newWeek} new this week`, 'bg-[#3B82F6]/10 text-[#2563EB] dark:text-[#60A5FA]', () => onFocus('new_week')] : null,
    c?.callbackNow ? [`${c.callbackNow} waiting on a call back`, 'bg-[#EF4444]/10 text-[#DC2626] dark:text-[#F87171]', () => onFocus('callback_now')] : null,
    c?.closedMonth ? [`${c.closedMonth} closed this month`, 'bg-[#10B981]/10 text-[#059669] dark:text-[#34D399]', () => onFocus('closed_month')] : null,
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#111111] dark:text-white">
            My leads <span className="text-xl font-semibold text-[#9CA3AF] tabular-nums">{c?.total ?? ''}</span>
          </h1>
          {pills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pills.map(([l, cls, go]) => <button key={l} type="button" onClick={go} className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${cls}`}>{l}</button>)}
            </div>
          )}
        </div>
        <button type="button" onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#F95C4B] px-5 py-3 text-sm font-semibold text-white shadow-btn transition-all hover:bg-[#E84B3A] active:scale-[0.98]">
          <Plus className="h-4 w-4" /> Add my own lead
        </button>
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {sources.map((s) => {
          const on = source === s.key
          return (
            <button key={s.key || 'all'} type="button" onClick={() => onSource(s.key)}
              className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${on ? 'border-[#F95C4B] bg-[#F95C4B]/[0.06] ring-1 ring-[#F95C4B]/30' : 'border-[#E5E7EB] bg-white hover:border-[#F95C4B]/40 dark:border-[#2A2A2A] dark:bg-[#181818]'}`}>
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl text-[11px] font-bold ${s.tone}`}>{s.badge}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#111111] dark:text-white">{s.title}</span>
                <span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{s.sub}</span>
              </span>
              <span className="text-2xl font-bold tabular-nums text-[#111111] dark:text-white">{s.n ?? '–'}</span>
            </button>
          )
        })}
      </div>

      {/* Status tabs */}
      <div className="thin-scroll -mx-1 flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-1 dark:border-[#2A2A2A]">
        {STATUS_TABS.map((t) => {
          const on = status === t.key
          return (
            <button key={t.key || 'all'} type="button" onClick={() => onStatus(t.key)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors ${on ? 'border-[#F95C4B] text-[#111111] dark:text-white' : 'border-transparent text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white'}`}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.key ? t.color : (on ? 'rgb(var(--brand-rgb))' : '#9CA3AF') }} />
              {t.label}
              <span className={`tabular-nums ${on ? 'text-[#F95C4B]' : 'text-[#9CA3AF]'}`}>{statusCount(t.key) ?? ''}</span>
            </button>
          )
        })}
      </div>

      {/* Quick views + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Quick views</span>
          {QUICK.map((q) => {
            const on = focus === q.key
            const n = c?.focus?.[q.key] ?? 0
            return (
              <button key={q.key} type="button" title={q.hint} onClick={() => onFocus(on ? '' : q.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all ${on ? 'border-[#F95C4B] bg-[#F95C4B] text-white' : 'border-[#E5E7EB] bg-white text-[#111111] hover:border-[#F95C4B]/50 dark:border-[#2A2A2A] dark:bg-[#181818] dark:text-white'}`}>
                {q.label}
                <span className={`tabular-nums ${on ? 'text-white/90' : n ? 'text-[#F95C4B]' : 'text-[#9CA3AF]'}`}>{n}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setMore((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${more ? 'text-[#F95C4B]' : 'text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white'}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> More filters
          </button>
        </div>
        <div className="relative lg:w-[260px] xl:w-[300px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Name, address, phone…"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-9 text-sm text-[#111111] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#F95C4B] dark:border-[#2A2A2A] dark:bg-[#181818] dark:text-white" />
          {search && <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111111] dark:hover:text-white"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      {more && <div className="apply-step flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-3 dark:border-[#2A2A2A] dark:bg-[#181818]">{moreFilters}</div>}
    </div>
  )
}
