import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { differenceInCalendarDays, format, formatDistanceToNowStrict, startOfDay } from 'date-fns'
import {
  LayoutGrid, List, Check, Minus, X, UserCheck, Building2, Repeat, CalendarClock, Loader2, Search, Bot,
  ArrowRight, Users,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { LeadStatusBadge, LEAD_STATUS_META, getApiErrorMessage } from './leadShared'
import { DateField } from '../common/DateTimeFields'

// The admin Leads screen's working tools: the "this week" insight cards, one-tap smart
// views, a Cards / List switch, multi-select with a bulk bar (hand to an agent or company,
// assign a follow-up manager, change the stage), and the list view itself — every lead's
// temperature, stage, who has worked it (cold caller → follow-up → agent), the latest
// note and what should happen next.

const DAY = 86400000
const name = (u) => (u && typeof u === 'object' && u.firstName ? `${u.firstName} ${u.lastName ?? ''}`.trim() : null)
const first = (u) => (u && typeof u === 'object' && u.firstName ? u.firstName : null)
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const AVATAR = ['#F9A8D4', '#C4B5FD', '#93C5FD', '#FCD34D', '#6EE7B7', '#FCA5A5', '#A5F3FC', '#FDBA74']
function avatarColor(seed = '') {
  let h = 0
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR[h % AVATAR.length]
}

/* ─── Insight cards + smart views ───────────────────────────────────────── */

function MoveDots({ from, to }) {
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      <span className="w-2.5 h-2.5 rounded-[4px]" style={{ backgroundColor: from }} />
      <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
      <span className="w-2.5 h-2.5 rounded-[4px]" style={{ backgroundColor: to }} />
    </span>
  )
}

export function InsightStrip({ insights: d, focus, onFocus }) {
  const cards = [
    { key: 'warmed_week', from: '#60A5FA', to: '#FBBF24', title: 'Cold → Warm this week', sub: 'Callback now within 60 days', n: d?.warmedWeek },
    { key: 'hot_week', from: '#FBBF24', to: '#F87171', title: 'Turned Hot this week', sub: d ? `${d.autoHotWeek ?? 0} moved by the system · callback within 30 days` : '—', n: d?.hotWeek },
    { key: 'due_today', from: '#F87171', to: '#EF4444', title: 'Callbacks due today', sub: d ? `${d.dueToday ?? 0} due · ${d.dueTodayDone ?? 0} done yet` : '—', n: d?.dueToday },
    { key: 'missed_callbacks', from: '#F87171', to: '#6B7280', title: 'Missed callbacks', sub: 'Date passed with no follow-up', n: d?.missedCallbacks },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const active = focus === c.key
        return (
          <button key={c.key} type="button" onClick={() => onFocus(active ? '' : c.key)}
            className={`mac-in mac-lift text-left flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-colors ${
              active ? 'border-[#F95C4B]/60 bg-[#F95C4B]/[0.06] ring-2 ring-[#F95C4B]/15' : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#F95C4B]/35'
            }`} style={{ '--d': `${40 + i * 50}ms` }}>
            <MoveDots from={c.from} to={c.to} />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold truncate ${active ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>{c.title}</span>
              <span className="block text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{c.sub}</span>
            </span>
            <span className="text-2xl font-bold tabular-nums text-[#111111] dark:text-white">{d ? (c.n ?? 0).toLocaleString() : '–'}</span>
          </button>
        )
      })}
    </div>
  )
}

const SMART_VIEWS = [
  { key: 'overdue', label: 'Overdue follow-ups', field: 'overdue' },
  { key: 'due_today', label: 'Due today', field: 'dueToday' },
  { key: 'no_agent', label: 'Hot, waiting for agent', field: 'noAgent' },
  { key: 'auto_hot_week', label: 'Turned hot by system', field: 'autoHotWeek', icon: Bot },
  { key: 'never_followed_up', label: 'Never followed up', field: 'neverFollowedUp' },
  { key: 'agent_silent', label: 'Agent silent 48h+', field: 'agentSilent' },
  { key: 'new_week', label: 'New this week', field: 'newWeek' },
  { key: 'closed_month', label: 'Closed this month', field: 'closedMonth' },
]

