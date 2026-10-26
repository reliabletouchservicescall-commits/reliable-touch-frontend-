import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  TrendingUp, Phone, PhoneCall, CalendarClock, CalendarCheck, Flame, Home, RefreshCw, Clock, Sparkles, Handshake,
  Trophy, Crown, ShieldCheck, Users, BookUser, ArrowRight,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import { agenciesApi } from '../../services/agenciesApi'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import {
  DashboardHeader, FunnelStrip, NeedsAttention, OnTheFloor, LiveActivity, LeadTemperature, LeadingThisMonth, SourcesReport,
  useLiveFloor, useLiveOverview, useAttentionItems, useNow,
} from '../../components/dashboard/LiveOps'
import {
  Card, CardTitle, LinkButton, Skeleton, ErrorBanner, Hero, Milestone, Kpi, Pipeline, TemperatureDonut, IntentBars,
  TrendChart, ChartLegend, CallsByHourChart, ProvincePanel, TodaysTasks, RecentActivity, PhotoCard,
  CallOutcomes, UpcomingVisits, CORAL, CORAL_3, STATUS_COLORS, STATUS_LABEL,
} from '../../components/dashboard/DashboardKit'

// The company dashboard — same look and motion as the admin command centre, scoped by
// GET /reports/agency-overview: a company manager sees the whole company and the team
// table, an agent sees only their own book and where they stand. A manager also gets the
// live board admin has, for their own company (GET /live/*, agencyLive.service.js): who in
// the team is working right now and who hasn't today, the live feed, what needs them, and
// what happens to the leads Reliable Touch gave them against the ones they found.

const OWN_SOURCE = 'agency_self_sourced'
const RT_SOURCE = 'reliable_touch'

const DAILY_SERIES = [
  { key: 'calls',    name: 'Calls',                color: CORAL,     kind: 'area' },
  { key: 'own',      name: 'Leads generated',      color: 'ink',     kind: 'line', axis: 'right' },
  { key: 'assigned', name: 'Leads received',       color: '#8B5CF6', kind: 'line', axis: 'right' },
  { key: 'closed',   name: 'Deals closed',         color: '#10B981', kind: 'line', axis: 'right', dashed: true },
]
const WEEKLY_SERIES = [
  { key: 'own',      name: 'Leads generated',      color: CORAL,     kind: 'line', dots: true, width: 3 },
  { key: 'assigned', name: 'From Reliable Touch',  color: 'ink',     kind: 'line', dots: true, width: 2.5 },
  { key: 'closed',   name: 'Deals closed',         color: '#10B981', kind: 'line', dots: true, dashed: true },
]

/* ─── Own vs handed-over ─────────────────────────────────────────────────── */

const SPLIT_PARTS = [
  { key: 'hot',    label: 'Hot / negotiating', color: CORAL },
  { key: 'warm',   label: 'Warm',              color: '#F59E0B' },
  { key: 'cold',   label: 'Cold',              color: '#D4D4D8' },
  { key: 'closed', label: 'Closed',            color: '#10B981' },
  { key: 'lost',   label: 'Lost',              color: '#6B7280' },
]

