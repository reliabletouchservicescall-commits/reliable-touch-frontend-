import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns'
import {
  Phone, Eye, PhoneCall, ArrowUp, MessageSquare, CheckCircle2, Check, ArrowRight, Sparkles, Heart, UserCheck, PencilLine, Loader2, CalendarClock,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { getSocket } from '../../lib/socket'
import { Skeleton } from './DashboardKit'

// The cold caller's live board (GET /reports/my-board): what's happening to the leads they
// found — who opened them, called the landlord, moved them forward — the deals their calls
// started, leads on the move, the month's milestone, today's list, and a calls ring.
// New activity arrives live over the socket (`activity:mine`).

const LEADS = '/cold-caller/leads'
const AVATAR = ['#F9A8D4', '#C4B5FD', '#93C5FD', '#FCD34D', '#6EE7B7', '#FCA5A5', '#A5F3FC', '#FDBA74']
const tone = (seed = '') => { let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length] }
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const ROLE = { follow_up_manager: 'Follow-up manager', agency: 'Agent', admin: 'Admin', cold_caller: 'Cold caller', system: 'System' }
const STATUS = { cold: 'Cold', warm: 'Warm', hot: 'Hot', still_negotiating: 'Negotiating', listed: 'Listed', rented_out: 'Rented out', sold: 'Sold', lost: 'Lost' }
function ago(d) {
  const t = new Date(d)
  const mins = (Date.now() - t) / 60000
  if (mins < 1.5) return 'now'
  if (mins < 60) return `${Math.round(mins)} min`
  if (isToday(t)) return `${Math.round(mins / 60)}h`
  if (isYesterday(t)) return 'Yesterday'
  return format(t, 'd MMM')
}

export function useCallerBoard() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['caller-board'],
    queryFn: () => axiosClient.get('/reports/my-board').then((r) => r.data.data),
    staleTime: 20_000,
    refetchInterval: 45_000,
  })
  // Anything new on my leads drops straight into the feed
  useEffect(() => {
    let s = getSocket()
    const on = (item) => {
      qc.setQueryData(['caller-board'], (old) => old && ({ ...old, feed: [item, ...old.feed.filter((x) => x._id !== item._id)].slice(0, 30), openedWeek: old.openedWeek + (item.type === 'viewed' ? 1 : 0) }))
    }
    const t = s ? null : setInterval(() => { s = getSocket(); if (s) { clearInterval(t); s.on('activity:mine', on) } }, 500)
    s?.on('activity:mine', on)
    return () => { clearInterval(t); s?.off('activity:mine', on) }
  }, [qc])
  return query
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */

