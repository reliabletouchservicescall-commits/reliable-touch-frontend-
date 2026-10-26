import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isToday, isYesterday } from 'date-fns'
import {
  Flame, Clock, MessageSquareX, AlertTriangle, Database, User, UserX, ArrowRight, Plus, Activity, Bot, Moon,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { getSocket } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'

// Each signed-in person's own copy (an admin and a company manager in the same browser
// never see each other's board)
const useUid = () => useAuthStore((st) => st.user?._id ?? 'anon')
import { Card, Skeleton, CardTitle, LinkButton } from './DashboardKit'

// The admin dashboard's live operations board — who is working right now and what they're
// doing, what needs the admin today, and everything happening across the system as it
// happens. First picture from GET /live/*, then kept live by the socket (floor:presence,
// activity:new — see the backend's lib/presence.js and lib/activityLog.js).

/* ─── Data ──────────────────────────────────────────────────────────────── */

// Where things link to on each board
export const SCOPES = {
  admin: { leads: '/admin/leads', person: (id) => `/admin/users/${id}`, team: '/admin/performance', ranking: '/admin/performance', newLead: '/admin/leads?new=1' },
  agency: { leads: '/agency/leads', person: (id) => `/agency/agents/${id}`, team: '/agency/team', ranking: '/agency/leaderboard', newLead: '/agency/leads' },
}

const ROLE_LABEL = { cold_caller: 'Cold caller', follow_up_manager: 'Follow-up manager', agency: 'Agent', admin: 'Admin' }
const AVATAR = ['#F9A8D4', '#C4B5FD', '#93C5FD', '#FCD34D', '#6EE7B7', '#FCA5A5', '#A5F3FC', '#FDBA74']
function avatarColor(seed = '') {
  let h = 0
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR[h % AVATAR.length]
}
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

function useSocketEvent(event, handler) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    let socket = getSocket()
    const fn = (p) => ref.current(p)
    // The socket is created on login; pick it up if this mounts first
    const t = socket ? null : setInterval(() => {
      socket = getSocket()
      if (socket) { clearInterval(t); socket.on(event, fn) }
    }, 500)
    socket?.on(event, fn)
    return () => { clearInterval(t); socket?.off(event, fn) }
  }, [event])
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** The team floor, kept live: presence changes and every bit of work land straight in it. */
export function useLiveFloor(enabled = true) {
  const qc = useQueryClient()
  const key = ['live-floor', useUid()]
  const query = useQuery({
    enabled,
    queryKey: key,
    queryFn: () => axiosClient.get('/live/floor').then((r) => r.data.data),
    staleTime: 30_000,
    refetchInterval: 90_000,
  })
  useSocketEvent('floor:presence', (p) => {
    qc.setQueryData(key, (old) => {
      if (!old) return old
      if (!old.people.some((x) => x.userId === p.userId)) { qc.invalidateQueries({ queryKey: key }); return old }
      return {
        ...old,
        people: old.people.map((x) => (x.userId === p.userId ? {
          ...x, online: p.online, activity: p.activity, connectedAt: p.connectedAt ?? x.connectedAt,
          lastSeenAt: p.lastSeenAt ?? x.lastSeenAt, lastWorkAt: p.lastWorkAt ?? x.lastWorkAt, lastWork: p.lastWork ?? x.lastWork,
        } : x)),
      }
    })
  })
  useSocketEvent('activity:new', (a) => {
    if (!a?.actor?.id || a.type === 'login') return
    qc.setQueryData(key, (old) => old && ({
      ...old,
      people: old.people.map((x) => {
        if (x.userId !== a.actor.id) return x
        const today = { ...x.today }
        if (a.type === 'call') { today.calls += 1; today.lastCallAt = a.at }
        else if (a.type === 'comment') today.comments += 1
        else today.actions += 1
        today.firstAt = today.firstAt ?? a.at
        return { ...x, today, workedToday: true, lastWorkAt: a.at }
      }),
    }))
  })
  return query
}