function SourceSplit({ sources }) {
  const navigate = useNavigate()
  const total = sources.reduce((a, s) => a + s.count, 0) || 1
  return (
    <div className="space-y-4">
      {/* Share of the book */}
      <div className="flex h-3 rounded-full overflow-hidden bg-[#F5F5F4] dark:bg-[#202020]">
        {sources.map((s, i) => (
          <div key={s.key} className="mac-grow-x h-full" title={`${s.label}: ${s.count}`}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: i === 0 ? CORAL : '#111111', '--d': `${200 + i * 120}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 gap-3">
        {sources.map((s, i) => (
          <button key={s.key} type="button"
            onClick={() => navigate(`/agency/leads?source=${s.key === 'own' ? OWN_SOURCE : RT_SOURCE}`)}
            className="mac-in mac-lift mac-press group text-left p-3.5 rounded-xl border border-[#F1EFEC] dark:border-[#2A2A2A] hover:border-[#F95C4B]/40"
            style={{ '--d': `${220 + i * 80}ms` }}>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-[#F95C4B]/12' : 'bg-[#111111]/8 dark:bg-white/10'}`}>
                {i === 0 ? <Sparkles className="w-3.5 h-3.5 text-[#F95C4B]" /> : <Handshake className="w-3.5 h-3.5 text-[#111111] dark:text-white" />}
              </span>
              <p className="text-xs font-semibold text-[#111111] dark:text-white flex-1">{s.label}</p>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4D4D8] dark:text-[#3F3F46] group-hover:text-[#F95C4B] transition-colors" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight leading-none"><AnimatedNumber value={s.count} /></p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] pb-0.5">leads · <span className={`font-semibold ${s.conversion >= 20 ? 'text-[#16A34A]' : ''}`}>{s.conversion}%</span> closed</p>
            </div>
            {/* Status make-up of this half of the book */}
            <div className="flex h-1.5 rounded-full overflow-hidden bg-[#F5F5F4] dark:bg-[#202020] mt-3">
              {SPLIT_PARTS.map((p) => (s[p.key] ? (
                <div key={p.key} className="mac-grow-x h-full" title={`${p.label}: ${s[p.key]}`}
                  style={{ width: `${(s[p.key] / (s.count || 1)) * 100}%`, backgroundColor: p.color, '--d': `${380 + i * 80}ms` }} />
              ) : null))}
            </div>
            <div className="grid grid-cols-3 gap-1 mt-2.5 text-center">
              {[['hot', 'Hot'], ['closed', 'Closed'], ['cold', 'Cold']].map(([k, label]) => (
                <div key={k} className="rounded-lg bg-[#FAFAF9] dark:bg-[#111111] py-1">
                  <p className="text-xs font-bold text-[#111111] dark:text-white tabular-nums">{s[k]}</p>
                  <p className="text-[9px] uppercase tracking-wide text-[#9CA3AF]">{label}</p>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {SPLIT_PARTS.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />{p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Team (manager) / standing (agent) ─────────────────────────────────── */

function MiniBar({ value, max, color = CORAL, delay = 0 }) {
  return (
    <div className="h-1 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden mt-1">
      <div className="mac-grow-x h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, backgroundColor: color, '--d': `${delay}ms` }} />
    </div>
  )
}

function TeamTable({ members }) {
  const navigate = useNavigate()
  if (!members?.length) return <p className="text-xs text-[#9CA3AF] py-8 text-center">No active team members yet</p>
  const maxOf = (fn) => Math.max(1, ...members.map(fn))
  const mx = { calls: maxOf((m) => m.calls), gen: maxOf((m) => m.generated), book: maxOf((m) => m.book.total), closed: maxOf((m) => m.closedMonth) }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[860px] text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
            {['#', 'Agent', 'Calls', 'Leads generated', 'Their book', 'From RT / own', 'Hot', 'Closed', 'Visits', 'Conversion'].map((h) => (
              <th key={h} className={`font-semibold px-3 py-2.5 ${h === '#' || h === 'Agent' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.userId} onClick={() => navigate(`/agency/agents/${m.userId}`)}
              className="mac-in cursor-pointer border-t border-[#F5F5F4] dark:border-[#202020] hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors"
              style={{ '--d': `${120 + i * 40}ms` }}>
              <td className="px-3 py-2.5">
                <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center text-[11px] font-bold ${i === 0 && (m.closedMonth || m.calls) ? 'bg-[#F95C4B] text-white' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                  {i === 0 && (m.closedMonth || m.calls) ? <Trophy className="w-3.5 h-3.5" /> : m.rank}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ${m.isAgencyManager ? 'bg-[#F95C4B]' : 'bg-[#111111] dark:bg-[#3F3F46]'}`}>
                    {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111111] dark:text-white truncate max-w-[180px]">{m.name}</p>
                    {m.isAgencyManager && <p className="inline-flex items-center gap-1 text-[10px] text-[#F95C4B]"><ShieldCheck className="w-3 h-3" /> Manager</p>}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right w-[90px]"><span className="font-semibold text-[#111111] dark:text-white tabular-nums">{m.calls}</span><MiniBar value={m.calls} max={mx.calls} delay={200 + i * 40} /></td>
              <td className="px-3 py-2.5 text-right w-[110px]"><span className="font-semibold text-[#111111] dark:text-white tabular-nums">{m.generated}</span><MiniBar value={m.generated} max={mx.gen} color="#111111" delay={220 + i * 40} /></td>
              <td className="px-3 py-2.5 text-right w-[90px]"><span className="font-semibold text-[#111111] dark:text-white tabular-nums">{m.book.total}</span><MiniBar value={m.book.total} max={mx.book} color={CORAL_3} delay={240 + i * 40} /></td>
              <td className="px-3 py-2.5 text-right text-[#6B7280] dark:text-[#A1A1AA] tabular-nums">{m.book.assigned} / {m.book.own}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#EF4444]">{m.book.hot}</td>
              <td className="px-3 py-2.5 text-right tabular-nums"><span className="font-bold text-[#10B981]">{m.closedMonth}</span><span className="text-[10px] text-[#9CA3AF]"> / {m.book.closed}</span></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#111111] dark:text-white whitespace-nowrap">{m.visits}<span className="text-[10px] text-[#9CA3AF]"> · {m.visitsDone} done</span></td>
              <td className="px-3 py-2.5 text-right">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.conversion >= 20 ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]'}`}>{m.conversion}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-[#9CA3AF] mt-3 px-3">
        Calls, leads generated, closed and visits are for this month. &ldquo;Their book&rdquo; is every lead with them right now; closed shows this month / all time. Tap a row for the agent's full detail.
      </p>
    </div>
  )
}

function Standing({ standing }) {
  if (!standing) return <p className="text-xs text-[#9CA3AF] py-8 text-center">Your standing will show once you're on an active team</p>
  const rows = [
    { key: 'calls',       label: 'Calls',            icon: PhoneCall,     color: CORAL },
    { key: 'generated',   label: 'Leads generated',  icon: Sparkles,      color: '#111111' },
    { key: 'closedMonth', label: 'Deals closed',     icon: Home,          color: '#10B981' },
    { key: 'visits',      label: 'Visits',           icon: CalendarCheck, color: '#8B5CF6' },
  ]
  const top = standing.rank === 1
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
      <div className="mac-pop flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-gradient-to-br from-[#F95C4B]/12 to-[#F95C4B]/0 border border-[#F95C4B]/20" style={{ '--d': '200ms' }}>
        <span className="w-12 h-12 rounded-2xl bg-[#F95C4B] text-white flex items-center justify-center mac-float">
          {top ? <Crown className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
        </span>
        <p className="text-3xl font-bold text-[#111111] dark:text-white mt-3 tracking-tight">#{standing.rank}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">of {standing.of} on your team this month</p>
        <p className="text-[11px] font-semibold text-[#F95C4B] mt-2">{top ? 'You are leading the team' : 'Close more deals to climb'}</p>
      </div>
      <ul className="space-y-4">
        {rows.map((r, i) => {
          const mine = standing[r.key]
          const avg = standing.teamAvg?.[r.key] ?? 0
          const max = Math.max(1, mine, avg)
          const ahead = mine >= avg
          return (
            <li key={r.key} className="mac-slide-in" style={{ '--d': `${220 + i * 60}ms` }}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 font-medium text-[#111111] dark:text-white">
                  <r.icon className={`w-3.5 h-3.5 ${r.color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color: r.color }} />{r.label}
                </span>
                <span className="text-[#6B7280] dark:text-[#A1A1AA] tabular-nums">
                  <span className="font-bold text-[#111111] dark:text-white">{mine}</span> you · {avg} team avg
                  <span className={`ml-1.5 font-semibold ${ahead ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{ahead ? '▲' : '▼'}</span>
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                  <div className="mac-grow-x h-full rounded-full" style={{ width: `${(mine / max) * 100}%`, backgroundColor: r.color === '#111111' ? CORAL : r.color, '--d': `${300 + i * 60}ms` }} />
                </div>
                <div className="h-1 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                  <div className="mac-grow-x h-full rounded-full bg-[#D4D4D8] dark:bg-[#52525B]" style={{ width: `${(avg / max) * 100}%`, '--d': `${340 + i * 60}ms` }} />
                </div>
              </div>
            </li>
          )
        })}
        <li className="text-[10px] text-[#9CA3AF]">
          Your book: <b className="text-[#111111] dark:text-white">{standing.book.total}</b> leads ({standing.book.assigned} from Reliable Touch, {standing.book.own} generated by you) · {standing.conversion}% closed
        </li>
      </ul>
    </div>
  )
}

/* ─── Recent leads & visits ──────────────────────────────────────────────── */

const LEAD_TABS = [
  { key: 'all',      label: 'All leads',            test: () => true },
  { key: 'hot',      label: 'Hot',                  test: (l) => l.status === 'hot' },
  { key: 'followup', label: 'Follow-up due',        test: (l) => l.followUpDate && new Date(l.followUpDate) <= new Date() && !['listed', 'rented_out', 'sold', 'lost'].includes(l.status) },
  { key: 'own',      label: 'Generated',            test: (l) => l.source === 'own' },
  { key: 'assigned', label: 'From Reliable Touch',  test: (l) => l.source === 'assigned' },
]

function RecentLeads({ leads, isManager }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const rows = (leads ?? []).filter(LEAD_TABS.find((t) => t.key === tab).test).slice(0, 8)
  const heads = ['Owner / Property', 'Area', 'Source', 'Intent', 'Status', 'Follow-up', ...(isManager ? ['With'] : []), 'Added']
  return (
    <>
      <div className="flex gap-1 border-b border-[#E5E7EB] dark:border-[#2A2A2A] mb-1 overflow-x-auto">
        {LEAD_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`relative px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.key ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
            {t.label}
            {tab === t.key && <span className="mac-grow-x absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#F95C4B]" />}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
              {heads.map((h) => <th key={h} className="text-left font-semibold px-3 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody key={tab}>
            {rows.length === 0 ? (
              <tr><td colSpan={heads.length} className="px-3 py-10 text-center text-[#9CA3AF]">Nothing here right now</td></tr>
            ) : rows.map((l, i) => {
              const color = STATUS_COLORS[l.status] ?? '#9CA3AF'
              const overdue = l.followUpDate && new Date(l.followUpDate) < new Date()
              return (
                <tr key={l._id} onClick={() => navigate(`/agency/leads/${l._id}`)}
                  className="mac-in cursor-pointer border-t border-[#F5F5F4] dark:border-[#202020] hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors"
                  style={{ '--d': `${i * 40}ms` }}>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">{l.propertyAddress}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">{l.area ?? '—'}{l.province ? <span className="block text-[10px] text-[#9CA3AF]">{l.province}</span> : null}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${l.source === 'own' ? 'bg-[#F95C4B]/10 text-[#F95C4B]' : 'bg-[#111111]/8 dark:bg-white/10 text-[#111111] dark:text-white'}`}>
                      {l.source === 'own' ? 'Generated' : 'Reliable Touch'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA]">{l.listingType === 'rental' ? 'Rent' : l.listingType === 'sale' ? 'Sell' : '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color, backgroundColor: `${color}1A` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />{STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${overdue ? 'text-[#DC2626] font-semibold' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                    {l.followUpDate ? format(new Date(l.followUpDate), 'd MMM yyyy') : '—'}
                  </td>
                  {isManager && (
                    <td className="px-3 py-2.5 max-w-[150px] truncate">
                      {l.agent ? <span className="text-[#111111] dark:text-white">{l.agent}</span> : <span className="text-[#F59E0B] font-medium">Not with anyone</span>}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-[#9CA3AF] whitespace-nowrap">{formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AgencyDashboard() {
  const { user } = useAuthStore()
  const { theme } = useTheme() ?? {}
  const isDark = theme === 'dark'
  const isManager = Boolean(user?.isAgencyManager)
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const freshRef = useRef(false) // set by the refresh button to bypass the server's 60s cache

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { data: o, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['agency-overview', user?._id],
    queryFn: () => axiosClient.get('/reports/agency-overview', { params: freshRef.current ? { fresh: 'true' } : undefined }).then((r) => r.data.data),
    staleTime: 55_000,
    refetchInterval: 60_000,
  })

  const { data: agency } = useQuery({
    queryKey: ['agency', user?.agencyId],
    queryFn: () => agenciesApi.getById(user.agencyId).then((r) => r.data.data.agency),
    enabled: Boolean(user?.agencyId),
    staleTime: 5 * 60_000,
  })

  function refreshNow() {
    freshRef.current = true
    refetch().finally(() => { freshRef.current = false })
  }

  // Live board (managers)
  const [period, setPeriod] = useState(() => { try { return localStorage.getItem('rt-dash-period') || 'month' } catch { return 'month' } })
  const choosePeriod = (p) => { setPeriod(p); try { localStorage.setItem('rt-dash-period', p) } catch { /* private mode */ } }
  const tick = useNow(15_000)
  const { data: floor, isLoading: floorLoading } = useLiveFloor(isManager)
  const { data: live, isLoading: liveLoading } = useLiveOverview(isManager)
  const attention = useAttentionItems(live, floor, tick, 'agency')

  const k = o?.kpis
  const you = isManager ? 'your team' : 'you'
  const kpiCards = useMemo(() => [
    { icon: TrendingUp, label: isManager ? 'Company leads' : 'My leads', value: k?.totalLeads, sub: `${(k?.leadsThisWeek ?? 0).toLocaleString()} new this week`, trend: k?.leadsWeekChangePct, to: '/agency/leads' },
    { icon: Sparkles, label: `Generated by ${you}`, value: k?.ownLeads, sub: 'Self-sourced leads', to: `/agency/leads?source=${OWN_SOURCE}`, tone: '#111111' },
    { icon: Handshake, label: 'From Reliable Touch', value: k?.assignedLeads, sub: 'Leads handed to you', to: `/agency/leads?source=${RT_SOURCE}`, tone: '#8B5CF6' },
    { icon: Phone, label: 'Calls this week', value: k?.callsWeek, sub: `Today ${k?.callsToday ?? 0} · Month ${(k?.callsMonth ?? 0).toLocaleString()}`, to: '/agency/contacts' },
    { icon: CalendarClock, label: 'Follow-ups due', value: k?.followUpsDue, sub: `Today ${k?.followUpsToday ?? 0} · Overdue ${k?.followUpsOverdue ?? 0}`, to: '/agency/leads?focus=overdue', tone: '#F59E0B' },
    { icon: Home, label: 'Closed this month', value: k?.closedThisMonth, sub: 'Listed, rented or sold', to: '/agency/leads?focus=closed_month', tone: '#10B981' },
  ], [k, isManager, you])

  const stageTo = {
    contacts: '/agency/contacts',
    called: '/agency/contacts',
    leads: '/agency/leads',
    hot: '/agency/leads?status=hot',
    visits: '/agency/appointments',
    closed: '/agency/leads?focus=closed_month',
  }
  // Donut slices / legend rows open the matching leads ("Closed" spans three statuses)
  const pickTemperature = (key) => {
    if (!key) return
    navigate(key === 'closed' ? '/agency/leads?focus=closed_month' : `/agency/leads?status=${key}`)
  }

  return (
    <div className="relative p-4 sm:p-6 xl:p-8 space-y-6">
      {isManager && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
            <span className="aurora w-[520px] h-[240px] -top-24 left-[4%] bg-[#F95C4B]/18 dark:bg-[#F95C4B]/14" />
            <span className="aurora w-[420px] h-[200px] -top-16 right-[8%] bg-[#8B5CF6]/14 dark:bg-[#8B5CF6]/10" style={{ animationDelay: '-9s', animationDuration: '28s' }} />
            <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FAFAF9] dark:to-[#0B0B0B]" />
          </div>
          <DashboardHeader user={user} floor={floor} needsCount={liveLoading ? null : attention.length} period={period} onPeriod={choosePeriod} scope="agency" company={live?.company ?? agency?.name} />
          <div className="relative"><FunnelStrip period={period} /></div>
          <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
            <NeedsAttention items={attention} loading={liveLoading} />
            <OnTheFloor floor={floor} loading={floorLoading} now={tick} scope="agency" />
          </div>
          <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
            <LiveActivity scope="agency" />
            <div className="space-y-6">
              <LeadTemperature temperature={live?.temperature} scope="agency" />
              <LeadingThisMonth leaders={live?.leaders} scope="agency" />
            </div>
          </div>
          <div className="relative"><SourcesReport sources={live?.sources} /></div>
        </>
      )}
      <div className="relative grid grid-cols-1 2xl:grid-cols-[1fr_340px] xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {!isManager && <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <Hero
              user={user}
              now={now}
              eyebrow={agency?.name}
              subtitle={isManager ? "Here's how your company is doing today." : "Here's how your leads and calls are going today."}
              stats={[
                { icon: PhoneCall, label: 'calls today', value: k?.callsToday, to: '/agency/contacts' },
                { icon: Flame, label: 'hot leads', value: k?.hot, to: '/agency/leads?status=hot' },
                { icon: CalendarCheck, label: 'visits today', value: k?.apptsToday, to: '/agency/appointments' },
              ]}
            />
            {!o ? <Skeleton className="min-h-[220px]" /> : <Milestone milestone={o.milestone} to="/agency/leaderboard" />}
          </div>}

          {isError && !o && <ErrorBanner onRetry={() => refetch()} />}

          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4">
            {!o
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[140px]" />)
              : kpiCards.map((c, i) => <Kpi key={c.label} delay={80 + i * 60} {...c} />)}
          </div>

          <Card delay={140} className="p-5">
            <CardTitle
              title={isManager ? 'Company pipeline' : 'Your pipeline'}
              subtitle="From your contacts to a closed deal — tap a stage to open it"
              action={<LinkButton to="/agency/leads">View all leads</LinkButton>}
            />
            {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} stageTo={stageTo} />}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
            <div className="grid grid-cols-1 gap-6 content-start">
              <Card delay={200} className="p-5">
                <CardTitle title="Generated vs handed over" subtitle={isManager ? 'Leads your team found themselves against leads from Reliable Touch' : 'Leads you found yourself against leads from Reliable Touch'} />
                {!o ? <Skeleton className="h-[220px]" /> : <SourceSplit sources={o.sources} />}
              </Card>
              <Card delay={240} className="p-5">
                <CardTitle title="Lead temperature" subtitle="Where every lead stands right now — tap one to see them" />
                {!o ? <Skeleton className="h-[170px]" /> : <TemperatureDonut temperature={o.temperature} total={k.totalLeads} isDark={isDark} onPick={pickTemperature} />}
              </Card>
              <Card delay={260} className="p-5">
                <CardTitle title="Property intent" subtitle="What owners want to do" />
                {!o ? <Skeleton className="h-[140px]" /> : <IntentBars intent={o.intent} />}
              </Card>
            </div>
            <div className="min-w-0">
              <Card delay={180} className="p-5">
                <CardTitle title="Leads by province" subtitle="Tap a province · darker coral = more leads" action={isManager ? <LinkButton to="/agency/areas">Areas</LinkButton> : null} />
                {!o ? <Skeleton className="h-[360px]" /> : (
                  <ProvincePanel provinces={o.provinces} isDark={isDark} provinceTo={(name) => `/agency/leads?province=${encodeURIComponent(name)}`} fixAreasTo={isManager ? '/agency/areas' : undefined} />
                )}
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card delay={260} className="p-5">
              <CardTitle title="Daily activity — last 30 days" subtitle="Calls (left axis) against leads generated, received and closed (right axis)" action={<LinkButton to="/agency/contacts">Contacts</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : (
                <>
                  <TrendChart data={o.charts.daily} xKey="date" series={DAILY_SERIES} rightAxis isDark={isDark}
                    xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => format(new Date(d), 'EEE, d MMM')} />
                  <ChartLegend series={DAILY_SERIES} isDark={isDark} />
                </>
              )}
            </Card>
            <Card delay={300} className="p-5">
              <CardTitle title="Weekly trend — 12 weeks" subtitle="Leads generated vs received vs closed each week" action={<LinkButton to="/agency/leaderboard">Leaderboard</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : (
                <>
                  <TrendChart data={o.charts.weekly} xKey="weekStart" series={WEEKLY_SERIES} isDark={isDark} delay={350}
                    xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => `Week of ${format(new Date(d), 'd MMM')}`} />
                  <ChartLegend series={WEEKLY_SERIES} isDark={isDark} />
                </>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-6">
            <Card delay={320} className="p-5">
              <CardTitle title={isManager ? 'When your team calls' : 'When you call'} subtitle="Calls by hour of day, last 30 days — peak hour in full coral" />
              {!o ? <Skeleton className="h-[230px]" /> : <CallsByHourChart hours={o.charts.callsByHour} isDark={isDark} />}
            </Card>
            <Card delay={340} className="p-5">
              <CardTitle
                title="How calls end"
                subtitle={o ? `${o.callOutcomes.total.toLocaleString()} calls in the last 30 days` : 'Last 30 days'}
                action={<LinkButton to="/agency/contacts">Call contacts</LinkButton>}
              />
              {!o ? <Skeleton className="h-[230px]" /> : <CallOutcomes outcomes={o.callOutcomes} />}
            </Card>
          </div>

          <Card delay={360} className="p-5">
            {isManager ? (
              <>
                <CardTitle title="Team performance" subtitle="How each agent is doing this month — ranked by deals closed, then calls" action={<LinkButton to="/agency/team">Team</LinkButton>} />
                {!o ? <Skeleton className="h-[280px]" /> : <TeamTable members={o.team} />}
              </>
            ) : (
              <>
                <CardTitle title="Where you stand" subtitle="Your month against the team average" action={<LinkButton to="/agency/leaderboard">Leaderboard</LinkButton>} />
                {!o ? <Skeleton className="h-[220px]" /> : <Standing standing={o.standing} />}
              </>
            )}
          </Card>

          <Card delay={380} className="p-5">
            <CardTitle title="Recent leads" subtitle={isManager ? 'The newest leads in your company' : 'The newest leads in your book'} action={<LinkButton to="/agency/leads">View all</LinkButton>} />
            {!o ? <Skeleton className="h-[300px]" /> : <RecentLeads leads={o.recentLeads} isManager={isManager} />}
          </Card>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <aside className="space-y-6 min-w-0">
          {isManager && (!o ? <Skeleton className="min-h-[220px]" /> : <Milestone milestone={o.milestone} to="/agency/leaderboard" />)}
          <Card delay={120} className="p-5">
            <CardTitle
              title="Today's tasks"
              action={(
                <button type="button" onClick={refreshNow} title="Refresh now"
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]">
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  {dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm') : ''}
                </button>
              )}
            />
            {!o ? <Skeleton className="h-[300px]" /> : <TodaysTasks tasks={o.tasks} />}
          </Card>
          <Card delay={180} className="p-5">
            <CardTitle title="Upcoming visits" subtitle={`${(k?.apptsUpcoming ?? 0).toLocaleString()} booked from today`} action={<LinkButton to="/agency/appointments">All</LinkButton>} />
            {!o ? <Skeleton className="h-[200px]" /> : <UpcomingVisits visits={o.upcomingVisits} showAgent={isManager} leadPath={(id) => `/agency/leads/${id}`} allTo="/agency/appointments" />}
          </Card>
          <Card delay={240} className="p-5">
            <CardTitle title="Recent activity" subtitle={isManager ? 'Across your company' : 'On your leads'} action={<Clock className="w-4 h-4 text-[#9CA3AF]" />} />
            {!o ? <Skeleton className="h-[320px]" /> : <RecentActivity events={o.activity} />}
          </Card>
          <PhotoCard
            eyebrow={isManager ? 'Grow the book' : 'Keep dialling'}
            title={isManager ? 'More contacts, more listings' : 'Your next listing is one call away'}
            text={(
              <>
                <b className="text-white">{(k?.needsCalling ?? 0).toLocaleString()}</b> {isManager ? 'company contacts' : 'of your contacts'} haven&apos;t been called yet.
                {' '}Every one is a possible lead {isManager ? 'for your team' : 'for you'}.
              </>
            )}
            to="/agency/contacts"
            buttonLabel={isManager ? 'Hand out contacts' : 'Start calling'}
            icon={isManager ? Users : BookUser}
          />
          <p className="text-center text-[10px] text-[#9CA3AF] flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Reliable Touch Services · Lead generation · Cold calling · Follow-up · Distribution
          </p>
        </aside>
      </div>
    </div>
  )
}