function greeting(d) { const h = d.getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export function CallerHero({ user, board }) {
  const navigate = useNavigate()
  const now = new Date()
  const chips = board ? [
    { label: `${board.stats.leadsMonth} lead${board.stats.leadsMonth === 1 ? '' : 's'} this month`, color: '#F87171', to: LEADS },
    { label: `${board.stats.hot} of your leads are hot`, color: '#FB7185', to: `${LEADS}?status=hot` },
    { label: `${board.stats.deals} deal${board.stats.deals === 1 ? '' : 's'} you started`, color: '#34D399', to: `${LEADS}?focus=closed_month` },
    { label: `${board.stats.callbacks} callback${board.stats.callbacks === 1 ? '' : 's'} waiting`, color: '#FBBF24', to: '/cold-caller/contacts?outcome=callback_requested' },
  ] : []
  return (
    <div className="glass-in relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-[#111111] text-white" style={{ '--d': '0ms' }}>
      <span aria-hidden className="aurora w-[420px] h-[260px] -top-28 -left-10 bg-[#F95C4B]/30" />
      <span aria-hidden className="aurora w-[360px] h-[220px] -bottom-24 right-0 bg-[#8B5CF6]/25" style={{ animationDelay: '-8s' }} />
      <div className="relative">
        <p className="text-sm text-white/60">{format(now, 'EEEE d MMMM')}</p>
        <h1 className="mt-2 text-2xl sm:text-[34px] leading-tight font-bold tracking-tight">
          {greeting(now)}, {user?.firstName ?? 'there'}.<br />
          {board == null ? <span className="inline-block w-72 h-8 rounded-lg bg-white/10 shimmer align-middle" />
            : board.openedWeek > 0
              ? <>Your leads were opened <span className="text-[#FB7185]">{board.openedWeek} time{board.openedWeek === 1 ? '' : 's'}</span> this week.</>
              : <>Your leads are <span className="text-[#FB7185]">in good hands</span>.</>}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-white/75 max-w-2xl">
          {board ? (board.peopleOnLeads > 0
            ? <>{board.peopleOnLeads} {board.peopleOnLeads === 1 ? 'person' : 'people'} — follow-up managers and agents — {board.peopleOnLeads === 1 ? 'is' : 'are'} working on leads you found. Here&apos;s what they did.</>
            : 'Every lead you find goes to a follow-up manager and an agent — you’ll see everything they do right here.') : ' '}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <button key={c.label} type="button" onClick={() => navigate(c.to)}
              className="mac-pop mac-press px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ color: c.color, backgroundColor: `${c.color}22`, '--d': `${200 + i * 60}ms` }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Calls ring ────────────────────────────────────────────────────────── */

const GOALS = [40, 60, 100]

export function CallsRing({ callsToday = 0, toCall = 0, loading }) {
  const navigate = useNavigate()
  const [goal, setGoal] = useState(() => { try { return Number(localStorage.getItem('rt-call-goal')) || 60 } catch { return 60 } })
  const pick = (g) => { setGoal(g); try { localStorage.setItem('rt-call-goal', String(g)) } catch { /* private mode */ } }
  const pct = Math.min(1, callsToday / goal)
  const R = 66, C = 2 * Math.PI * R
  const done = callsToday >= goal
  return (
    <div className="glass-in rounded-3xl p-6 bg-[#111111] text-white flex flex-col items-center" style={{ '--d': '80ms' }}>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/60">My calls today</p>
      <div className="relative mt-4 w-[164px] h-[164px]">
        <svg viewBox="0 0 164 164" className="w-full h-full -rotate-90">
          <circle cx="82" cy="82" r={R} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="12" />
          <circle cx="82" cy="82" r={R} fill="none" stroke={done ? '#34D399' : '#F43F5E'} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 1.2s var(--ease-mac)' }} />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : (
            <>
              <span className="text-4xl font-bold tabular-nums">{callsToday}</span>
              <span className="text-xs text-white/60">of {goal}</span>
            </>
          )}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        {GOALS.map((g) => (
          <button key={g} type="button" onClick={() => pick(g)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${goal === g ? 'bg-white text-[#111111] border-white' : 'border-white/20 text-white/80 hover:border-white/50'}`}>
            {g} calls
          </button>
        ))}
      </div>
      <button type="button" onClick={() => navigate('/cold-caller/contacts')}
        className="mac-press mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-[#E11D48] hover:bg-[#BE123C] shadow-[0_12px_30px_-12px_rgba(225,29,72,0.9)] transition-colors">
        <Phone className="w-4 h-4" /> Start calling{toCall ? ` · ${toCall.toLocaleString()} left` : ''}
      </button>
      {done && <p className="mt-2 text-[11px] text-[#34D399] font-semibold mac-pop">Goal reached — nice work!</p>}
    </div>
  )
}

/* ─── Happening to your leads ───────────────────────────────────────────── */

const FILTERS = [['all', 'Everything'], ['viewed', 'Opened'], ['call', 'Calls'], ['moved', 'Moved forward']]
const MOVED = ['status', 'assigned']

function badgeOf(type) {
  if (type === 'viewed') return [Eye, '#3B82F6']
  if (type === 'call') return [PhoneCall, '#10B981']
  if (type === 'status') return [ArrowUp, '#F59E0B']
  if (type === 'assigned') return [UserCheck, '#10B981']
  if (type === 'comment') return [MessageSquare, '#8B5CF6']
  return [PencilLine, '#9CA3AF']
}

function sentence(i) {
  const m = i.meta ?? {}
  if (i.type === 'viewed') return 'opened'
  if (i.type === 'call') return 'called the landlord of'
  if (i.type === 'status') return m.to ? `moved ${STATUS[m.from] ?? ''}${m.from ? ' → ' : ''}${STATUS[m.to] ?? m.to}` : 'moved'
  if (i.type === 'assigned') return 'handed to an agent'
  if (i.type === 'comment') return 'commented on'
  return 'updated'
}

function ThanksButton({ userId, leadId }) {
  const [state, setState] = useState('idle')
  if (!userId) return null
  const send = async (e) => {
    e.stopPropagation()
    setState('busy')
    try {
      const r = await axiosClient.post('/live/thanks', { toUserId: userId, leadId })
      setState('done')
      toast.success(r.data.data.sent ? 'Thanks sent 🙏' : 'You already thanked them today')
    } catch { setState('idle'); toast.error('Couldn’t send your thanks') }
  }
  return (
    <button type="button" onClick={send} disabled={state !== 'idle'}
      className={`mac-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex-shrink-0 ${state === 'done'
        ? 'border-[#F43F5E]/40 text-[#F43F5E] bg-[#F43F5E]/10' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F43F5E]/50 hover:text-[#F43F5E]'}`}>
      {state === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === 'done' ? <Heart className="w-3.5 h-3.5 fill-current mac-pop" /> : null}
      {state === 'done' ? 'Thanked' : 'Say thanks'}
    </button>
  )
}

export function HappeningFeed({ board, loading }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const fresh = useRef(new Set())
  const seen = useRef(null)
  if (board && !seen.current) seen.current = new Set(board.feed.map((i) => i._id))
  board?.feed.forEach((i) => { if (seen.current && !seen.current.has(i._id)) { fresh.current.add(i._id); seen.current.add(i._id) } })

  const watching = (board?.watching ?? []).map((w) => ({
    _id: `watch-${w.userId}-${w.leadId}`, type: 'watching', at: w.since, actor: { id: w.userId, name: w.name, role: w.role }, lead: { id: w.leadId, name: w.leadName },
    company: w.company, kind: w.kind,
  }))
  const items = useMemo(() => {
    const feed = (board?.feed ?? []).filter((i) => filter === 'all' || (filter === 'moved' ? MOVED.includes(i.type) : i.type === filter))
    return [...(filter === 'all' || filter === 'viewed' ? watching : []), ...feed]
  }, [board, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glass-in rounded-3xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden" style={{ '--d': '120ms' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F1EFEC] dark:border-[#232323]">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-[#111111] dark:text-white">
          Happening to your leads
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#059669] dark:text-[#34D399]">
            <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-current animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-current" /></span>LIVE
          </span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${filter === k ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <ul className="thin-scroll max-h-[470px] overflow-y-auto divide-y divide-[#F5F5F4] dark:divide-[#202020]">
        {loading && Array.from({ length: 5 }, (_, i) => <li key={i} className="px-6 py-4"><Skeleton className="h-12" /></li>)}
        {!loading && items.length === 0 && (
          <li className="py-14 text-center text-sm text-[#9CA3AF]">Nothing yet — when someone opens, calls or moves one of your leads, you&apos;ll see it here first.</li>
        )}
        {items.map((i, n) => {
          const watchingNow = i.type === 'watching'
          const [Icon, color] = watchingNow ? [Eye, '#3B82F6'] : badgeOf(i.type)
          const sub = watchingNow
            ? <span className="text-[#2563EB] dark:text-[#60A5FA] font-medium">{i.kind === 'typing' ? 'Writing a comment now' : i.kind === 'on_call' ? 'On a call now' : 'Viewing now'} · {ROLE[i.actor.role] ?? ''}{i.company ? ` · ${i.company}` : ''}</span>
            : i.type === 'call' && i.meta?.notes ? `“${i.meta.notes}”`
              : i.type === 'comment' && i.meta?.text ? `“${i.meta.text}”`
                : i.type === 'status' && i.meta?.system ? `${i.place ?? ''} · moved automatically as the callback date got close`
                  : [i.place, ROLE[i.actor.role]].filter(Boolean).join(' · ')
          return (
            <li key={i._id}>
              <div role="button" tabIndex={0} onClick={() => i.lead && navigate(`${LEADS}?lead=${i.lead.id}`)} onKeyDown={(e) => e.key === 'Enter' && i.lead && navigate(`${LEADS}?lead=${i.lead.id}`)}
                className={`${fresh.current.has(i._id) ? 'feed-arrive' : 'mac-in'} flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] ${watchingNow ? 'bg-[#3B82F6]/[0.04]' : ''}`}
                style={{ '--d': `${Math.min(n, 10) * 35}ms` }}>
                <span className="relative w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0"
                  style={{ backgroundColor: i.actor.id ? tone(i.actor.id) : '#BFDBFE' }}>
                  {i.actor.id ? initials(i.actor.name) : <Sparkles className="w-4 h-4" />}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#181818] ${watchingNow ? 'animate-pulse' : ''}`} style={{ backgroundColor: '#111111' }}>
                    <Icon className="w-3 h-3" style={{ color }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-[#6B7280] dark:text-[#A1A1AA] leading-snug">
                    <b className="font-semibold text-[#111111] dark:text-white">{i.actor.name}</b> {watchingNow ? 'is looking at' : sentence(i)}{' '}
                    {i.lead && <b className="font-semibold text-[#F43F5E] uppercase">{i.lead.name}</b>}
                  </span>
                  <span className="block text-[13px] text-[#9CA3AF] truncate mt-0.5">{sub}</span>
                </span>
                <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{watchingNow ? 'now' : ago(i.at)}</span>
                {i.actor.id && i.actor.role !== 'system' && <ThanksButton userId={i.actor.id} leadId={i.lead?.id} />}
              </div>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={() => navigate(LEADS)} className="w-full px-6 py-3.5 text-left text-sm font-semibold text-[#F43F5E] border-t border-[#F1EFEC] dark:border-[#232323] hover:bg-[#F43F5E]/5">
        See all your leads
      </button>
    </div>
  )
}

/* ─── Deals you started ─────────────────────────────────────────────────── */

export function DealsStarted({ deals }) {
  const navigate = useNavigate()
  return (
    <div className="glass-in rounded-3xl p-6 border border-[#10B981]/40 bg-gradient-to-br from-[#10B981]/[0.10] to-transparent dark:from-[#10B981]/[0.14]" style={{ '--d': '160ms' }}>
      <p className="text-xs font-bold uppercase tracking-widest text-[#059669] dark:text-[#34D399]">Deals you started</p>
      {!deals ? <Skeleton className="h-28 mt-4" /> : (
        <>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-5xl font-bold text-[#111111] dark:text-white tabular-nums">{deals.count}</span>
            <span className="text-lg font-semibold text-[#059669] dark:text-[#34D399]">landlord{deals.count === 1 ? '' : 's'} helped</span>
          </p>
          <p className="mt-2 text-sm text-[#6B7280] dark:text-[#A1A1AA]">Each one began with a call you made.{deals.closedThisMonth ? ` ${deals.closedThisMonth} of them closed this month.` : ''}</p>
          <ul className="mt-4 space-y-2">
            {deals.list.map((d, i) => (
              <li key={d.id}>
                <button type="button" onClick={() => navigate(`${LEADS}?lead=${d.id}`)}
                  className="mac-slide-in w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-white/[0.04] border border-[#10B981]/15 hover:border-[#10B981]/40 text-left"
                  style={{ '--d': `${240 + i * 60}ms` }}>
                  <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-[#111111] dark:text-white truncate">{d.label} · {d.area ?? d.name}</span>
                  <span className="text-xs text-[#059669] dark:text-[#34D399] whitespace-nowrap">{isToday(new Date(d.at)) ? 'today' : formatDistanceToNowStrict(new Date(d.at), { addSuffix: true })}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ─── This month ────────────────────────────────────────────────────────── */

export function MonthCard({ milestone, rank, hotLeadPoints, conversion }) {
  const navigate = useNavigate()
  if (!milestone) return <div className="rounded-3xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-6"><Skeleton className="h-36" /></div>
  const target = milestone.target || 10
  const cur = milestone.current ?? 0
  const blocks = Math.min(10, target)
  const filled = Math.round((cur / target) * blocks)
  const left = Math.max(0, target - cur)
  const away = milestone.unit?.startsWith('leads') && conversion ? Math.ceil(left / (conversion / 100) / 10) * 10 : null
  return (
    <div className="glass-in rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]" style={{ '--d': '200ms' }}>
      <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">This month</p>
      <p className="mt-2 text-xl font-bold text-[#111111] dark:text-white">{target.toLocaleString()} {milestone.unit?.replace(' this month', '') ?? 'leads'} milestone</p>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: blocks }, (_, i) => (
          <span key={i} className="mac-pop flex-1 h-4 rounded-md" style={{ backgroundColor: i < filled ? '#E11D48' : 'rgb(156 163 175 / 0.18)', '--d': `${240 + i * 45}ms` }} />
        ))}
      </div>
      <p className="mt-3 text-sm text-[#6B7280] dark:text-[#A1A1AA]">
        {cur.toLocaleString()} of {target.toLocaleString()}{cur >= target ? ' — done!' : cur >= target / 2 ? ' — halfway there.' : '.'}
        {away && left > 0 ? ` At ${conversion}% that's about ${away.toLocaleString()} calls away.` : ''}
      </p>
      {rank && (
        <button type="button" onClick={() => navigate('/cold-caller/leaderboard')}
          className="mac-press group mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FAFAF9] dark:bg-[#111111] border border-[#F1EFEC] dark:border-[#232323] hover:border-[#F95C4B]/40 text-left">
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-[#111111] dark:text-white">
              {rank.pointsToNext ? `${rank.pointsToNext} point${rank.pointsToNext === 1 ? '' : 's'} to move up` : 'You’re #1 this month'}
            </span>
            <span className="block text-xs text-[#9CA3AF]">#{rank.rank} of {rank.total} · {Math.round(rank.score).toLocaleString()} points · one hot lead = +{hotLeadPoints}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#F95C4B] group-hover:translate-x-0.5 transition-all" />
        </button>
      )}
    </div>
  )
}

/* ─── Your leads on the move ────────────────────────────────────────────── */

const STEPS = [['found', 'Found'], ['followed', 'Followed up'], ['agent', 'With agent'], ['listed', 'Listed'], ['closed', 'Closed']]
const STEP_COLOR = ['#F59E0B', '#8B5CF6', '#F43F5E', '#10B981']

export function LeadsOnTheMove({ moving }) {
  const navigate = useNavigate()
  if (!moving?.length) return null
  return (
    <section className="glass-in" style={{ '--d': '240ms' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-[#111111] dark:text-white">Your leads on the move</h3>
        <button type="button" onClick={() => navigate(LEADS)} className="text-sm font-semibold text-[#F43F5E] hover:underline">All my leads</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {moving.slice(0, 3).map((m, i) => {
          const reached = [true, m.progress.followed, m.progress.agent, m.progress.listed, m.progress.closed]
          const color = STEP_COLOR[i % STEP_COLOR.length]
          const l = m.latest
          return (
            <button key={m.id} type="button" onClick={() => navigate(`${LEADS}?lead=${m.id}`)}
              className="mac-in mac-lift text-left rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]" style={{ '--d': `${280 + i * 70}ms` }}>
              <p className="text-[15px] font-bold text-[#111111] dark:text-white uppercase tracking-tight truncate">{m.name}</p>
              <p className="text-sm text-[#9CA3AF] truncate">{m.place}</p>
              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {STEPS.map(([k, label], s) => (
                  <span key={k}>
                    <span className="mac-grow-x block h-1.5 rounded-full" style={{ backgroundColor: reached[s] ? color : 'rgb(156 163 175 / 0.22)', '--d': `${320 + i * 70 + s * 50}ms` }} />
                    <span className={`block mt-1.5 text-[11px] font-semibold ${reached[s] ? 'text-[#111111] dark:text-white' : 'text-[#9CA3AF]'}`}>{label}</span>
                  </span>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: l.byId ? tone(l.byId) : '#BFDBFE' }}>{initials(l.by)}</span>
                <span className="truncate">{l.by?.split(' ')[0]} {sentence(l).replace(' of', '').replace(' on', '')} · {ago(l.at)}{ago(l.at) === 'now' || ago(l.at) === 'Yesterday' ? '' : ' ago'}</span>
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Today's list ──────────────────────────────────────────────────────── */

export function TodaysList({ today, overview }) {
  const navigate = useNavigate()
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem(`rt-today-${new Date().toDateString()}`) ?? '[]') } catch { return [] } })
  const toggle = (k) => setDone((d) => {
    const n = d.includes(k) ? d.filter((x) => x !== k) : [...d, k]
    try { localStorage.setItem(`rt-today-${new Date().toDateString()}`, JSON.stringify(n)) } catch { /* private mode */ }
    return n
  })
  if (!today) return null
  const k = overview?.kpis
  const rows = [
    today.callbacks.length > 0 && { key: 'callbacks', title: `Call back ${today.callbacks.length} landlord${today.callbacks.length === 1 ? '' : 's'} who asked`, sub: today.callbacks.slice(0, 3).map((c) => c.name).join(' · '), time: '5 min', action: 'Call', to: '/cold-caller/contacts?outcome=callback_requested' },
    today.followUps.length > 0 && { key: 'followups', title: `${today.followUps.length} lead follow-up${today.followUps.length === 1 ? '' : 's'} due today`, sub: today.followUps.map((f) => f.name).join(' · '), time: '10 min', action: 'Open', to: `${LEADS}?focus=due_today` },
    k?.followUpsOverdue > 0 && { key: 'overdue', title: `${k.followUpsOverdue} overdue follow-up${k.followUpsOverdue === 1 ? '' : 's'}`, sub: 'Set a new callback date so they don’t go cold', time: '10 min', action: 'Open', to: `${LEADS}?focus=overdue` },
    today.noDate > 0 && { key: 'nodate', title: `Give ${today.noDate} lead${today.noDate === 1 ? '' : 's'} a callback date`, sub: 'Leads with a date get followed up — and heat up on their own', time: '15 min', action: 'Fix', to: `${LEADS}?focus=no_followup_date` },
    k?.apptsToday > 0 && { key: 'visits', title: `${k.apptsToday} visit${k.apptsToday === 1 ? '' : 's'} today`, sub: 'Check the times and who’s going', time: '2 min', action: 'View', to: '/cold-caller/appointments' },
    k?.toCall > 0 && { key: 'call', title: `Work through your list — ${k.toCall.toLocaleString()} contacts waiting`, sub: 'Every call is a chance at a lead', time: 'all day', action: 'Call', to: '/cold-caller/contacts' },
  ].filter(Boolean)
  return (
    <div className="glass-in rounded-3xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden" style={{ '--d': '280ms' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1EFEC] dark:border-[#232323]">
        <h3 className="text-lg font-bold text-[#111111] dark:text-white">Today&apos;s list</h3>
        <span className="text-sm text-[#9CA3AF]">{done.length ? `${done.length} of ${rows.length} done` : 'Small jobs first — they count'}</span>
      </div>
      <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
        {rows.length === 0 && <li className="py-10 text-center text-sm text-[#9CA3AF]"><CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-[#10B981]" />All clear for today.</li>}
        {rows.map((r, i) => {
          const isDone = done.includes(r.key)
          return (
            <li key={r.key} className="mac-in flex items-center gap-4 px-6 py-4" style={{ '--d': `${300 + i * 50}ms` }}>
              <button type="button" onClick={() => toggle(r.key)} aria-label={isDone ? 'Mark not done' : 'Mark done'}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isDone ? 'bg-[#10B981] border-[#10B981] scale-105' : 'border-[#D4D4D8] dark:border-[#3F3F46] hover:border-[#10B981]'}`}>
                {isDone && <Check className="w-4 h-4 text-white mac-pop" strokeWidth={3} />}
              </button>
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] font-semibold ${isDone ? 'line-through text-[#9CA3AF]' : 'text-[#111111] dark:text-white'}`}>{r.title}</span>
                <span className="block text-sm text-[#9CA3AF] truncate">{r.sub}</span>
              </span>
              <span className="hidden sm:flex items-center gap-1 text-xs text-[#9CA3AF] whitespace-nowrap"><CalendarClock className="w-3.5 h-3.5" />{r.time}</span>
              <button type="button" onClick={() => navigate(r.to)}
                className="mac-press px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F43F5E]/50 hover:text-[#F43F5E]">{r.action}</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