export function SmartViews({ insights, focus, onFocus }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto thin-scroll pb-1 -mx-1 px-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] whitespace-nowrap mr-1">Smart views</span>
      {SMART_VIEWS.map((v, i) => {
        const active = focus === v.key
        const n = insights?.[v.field]
        return (
          <button key={v.key} type="button" onClick={() => onFocus(active ? '' : v.key)}
            className={`mac-pop flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 ${
              active ? 'bg-[#F95C4B] border-[#F95C4B] text-white shadow-[0_8px_18px_-8px_rgba(249,92,75,0.9)]'
                : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F95C4B]/40'
            }`} style={{ '--d': `${80 + i * 30}ms` }}>
            {v.icon && <v.icon className="w-3.5 h-3.5" />}
            {v.label}
            <span className={`tabular-nums ${active ? 'text-white/90' : 'text-[#F95C4B]'}`}>{n == null ? '' : n.toLocaleString()}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Cards / List switch ───────────────────────────────────────────────── */

export function useLeadsView() {
  const [view, setView] = useState(() => { try { return localStorage.getItem('rt-leads-view') || 'cards' } catch { return 'cards' } })
  const set = (v) => { setView(v); try { localStorage.setItem('rt-leads-view', v) } catch { /* private mode */ } }
  return [view, set]
}

export function ViewToggle({ value, onChange }) {
  return (
    <div className="flex items-center p-1 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]" role="group" aria-label="Layout">
      {[['cards', LayoutGrid, 'Cards'], ['list', List, 'List']].map(([k, Icon, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} title={label}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
            value === k ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
          }`}>
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      ))}
    </div>
  )
}

/* ─── Selection ─────────────────────────────────────────────────────────── */

export function SelectBox({ checked, partial, onChange, label = 'Select lead', className = '' }) {
  return (
    <button type="button" role="checkbox" aria-checked={partial ? 'mixed' : checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange() }} onKeyDown={(e) => e.stopPropagation()}
      className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
        checked || partial ? 'bg-[#F95C4B] border-[#F95C4B] scale-105' : 'bg-white/80 dark:bg-[#181818]/80 border-[#D4D4D8] dark:border-[#3F3F46] hover:border-[#F95C4B]/70'
      } ${className}`}>
      {checked ? <Check className="w-3 h-3 text-white mac-pop" strokeWidth={3} /> : partial ? <Minus className="w-3 h-3 text-white" strokeWidth={3} /> : null}
    </button>
  )
}

export function BulkBar({ count, onAction, onClear }) {
  if (!count) return null
  return createPortal(
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 pointer-events-none">
      <div className="selection-bar-in pointer-events-auto liquid-glass-solid flex flex-wrap items-center gap-2 pl-4 pr-2 py-2 rounded-2xl shadow-[0_24px_60px_-18px_rgba(17,17,17,0.5)]">
        <span key={count} className="mac-pop w-8 h-8 rounded-lg bg-[#F95C4B] text-white text-xs font-bold flex items-center justify-center">{count}</span>
        <span className="text-sm font-bold text-[#111111] dark:text-white mr-2">selected</span>
        {[
          ['follow_up', 'Assign follow-up', CalendarClock],
          ['agent', 'Hand to agent', UserCheck],
          ['stage', 'Change stage', Repeat],
        ].map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => onAction(k)}
            className="mac-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] dark:border-white/10 bg-white/70 dark:bg-white/5 text-[#111111] dark:text-white hover:border-[#F95C4B]/50 hover:text-[#F95C4B] transition-colors">
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        <button type="button" onClick={onClear} className="px-3 py-2 rounded-xl text-xs font-semibold text-[#F95C4B] hover:bg-[#F95C4B]/10">Clear</button>
      </div>
    </div>,
    document.body,
  )
}

/* ─── Bulk dialogs ──────────────────────────────────────────────────────── */

function Sheet({ title, subtitle, icon: Icon, onClose, pending, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !pending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])
  return createPortal(
    <>
      <div data-lead-dialog className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[3px] lead-backdrop-in" onClick={!pending ? onClose : undefined} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center px-4 pt-[10vh] pointer-events-none">
        <div role="dialog" aria-label={title} className="picker-in pointer-events-auto w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
            <span className="liquid-pill relative w-10 h-10 rounded-xl flex items-center justify-center"><Icon className="w-5 h-5 text-white relative z-10" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{subtitle}</p>
            </div>
            <button type="button" onClick={onClose} disabled={pending} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5">{children}</div>
          <div className="flex gap-2.5 px-5 pb-5">{footer}</div>
        </div>
      </div>
    </>,
    document.body,
  )
}

function Pickable({ items, value, onPick, placeholder }) {
  const [q, setQ] = useState('')
  const shown = items.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()) || (i.sub ?? '').toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#F95C4B]/25" />
      </div>
      <ul className="thin-scroll max-h-[300px] overflow-y-auto space-y-1">
        {shown.length === 0 && <li className="py-6 text-center text-xs text-[#9CA3AF]">Nothing matches</li>}
        {shown.map((i, n) => (
          <li key={i.value} className="picker-row" style={{ '--d': `${Math.min(n, 8) * 22}ms` }}>
            <button type="button" onClick={() => onPick(i.value)}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${value === i.value ? 'bg-[#F95C4B]/10 ring-1 ring-[#F95C4B]/40' : 'hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'}`}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: i.icon ? 'transparent' : avatarColor(i.value) }}>
                {i.icon ? <i.icon className="w-4 h-4 text-[#F95C4B]" /> : initials(i.label)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#111111] dark:text-white truncate">{i.label}</span>
                {i.sub && <span className="block text-[11px] text-[#9CA3AF] truncate">{i.sub}</span>}
              </span>
              {value === i.value && <Check className="w-4 h-4 text-[#F95C4B]" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STAGES = ['cold', 'warm', 'hot', 'still_negotiating', 'listed', 'rented_out', 'sold', 'lost']

export function BulkDialog({ kind, ids, onClose, onDone }) {
  const qc = useQueryClient()
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')

  const { data: assignees } = useQuery({
    queryKey: ['lead-assignees'],
    queryFn: () => leadsApi.assignees().then((r) => r.data.data),
    staleTime: 60_000,
    enabled: kind === 'agent',
  })
  const { data: fums } = useQuery({
    queryKey: ['follow-up-managers'],
    queryFn: () => leadsApi.followUpManagers().then((r) => r.data.data.users),
    staleTime: 60_000,
    enabled: kind === 'follow_up',
  })

  const agentItems = useMemo(() => [
    ...(assignees?.agencies ?? []).map((a) => ({ value: `agency:${a._id}`, label: a.name, sub: 'Company — their manager picks the agent', icon: Building2 })),
    ...(assignees?.agents ?? []).map((a) => ({
      value: `agent:${a._id}`, label: `${a.firstName} ${a.lastName}`,
      sub: a.agencyId ? `${(assignees?.agencies ?? []).find((c) => c._id === a.agencyId)?.name ?? 'Agent'}${a.isAgencyManager ? ' · manager' : ''}` : 'Reliable Touch agent',
    })),
  ], [assignees])
  const fumItems = (fums ?? []).map((u) => ({ value: u._id, label: `${u.firstName} ${u.lastName}`, sub: 'Follow-up manager' }))

  const mut = useMutation({
    mutationFn: () => {
      if (kind === 'agent') {
        const [type, id] = target.split(':')
        return leadsApi.bulk({ ids, action: 'hand_to_agent', ...(type === 'agent' ? { assignedAgent: id } : { agencyId: id }) })
      }
      if (kind === 'follow_up') return leadsApi.bulk({ ids, action: 'assign_follow_up', followUpManager: target, followUpDate: date || undefined })
      return leadsApi.bulk({ ids, action: 'status', status, reason })
    },
    onSuccess: (res) => {
      const { done, failed } = res.data.data
      if (done) toast.success(`${done} lead${done === 1 ? '' : 's'} updated`)
      if (failed?.length) toast.error(`${failed.length} couldn't be updated — ${failed[0].message}`)
      ;['leads', 'leads-stats', 'lead-insights', 'agency-counts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      onDone()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update the leads')),
  })

  const n = ids.length
  const ready = kind === 'stage' ? status && reason.trim() : Boolean(target)
  const footer = (
    <>
      <button type="button" onClick={onClose} disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">Cancel</button>
      <button type="button" onClick={() => mut.mutate()} disabled={!ready || mut.isPending}
        className="mac-press flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 disabled:opacity-50 flex items-center justify-center gap-2">
        {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {kind === 'agent' ? `Hand over ${n}` : kind === 'follow_up' ? `Assign ${n}` : `Move ${n}`}
      </button>
    </>
  )

  if (kind === 'agent') {
    return (
      <Sheet title="Hand to agent" subtitle={`${n} lead${n === 1 ? '' : 's'} · the agent or company is told straight away`} icon={UserCheck} onClose={onClose} pending={mut.isPending} footer={footer}>
        {!assignees ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
          : <Pickable items={agentItems} value={target} onPick={setTarget} placeholder="Find a company or agent…" />}
      </Sheet>
    )
  }
  if (kind === 'follow_up') {
    return (
      <Sheet title="Assign follow-up" subtitle={`${n} lead${n === 1 ? '' : 's'} · who follows them up, and by when`} icon={Users} onClose={onClose} pending={mut.isPending} footer={footer}>
        {!fums ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
          : <Pickable items={fumItems} value={target} onPick={setTarget} placeholder="Find a follow-up manager…" />}
        <label className="block mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">Callback date (optional)</label>
        <DateField value={date} onChange={setDate} className="w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white outline-none" />
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">Leave empty to keep each lead&apos;s own callback date.</p>
      </Sheet>
    )
  }
  return (
    <Sheet title="Change stage" subtitle={`${n} lead${n === 1 ? '' : 's'} · recorded in each lead's history with your reason`} icon={Repeat} onClose={onClose} pending={mut.isPending} footer={footer}>
      <div className="grid grid-cols-2 gap-2">
        {STAGES.map((s) => {
          const m = LEAD_STATUS_META[s]
          const on = status === s
          return (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${on ? 'scale-[1.02]' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#D4D4D8]'}`}
              style={on ? { color: m.color, borderColor: m.color, backgroundColor: m.bg } : undefined}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} /> {m.label}
            </button>
          )
        })}
      </div>
      <label className="block mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">Reason</label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why are these leads moving?"
        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white outline-none resize-none focus:ring-2 focus:ring-[#F95C4B]/25" />
    </Sheet>
  )
}

/* ─── List view ─────────────────────────────────────────────────────────── */

const CLOSED = ['listed', 'rented_out', 'sold', 'lost']

function stageOf(l) {
  if (CLOSED.includes(l.status) || l.status === 'still_negotiating') {
    const m = LEAD_STATUS_META[l.status]
    return { label: m.label, color: m.color }
  }
  if (l.assignedAgent || l.agencyId) return { label: 'With agent', color: '#F59E0B' }
  if (l.appointmentDate && new Date(l.appointmentDate) >= startOfDay(new Date())) return { label: 'Appointment booked', color: '#3B82F6' }
  if (l.lastFollowUpAt) return { label: 'Following up', color: '#8B5CF6' }
  return { label: 'New', color: '#9CA3AF' }
}

function hotSince(l) {
  const h = (l.statusHistory ?? []).filter((x) => x.status === 'hot').pop()
  return new Date(h?.changedAt ?? l.createdAt)
}

function nextStepOf(l) {
  const today = startOfDay(new Date())
  const agent = name(l.assignedAgent) ?? (typeof l.agencyId === 'object' ? l.agencyId?.name : null)
  const fum = first(l.followUpManager) ?? first(l.lastFollowUpBy)
  if (CLOSED.includes(l.status)) return { label: LEAD_STATUS_META[l.status].label, sub: 'Closed', color: '#9CA3AF' }
  if (l.appointmentDate && new Date(l.appointmentDate) >= today) {
    return { label: `Appointment ${format(new Date(l.appointmentDate), 'EEE d MMM')}${l.appointmentTime ? `, ${l.appointmentTime}` : ''}`, sub: agent ?? fum ?? '', color: '#3B82F6' }
  }
  if (l.status === 'hot' && !l.assignedAgent && !l.agencyId) {
    const days = differenceInCalendarDays(new Date(), hotSince(l))
    return { label: 'Hand to agent', sub: `Waiting ${days === 0 ? 'since today' : `${days} day${days === 1 ? '' : 's'}`}`, color: '#F59E0B' }
  }
  if (l.followUpDate) {
    const d = new Date(l.followUpDate)
    if (d < today) return { label: `Missed callback ${format(d, 'd MMM')}`, sub: fum ?? first(l.createdBy) ?? '', color: '#EF4444' }
    return { label: `Follow up ${format(d, 'EEE d MMM')}`, sub: fum ?? first(l.createdBy) ?? '', color: '#111111' }
  }
  if (agent) return { label: 'Agent update due', sub: agent, color: '#111111' }
  return { label: 'Set a callback date', sub: '', color: '#9CA3AF' }
}

function Chain({ lead }) {
  const caller = lead.createdBy && typeof lead.createdBy === 'object' ? lead.createdBy : null
  const fum = (lead.followUpManager && typeof lead.followUpManager === 'object' ? lead.followUpManager : null)
    ?? (lead.lastFollowUpBy && typeof lead.lastFollowUpBy === 'object' ? lead.lastFollowUpBy : null)
  const agent = lead.assignedAgent && typeof lead.assignedAgent === 'object' ? lead.assignedAgent : null
  const company = !agent && lead.agencyId && typeof lead.agencyId === 'object' ? lead.agencyId : null
  const steps = [caller, fum, agent ?? company].map((p) => (p ? { id: p._id, label: p.firstName ? `${p.firstName} ${p.lastName ?? ''}`.trim() : p.name, short: p.firstName ?? p.name } : null))
  return (
    <div>
      <div className="flex items-center -space-x-1.5">
        {steps.map((s, i) => (s ? (
          <span key={i} title={s.label} className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-[#111111] ring-2 ring-white dark:ring-[#181818]" style={{ backgroundColor: avatarColor(s.id), zIndex: 3 - i }}>{initials(s.label)}</span>
        ) : (
          <span key={i} title={i === 1 ? 'No follow-up yet' : 'No agent yet'} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-[#F59E0B] border border-dashed border-[#F59E0B]/70 bg-white dark:bg-[#181818]" style={{ zIndex: 3 - i }}>+</span>
        )))}
      </div>
      <p className="mt-1 text-[11px] text-[#9CA3AF] truncate">
        {steps.map((s, i) => s?.short ?? (i === 1 ? 'no follow-up' : 'no agent')).join(' → ')}
      </p>
    </div>
  )
}

export function LeadListTable({ leads, selected, onToggle, onToggleAll, onOpen, rowProps, refreshing }) {
  const all = leads.length > 0 && leads.every((l) => selected.has(l._id))
  const some = !all && leads.some((l) => selected.has(l._id))
  return (
    <div className={`rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-60' : ''}`}>
      <div className="overflow-x-auto thin-scroll">
        <table className="w-full min-w-[1180px] text-left">
          <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <tr className="text-[11px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">
              <th className="pl-4 pr-2 py-3 w-10"><SelectBox checked={all} partial={some} onChange={onToggleAll} label="Select all shown" /></th>
              <th className="px-3 py-3">Lead</th>
              <th className="px-3 py-3">Temperature &amp; callback</th>
              <th className="px-3 py-3">Stage</th>
              <th className="px-3 py-3">Chain</th>
              <th className="px-3 py-3">Latest</th>
              <th className="px-3 py-3">Next step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
            {leads.map((l, i) => {
              const on = selected.has(l._id)
              const stage = stageOf(l)
              const next = nextStepOf(l)
              const due = l.followUpDate ? new Date(l.followUpDate) : null
              const diff = due ? differenceInCalendarDays(due, new Date()) : null
              const latestBy = name(l.lastFollowUpBy)
              const ink = next.color === '#111111'
              return (
                <tr key={l._id} {...rowProps(l._id)} onClick={() => onOpen(l._id)}
                  className={`mac-in cursor-pointer align-top transition-colors ${on ? 'bg-[#F95C4B]/[0.06]' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C]'}`}
                  style={{ '--d': `${Math.min(i, 14) * 22}ms` }}>
                  <td className="pl-4 pr-2 py-4"><SelectBox checked={on} onChange={() => onToggle(l._id)} /></td>
                  <td className="px-3 py-4 max-w-[260px]">
                    <p className="text-[13px] font-bold text-[#111111] dark:text-white uppercase tracking-tight truncate" title={l.landlordName}>{l.landlordName}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{l.contactId?.address ?? l.propertyAddress}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {l.area?.name && <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#111111]/[0.06] dark:bg-white/10 text-[#111111] dark:text-white">{l.area.name}</span>}
                      {l.listingType && <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#3B82F6]/12 text-[#2563EB] dark:text-[#93C5FD]">{l.listingType === 'rental' ? 'For rental' : 'For sale'}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <LeadStatusBadge status={l.status} />
                    {due ? (
                      <>
                        <p className="mt-1.5 text-xs text-[#111111] dark:text-white">Callback {format(due, 'EEE d MMM')}</p>
                        <p className={`text-[11px] ${diff < 0 ? 'text-[#EF4444] font-semibold' : 'text-[#9CA3AF]'}`}>
                          {diff === 0 ? 'today' : diff > 0 ? `in ${diff} day${diff === 1 ? '' : 's'}` : `${-diff} day${diff === -1 ? '' : 's'} ago`}
                        </p>
                      </>
                    ) : <p className="mt-1.5 text-[11px] text-[#9CA3AF]">No callback set</p>}
                  </td>
                  <td className="px-3 py-4">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap" style={{ color: stage.color, backgroundColor: `${stage.color}1F` }}>{stage.label}</span>
                  </td>
                  <td className="px-3 py-4"><Chain lead={l} /></td>
                  <td className="px-3 py-4 min-w-[240px] max-w-[360px]">
                    {l.lastFollowUpText || l.comments ? (
                      <>
                        <p className="text-[13px] text-[#111111] dark:text-white line-clamp-2">“{l.lastFollowUpText ?? l.comments}”</p>
                        <p className="mt-1 text-[11px] text-[#9CA3AF]">
                          {latestBy ?? name(l.createdBy) ?? 'Someone'} · {formatDistanceToNowStrict(new Date(l.lastFollowUpAt ?? l.createdAt), { addSuffix: true })}
                        </p>
                      </>
                    ) : <p className="text-xs text-[#9CA3AF] italic">No notes yet</p>}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <p className={`text-[13px] font-semibold ${ink ? 'text-[#111111] dark:text-white' : ''}`} style={ink ? undefined : { color: next.color }}>{next.label}</p>
                    {next.sub && <p className="text-[11px] text-[#9CA3AF]">{next.sub}</p>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