/* What someone is doing right now, as a label and a colour */
export function presenceOf(p, now) {
  const mins = (d) => Math.floor((now - new Date(d).getTime()) / 60000)
  const clock = (d) => {
    const s = Math.max(0, Math.floor((now - new Date(d).getTime()) / 1000))
    return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  if (p.online) {
    const a = p.activity
    if (a?.kind === 'on_call') return { label: `On call ${clock(a.since)}`, tone: '#10B981', dot: '#10B981', rank: 0, sub: a.contactName ?? a.leadName }
    if (a?.kind === 'typing') return { label: 'Writing comment', tone: '#3B82F6', dot: '#3B82F6', rank: 1, sub: a.leadName }
    if (a?.kind === 'editing') return { label: 'Updating lead', tone: '#3B82F6', dot: '#3B82F6', rank: 1, sub: a.leadName }
    const since = Math.max(...[p.lastWorkAt, p.connectedAt].filter(Boolean).map((d) => new Date(d).getTime()), 0)
    const idle = since ? mins(since) : 0
    if (a?.kind === 'viewing' && idle < 10) return { label: 'Viewing lead', tone: '#3B82F6', dot: '#3B82F6', rank: 1, sub: a.leadName }
    if (idle < 5) return { label: 'Active', tone: '#10B981', dot: '#10B981', rank: 2 }
    return { label: `Idle ${idle >= 60 ? `${Math.floor(idle / 60)}h ${idle % 60}m` : `${idle} min`}`, tone: idle >= 30 ? '#EF4444' : '#F59E0B', dot: '#F59E0B', rank: 3, idle }
  }
  if (!p.workedToday) return { label: 'No work today', tone: '#EF4444', dot: '#6B7280', rank: 5, flag: true }
  const seen = p.lastSeenAt ? new Date(p.lastSeenAt) : null
  return {
    label: seen ? `Offline since ${isToday(seen) ? format(seen, 'HH:mm') : isYesterday(seen) ? 'yesterday' : format(seen, 'EEE')}` : 'Offline',
    tone: '#9CA3AF', dot: '#6B7280', rank: 4,
  }
}

/* ─── Header ────────────────────────────────────────────────────────────── */

const PERIODS = [{ key: 'day', label: 'Today' }, { key: 'week', label: 'This week' }, { key: 'month', label: 'This month' }]

function greeting(d) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function DashboardHeader({ user, floor, needsCount, period, onPeriod, scope = 'admin', company }) {
  const navigate = useNavigate()
  const now = new Date(useNow(60_000))
  const team = (floor?.people ?? []).filter((p) => scope === 'agency' || p.role !== 'agency')
  const working = team.filter((p) => p.workedToday || p.online).length
  return (
    <div className="glass-in relative flex flex-col lg:flex-row lg:items-end gap-4" style={{ '--d': '0ms' }}>
      <div className="min-w-0">
        {company && <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F95C4B] mb-0.5">{company}</p>}
        <h1 className="text-2xl sm:text-[28px] font-bold text-[#111111] dark:text-white tracking-tight">{greeting(now)}, {user?.firstName ?? 'there'}</h1>
        <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A1A1AA]">
          {format(now, 'EEEE d MMMM')}
          {floor && <> · <b className="font-semibold text-[#059669] dark:text-[#34D399]">{working} of {team.length} {scope === 'agency' ? 'in your team' : 'people'} working</b></>}
          {needsCount != null && <> · {needsCount === 0 ? 'nothing needs you right now' : `${needsCount} thing${needsCount === 1 ? '' : 's'} need${needsCount === 1 ? 's' : ''} you today`}</>}
        </p>
      </div>
      <div className="flex items-center gap-2.5 lg:ml-auto">
        <div className="flex items-center p-1 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => onPeriod(p.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${period === p.key
                ? 'bg-[#F95C4B] text-white shadow-[0_8px_18px_-8px_rgba(249,92,75,0.9)]'
                : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => navigate(SCOPES[scope].newLead)}
          className="mac-press flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-[0_10px_24px_-10px_rgba(249,92,75,0.9)]">
          <Plus className="w-4 h-4" /> Add lead
        </button>
      </div>
    </div>
  )
}

/* ─── How work turned into deals ────────────────────────────────────────── */

const compact = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toLocaleString())
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

export function FunnelStrip({ period }) {
  const { data, isLoading } = useQuery({
    queryKey: ['live-funnel', period, useUid()],
    queryFn: () => axiosClient.get('/live/funnel', { params: { period } }).then((r) => r.data.data),
    staleTime: 55_000,
    refetchInterval: 60_000,
  })
  const t = data?.totals, p = data?.previousTotals
  const tiles = data?.tiles ? data.tiles : t ? [
    { key: 'calls', label: 'Calls made', color: '#9CA3AF', value: t.calls, prev: p.calls, sub: `${compact(p.calls)} last` },
    { key: 'leads', label: 'Leads created', color: '#F472B6', value: t.leadsCreated, prev: p.leadsCreated, sub: `${pct(t.leadsCreated, t.calls)}% of calls` },
    { key: 'follow', label: 'Followed up', color: '#A78BFA', value: t.followUps, prev: p.followUps, sub: 'touches' },
    { key: 'hot', label: 'Turned hot', color: '#F87171', value: t.hot, prev: p.hot, sub: `${Math.round(pct(t.hot, t.leadsCreated))}% of leads` },
    { key: 'handed', label: 'Handed to agents', color: '#FBBF24', value: t.handedToAgents, prev: p.handedToAgents, sub: `${Math.round(pct(t.handedToAgents, t.hot))}% of hot` },
    { key: 'closed', label: 'Closed', color: '#34D399', value: t.closed, prev: p.closed, sub: `${Math.round(pct(t.closed, t.handedToAgents))}% of handed` },
  ] : []
  const label = { day: 'Today', week: 'This week', month: 'This month' }[period]
  const vs = { day: 'yesterday by this time', week: 'last week so far', month: 'last month' }[period]
  return (
    <Card delay={60} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3.5">
        <h3 className="text-[15px] font-bold text-[#111111] dark:text-white tracking-tight">How work turned into deals</h3>
        {data && (
          <p className="text-xs text-[#9CA3AF]">
            {label} · {period === 'day' ? format(new Date(data.from), 'EEE d MMM') : `${format(new Date(data.from), 'd')}–${format(new Date(data.to), 'd MMM')}`} · compared with {vs}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2.5">
        {isLoading || !tiles.length ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[104px]" />) : tiles.map((tile, i) => {
          const change = tile.prev ? Math.round(((tile.value - tile.prev) / tile.prev) * 100) : null
          return (
            <div key={tile.key} className="mac-pop rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#141414] px-3.5 py-3" style={{ '--d': `${100 + i * 55}ms` }}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tile.color }} /> {tile.label}
              </p>
              <p className="mt-1.5 text-[26px] leading-none font-bold text-[#111111] dark:text-white tabular-nums tracking-tight">{tile.value.toLocaleString()}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                {change == null
                  ? <span className="font-semibold text-[#111111] dark:text-white">{tile.value ? 'new' : '—'}</span>
                  : <span className={`font-semibold tabular-nums ${change >= 0 ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#E11D48] dark:text-[#FB7185]'}`}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}%</span>}
                <span className="text-[#9CA3AF] truncate">{tile.sub}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ─── Needs your attention ──────────────────────────────────────────────── */

const ICONS = { flame: Flame, clock: Clock, 'message-x': MessageSquareX, alert: AlertTriangle, database: Database, user: User, 'user-x': UserX }
const TONE = {
  danger: { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
  warning: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  info: { fg: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
}

// The server's list, plus what only the live floor knows: who is idle right now, and who
// hasn't done any work today
export function useAttentionItems(overview, floor, now, scope = 'admin') {
  return useMemo(() => {
    const items = [...(overview?.attention ?? [])]
    const team = (floor?.people ?? []).filter((p) => scope === 'agency' || p.role !== 'agency')
    const idle = team.map((p) => ({ p, s: presenceOf(p, now) })).filter(({ s }) => s.rank === 3 && s.idle >= 30)
      .sort((a, b) => b.s.idle - a.s.idle).slice(0, 2)
    idle.forEach(({ p, s }) => items.push({
      key: `idle-${p.userId}`, tone: 'info', icon: 'user', countLabel: s.label.replace('Idle ', ''), title: `idle — ${p.name}`,
      detail: [
        p.today.lastCallAt ? `Last call ${format(new Date(p.today.lastCallAt), 'HH:mm')}` : 'No calls yet today',
        p.connectedAt ? `online since ${format(new Date(p.connectedAt), 'HH:mm')}` : null,
        `${p.today.calls} call${p.today.calls === 1 ? '' : 's'} today${p.dailyCallTarget ? ` (target ${p.dailyCallTarget})` : ''}`,
      ].filter(Boolean).join(' · '),
      action: { label: 'Timeline', to: SCOPES[scope].person(p.userId) },
    }))
    const hour = new Date(now).getHours()
    const quiet = team.filter((p) => !p.workedToday && !p.online)
    if (quiet.length && hour >= 9) {
      items.push({
        key: 'not-worked', tone: 'danger', icon: 'user-x', count: quiet.length,
        title: `${quiet.length === 1 ? 'person hasn’t' : 'people haven’t'} worked today`,
        detail: quiet.slice(0, 4).map((p) => p.name).join(', ') + (quiet.length > 4 ? ` +${quiet.length - 4}` : ''),
        action: { label: 'See who', scrollTo: 'live-floor' },
      })
    }
    return items
  }, [overview, floor, now, scope])
}

export function NeedsAttention({ items, loading }) {
  const navigate = useNavigate()
  return (
    <Card delay={120} className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F1EFEC] dark:border-[#232323]">
        <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-[#111111] dark:text-white">
          Needs your attention
          {items.length > 0 && <span className="min-w-[24px] h-6 px-2 rounded-full text-xs font-bold flex items-center justify-center bg-[#EF4444]/12 text-[#E11D48] dark:text-[#FB7185]">{items.length}</span>}
        </h3>
        <span className="text-xs text-[#9CA3AF]">Biggest risk first</span>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <span className="w-12 h-12 rounded-2xl bg-[#10B981]/12 flex items-center justify-center mac-pop"><Activity className="w-6 h-6 text-[#10B981]" /></span>
          <p className="text-sm font-semibold text-[#111111] dark:text-white">All clear</p>
          <p className="text-xs text-[#9CA3AF]">Nothing needs you right now.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
          {items.map((it, i) => {
            const Icon = ICONS[it.icon] ?? AlertTriangle
            const tone = TONE[it.tone] ?? TONE.info
            return (
              <li key={it.key} className="mac-in flex items-center gap-3.5 px-5 py-3.5 hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors" style={{ '--d': `${160 + i * 45}ms` }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tone.bg }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: tone.fg }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white">
                    <span className="tabular-nums" style={{ color: tone.fg }}>{it.countLabel ?? it.count?.toLocaleString()}</span> {it.title}
                  </p>
                  {it.detail && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate mt-0.5">{it.detail}</p>}
                </div>
                {it.action && (
                  <button type="button"
                    onClick={() => (it.action.scrollTo ? document.getElementById(it.action.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : navigate(it.action.to))}
                    className="mac-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F95C4B]/50 hover:text-[#F95C4B] whitespace-nowrap transition-colors">
                    {it.action.label} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ─── On the floor now ──────────────────────────────────────────────────── */

const FLOOR_FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'online', label: 'Online' },
  { key: 'idle', label: 'Not working' },
]

export function OnTheFloor({ floor, loading, now, scope = 'admin' }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const rows = useMemo(() => (floor?.people ?? [])
    .map((p) => ({ p, s: presenceOf(p, now) }))
    .sort((a, b) => a.s.rank - b.s.rank || a.p.name.localeCompare(b.p.name)), [floor, now])
  const online = rows.filter(({ p }) => p.online).length
  const notWorked = rows.filter(({ s }) => s.flag).length
  const shown = rows.filter(({ p, s }) => (filter === 'online' ? p.online : filter === 'idle' ? s.rank >= 3 : true))
  return (
    <Card delay={160} className="overflow-hidden flex flex-col" id="live-floor">
      <div className="px-5 pt-4 pb-3 border-b border-[#F1EFEC] dark:border-[#232323]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#111111] dark:text-white">
            On the floor now
            <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-[#10B981]" /></span>
          </h3>
          <button type="button" onClick={() => navigate(SCOPES[scope].team)} className="text-xs font-semibold text-[#F95C4B] hover:text-[#E84B3A]">Team view</button>
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5">
          {online} online{notWorked ? <> · <span className="text-[#E11D48] dark:text-[#FB7185] font-semibold">{notWorked} haven&apos;t worked today</span></> : ''}
        </p>
        <div className="flex gap-1 mt-2.5">
          {FLOOR_FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${filter === f.key ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="thin-scroll flex-1 overflow-y-auto max-h-[520px] divide-y divide-[#F5F5F4] dark:divide-[#202020]">
        {loading && Array.from({ length: 6 }, (_, i) => <li key={i} className="px-5 py-3"><Skeleton className="h-10" /></li>)}
        {!loading && shown.length === 0 && <li className="py-10 text-center text-xs text-[#9CA3AF]">Nobody here</li>}
        {shown.map(({ p, s }, i) => (
          <li key={p.userId}>
            <button type="button" onClick={() => navigate(SCOPES[scope].person(p.userId))}
              className={`mac-in w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${s.flag ? 'bg-[#EF4444]/[0.05] hover:bg-[#EF4444]/[0.09]' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C]'}`}
              style={{ '--d': `${Math.min(i, 10) * 30}ms` }}>
              <span className="relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: avatarColor(p.userId), opacity: p.online ? 1 : 0.75 }}>
                {initials(p.name)}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-[#181818] ${s.rank === 0 ? 'animate-pulse' : ''}`} style={{ backgroundColor: s.dot }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#111111] dark:text-white truncate">{p.name}</span>
                <span className="block text-[11px] text-[#9CA3AF] truncate">
                  {scope === 'agency' ? (p.isAgencyManager ? 'Manager' : 'Agent') : (ROLE_LABEL[p.role] ?? p.role)}{p.place ? ` · ${p.place}` : ''}
                  {s.sub ? <span className="text-[#6B7280] dark:text-[#A1A1AA]"> · {s.sub}</span> : null}
                </span>
              </span>
              <span className="text-right flex-shrink-0">
                <span className="block text-xs font-semibold tabular-nums" style={{ color: s.tone }}>
                  {s.flag && <Moon className="inline w-3 h-3 mr-1 -mt-0.5" />}{s.label}
                </span>
                {(p.today.calls > 0 || p.today.comments > 0) && (
                  <span className="block text-[10px] text-[#9CA3AF] tabular-nums">
                    {[p.today.calls && `${p.today.calls} call${p.today.calls === 1 ? '' : 's'}`, p.today.comments && `${p.today.comments} note${p.today.comments === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ─── Live activity ─────────────────────────────────────────────────────── */

const FEED_FILTERS = [
  { key: '', label: 'Everything' },
  { key: 'calls', label: 'Calls' },
  { key: 'leads', label: 'Lead changes' },
  { key: 'comments', label: 'Comments' },
  { key: 'logins', label: 'Logins' },
]
const FEED_TYPES = { calls: ['call'], leads: ['lead_created', 'lead_updated', 'status', 'assigned'], comments: ['comment'], logins: ['login'] }
const CLOSED = ['listed', 'rented_out', 'sold']
const STATUS_WORD = { cold: 'Cold', warm: 'Warm', hot: 'Hot', still_negotiating: 'Still negotiating', listed: 'Listed', rented_out: 'Rented out', sold: 'Sold', lost: 'Lost' }

function tagOf(a) {
  if (a.type === 'call') return { label: 'CALL', color: '#3B82F6' }
  if (a.type === 'comment') return { label: 'NOTE', color: '#A855F7' }
  if (a.type === 'login') return { label: 'LOGIN', color: '#9CA3AF' }
  if (a.type === 'status' && CLOSED.includes(a.meta?.to)) return { label: 'DEAL', color: '#10B981' }
  if (a.actor?.role === 'agency') return { label: 'AGENT', color: '#F59E0B' }
  return { label: 'LEAD', color: '#EF4444' }
}

function detailOf(a) {
  const m = a.meta ?? {}
  if (a.type === 'call') return [m.contactName, m.notes ? `“${m.notes}”` : null].filter(Boolean).join(' · ')
  if (a.type === 'comment') return m.text ? `“${m.text}”` : null
  if (a.type === 'status') return [m.system ? 'Automatic' : null, m.reason].filter(Boolean).join(' · ')
  if (a.type === 'login') return m.device
  if (a.changes?.length) return a.changes.map((c) => `${c.label}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join(' · ')
  return null
}

function headlineOf(a) {
  const m = a.meta ?? {}
  if (a.type === 'status') return m.from ? `moved ${STATUS_WORD[m.from] ?? m.from} → ${STATUS_WORD[m.to] ?? m.to}` : `marked ${STATUS_WORD[m.to] ?? m.to}`
  if (a.type === 'call' && !a.lead && m.phoneTail) return `${a.summary} · •• ${m.phoneTail}`
  return a.summary
}

export function LiveActivity({ scope = 'admin' }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [type, setType] = useState('')
  const [fresh, setFresh] = useState(() => new Set())
  const uid = useUid()
  const key = ['live-activity', type, uid]
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => axiosClient.get('/live/activity', { params: { type: type || undefined, limit: 30 } }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  useSocketEvent('activity:new', (a) => {
    Object.entries({ '': null, ...FEED_TYPES }).forEach(([k, types]) => {
      if (types && !types.includes(a.type)) return
      qc.setQueryData(['live-activity', k, uid], (old) => old && ({ ...old, items: [a, ...old.items.filter((x) => x._id !== a._id)].slice(0, 60) }))
    })
    setFresh((s) => new Set(s).add(a._id))
  })
  const items = data?.items ?? []
  return (
    <Card delay={200} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#F1EFEC] dark:border-[#232323]">
        <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-[#111111] dark:text-white">
          Live activity
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-[#34D399]">
            <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-current animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-current" /></span>
            Live
          </span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {FEED_FILTERS.map((f) => (
            <button key={f.key || 'all'} type="button" onClick={() => setType(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${type === f.key
                ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white'
                : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="thin-scroll max-h-[560px] overflow-y-auto divide-y divide-[#F5F5F4] dark:divide-[#202020]">
        {isLoading && Array.from({ length: 7 }, (_, i) => <li key={i} className="px-5 py-3.5"><Skeleton className="h-11" /></li>)}
        {!isLoading && items.length === 0 && <li className="py-14 text-center text-sm text-[#9CA3AF]">Nothing yet — activity shows up here the moment it happens.</li>}
        {items.map((a, i) => {
          const tag = tagOf(a)
          const detail = detailOf(a)
          const system = !a.actor?.id
          const at = new Date(a.at)
          return (
            <li key={a._id}>
              <button type="button" disabled={!a.lead} onClick={() => a.lead && navigate(`${SCOPES[scope].leads}?lead=${a.lead.id}`)}
                className={`${fresh.has(a._id) ? 'feed-arrive' : 'mac-in'} w-full flex items-start gap-3.5 px-5 py-3.5 text-left transition-colors enabled:hover:bg-[#FAFAF9] dark:enabled:hover:bg-[#1C1C1C] disabled:cursor-default`}
                style={{ '--d': `${Math.min(i, 10) * 30}ms` }}>
                <time className="w-11 pt-0.5 text-xs text-[#9CA3AF] tabular-nums flex-shrink-0" title={format(at, 'd MMM yyyy, HH:mm')}>
                  {isToday(at) ? format(at, 'HH:mm') : format(at, 'd MMM')}
                </time>
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-[#111111] flex-shrink-0"
                  style={{ backgroundColor: system ? '#BFDBFE' : avatarColor(a.actor?.id ?? a.actor?.name) }}>
                  {system ? <Bot className="w-4 h-4" /> : initials(a.actor?.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[#6B7280] dark:text-[#A1A1AA] leading-snug">
                    <b className="font-semibold text-[#111111] dark:text-white">{a.actor?.name}</b> {headlineOf(a)}
                    {a.lead && <b className="font-semibold text-[#F95C4B] uppercase"> {a.lead.name}</b>}
                  </span>
                  {detail && <span className="block text-xs text-[#9CA3AF] truncate mt-0.5">{detail}</span>}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide flex-shrink-0" style={{ color: tag.color, backgroundColor: `${tag.color}1F` }}>{tag.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ─── Lead temperature ──────────────────────────────────────────────────── */

export function LeadTemperature({ temperature, scope = 'admin' }) {
  if (!temperature) return <Card delay={240} className="p-5"><Skeleton className="h-[220px]" /></Card>
  const { hot, warm, cold, week } = temperature
  const total = hot + warm + cold || 1
  const rows = [
    { key: 'hot', label: 'Hot', range: '≤ 30 days', color: '#F87171', n: hot, note: [week.warmToHot + week.coldToHot ? `+${week.warmToHot + week.coldToHot} arrived this week` : null, week.hotOut ? `${week.hotOut} moved on` : null].filter(Boolean).join(' · ') || 'No change this week' },
    { key: 'warm', label: 'Warm', range: '31–60 days', color: '#FBBF24', n: warm, note: [week.coldToWarm ? `+${week.coldToWarm} from Cold` : null, week.warmToHot ? `${week.warmToHot} leaving to Hot` : null].filter(Boolean).join(' · ') || 'No change this week' },
    { key: 'cold', label: 'Cold', range: '> 60 days', color: '#60A5FA', n: cold, note: week.coldToWarm || week.coldToHot ? `${week.coldToWarm + week.coldToHot} warmed up this week` : 'No change this week' },
  ]
  return (
    <Card delay={240} className="p-5">
      <CardTitle title="Lead temperature" subtitle={scope === 'agency' ? 'Your company\u2019s open leads, by how soon the follow-up is' : 'Open leads, by how soon the follow-up is'} action={<LinkButton to={SCOPES[scope].leads}>Open leads</LinkButton>} />
      <div className="flex h-2.5 rounded-full overflow-hidden gap-1">
        {rows.map((r, i) => <span key={r.key} className="mac-grow-x h-full rounded-full" style={{ width: `${(r.n / total) * 100}%`, backgroundColor: r.color, '--d': `${280 + i * 80}ms` }} />)}
      </div>
      <ul className="mt-4 space-y-3.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: r.color }} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm"><b className="font-semibold text-[#111111] dark:text-white">{r.label}</b> <span className="text-xs text-[#9CA3AF]">{r.range}</span></span>
              <span className="block text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{r.note}</span>
            </span>
            <span className="text-2xl font-bold text-[#111111] dark:text-white tabular-nums">{r.n.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 text-[10px] text-[#9CA3AF]">Leads move up automatically as the follow-up date gets close, and stay Hot until someone changes them.</p>
    </Card>
  )
}

/* ─── Leading this month ────────────────────────────────────────────────── */

export function LeadingThisMonth({ leaders, scope = 'admin' }) {
  const navigate = useNavigate()
  const rows = leaders?.rows ? leaders.rows.map((r) => ({ key: r.key, label: r.label, color: r.color, l: r })) : leaders ? [
    { key: 'cc', label: 'Cold caller', color: '#F472B6', l: leaders.coldCaller },
    { key: 'fu', label: 'Follow-up', color: '#A78BFA', l: leaders.followUp },
    { key: 'ag', label: 'Agent', color: '#FBBF24', l: leaders.agent },
    { key: 'co', label: 'Agency', color: '#34D399', l: leaders.company },
  ].filter((r) => r.l) : []
  return (
    <Card delay={280} className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-[15px] font-bold text-[#111111] dark:text-white">Leading this month</h3>
        <button type="button" onClick={() => navigate(SCOPES[scope].ranking)} className="text-xs font-semibold text-[#F95C4B] hover:text-[#E84B3A]">Full ranking</button>
      </div>
      {!leaders ? <div className="px-5 pb-5"><Skeleton className="h-[220px]" /></div> : rows.length === 0 ? (
        <p className="px-5 pb-6 text-xs text-[#9CA3AF]">No scores yet this month.</p>
      ) : (
        <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020] border-t border-[#F5F5F4] dark:border-[#202020]">
          {rows.map((r, i) => (
            <li key={r.key} className="mac-slide-in flex items-center gap-3 px-5 py-3" style={{ '--d': `${300 + i * 60}ms` }}>
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: avatarColor(r.l.userId ?? r.l.agencyId ?? r.l.name) }}>{initials(r.l.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: r.color }}>{r.label}</span>
                <span className="block text-sm font-semibold text-[#111111] dark:text-white truncate">{r.l.name}</span>
              </span>
              <span className="text-right">
                <span className="block text-base font-bold text-[#111111] dark:text-white tabular-nums">{Number(r.l.score).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className="block text-[11px] text-[#9CA3AF]">{r.l.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ─── What happens to the leads (company): from Reliable Touch vs own ───── */

const SOURCE_STEPS = [
  ['total', 'Leads'], ['worked', 'Followed up'], ['withAgent', 'With an agent'], ['appointment', 'Appointment'],
  ['listed', 'Listed / negotiating'], ['won', 'Rented / sold'], ['paid', 'Paid'],
]
const SOURCE_STATUS = [
  ['cold', 'Cold', '#60A5FA'], ['warm', 'Warm', '#FBBF24'], ['hot', 'Hot', '#F87171'], ['still_negotiating', 'Negotiating', '#FF8C7A'],
  ['listed', 'Listed', '#A78BFA'], ['rented_out', 'Rented', '#34D399'], ['sold', 'Sold', '#10B981'], ['lost', 'Lost', '#9CA3AF'],
]

function SourceColumn({ title, sub, color, d, to, delay }) {
  const navigate = useNavigate()
  const max = Math.max(1, d.total)
  return (
    <div className="mac-in rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4" style={{ '--d': `${delay}ms`, borderTop: `3px solid ${color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#111111] dark:text-white">{title}</p>
          <p className="text-[11px] text-[#9CA3AF]">{sub}</p>
        </div>
        <button type="button" onClick={() => navigate(to)} className="text-[11px] font-semibold text-[#F95C4B] hover:underline whitespace-nowrap">Open leads</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {[[d.total, 'leads'], [`${d.closeRate}%`, 'closed'], [d.medianResponseHours == null ? '—' : d.medianResponseHours < 48 ? `${d.medianResponseHours}h` : `${Math.round(d.medianResponseHours / 24)}d`, 'first reply']].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-[#FAFAF9] dark:bg-[#141414] py-2">
            <p className="text-lg font-bold text-[#111111] dark:text-white tabular-nums leading-tight">{v}</p>
            <p className="text-[10px] text-[#9CA3AF]">{l}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">What happened to them</p>
      <ul className="mt-1.5 space-y-1.5">
        {SOURCE_STEPS.map(([k, l], i) => (
          <li key={k} className="grid grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-2 text-xs">
            <span className="text-[#6B7280] dark:text-[#A1A1AA] truncate">{l}</span>
            <span className="h-2 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
              <span className="mac-grow-x block h-full rounded-full" style={{ width: `${(d[k] / max) * 100}%`, backgroundColor: color, opacity: 1 - i * 0.08, '--d': `${delay + 150 + i * 60}ms` }} />
            </span>
            <span className="text-right font-semibold text-[#111111] dark:text-white tabular-nums">{d[k]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Where they are now</p>
      <div className="flex h-2.5 rounded-full overflow-hidden mt-1.5 bg-[#F5F5F4] dark:bg-[#202020]">
        {SOURCE_STATUS.map(([k, l, c]) => (d.byStatus[k] ? <span key={k} className="mac-grow-x h-full" title={`${l}: ${d.byStatus[k]}`} style={{ width: `${(d.byStatus[k] / max) * 100}%`, backgroundColor: c }} /> : null))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {SOURCE_STATUS.filter(([k]) => d.byStatus[k]).map(([k, l, c]) => (
          <span key={k} className="inline-flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />{l} <b className="text-[#111111] dark:text-white">{d.byStatus[k]}</b></span>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[#9CA3AF]">{d.thisMonth} new this month · {d.open} still open · {d.lost} lost</p>
    </div>
  )
}

export function SourcesReport({ sources }) {
  if (!sources) return <Card delay={300} className="p-5"><Skeleton className="h-[320px]" /></Card>
  return (
    <Card delay={300} className="p-5">
      <CardTitle title="What happens to your leads" subtitle="Leads Reliable Touch handed to you against the ones your team found — from arrival to a paid deal" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SourceColumn title="From Reliable Touch" sub="Handed to your company" color="#F95C4B" d={sources.reliableTouch} to="/agency/leads?source=reliable_touch" delay={340} />
        <SourceColumn title="Your own leads" sub="Your team found these themselves" color="#8B5CF6" d={sources.own} to="/agency/leads?source=agency_self_sourced" delay={400} />
      </div>
    </Card>
  )
}

/* ─── Whole board ───────────────────────────────────────────────────────── */

export function useLiveOverview(enabled = true) {
  const qc = useQueryClient()
  const uid = useUid()
  const query = useQuery({
    enabled,
    queryKey: ['live-overview', uid],
    queryFn: () => axiosClient.get('/live/overview').then((r) => r.data.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  // Lead changes can change what needs attention — refresh, at most every few seconds
  const timer = useRef(null)
  useSocketEvent('activity:new', (a) => {
    if (!['status', 'assigned', 'lead_created', 'comment'].includes(a.type) || timer.current) return
    timer.current = setTimeout(() => { timer.current = null; qc.invalidateQueries({ queryKey: ['live-overview'] }) }, 8000)
  })
  useEffect(() => () => clearTimeout(timer.current), [])
  return query
}

