import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  TrendingUp, Phone, CalendarClock, Home, RefreshCw, Clock, Sparkles, Handshake,
  Trophy, ShieldCheck, Users, ArrowRight, Plus, AlarmClock, FileSpreadsheet, CalendarPlus, Building2, PhoneOutgoing,
  BarChart3, ChevronDown,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import { agenciesApi } from '../../services/agenciesApi'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import AgentHome, { ActionTiles } from '../../components/dashboard/AgentHome'
import { useAgentActions } from '../../components/agent/AgentActions'
import {
  DashboardHeader, FunnelStrip, NeedsAttention, OnTheFloor, LiveActivity, LeadTemperature, LeadingThisMonth, SourcesReport,
  useLiveFloor, useLiveOverview, useAttentionItems, useNow,
} from '../../components/dashboard/LiveOps'
import {
  Card, CardTitle, LinkButton, Skeleton, ErrorBanner, Milestone, Kpi, Pipeline, TemperatureDonut, IntentBars,
  TrendChart, ChartLegend, CallsByHourChart, ProvincePanel, TodaysTasks, RecentActivity,
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

/* ─── A manager's everyday jobs ─────────────────────────────────────────── */

function ManagerActions({ kpis, floor, isAdmin }) {
  const navigate = useNavigate()
  const actions = useAgentActions()
  const team = (floor?.people ?? []).filter((p) => p.role === 'agency')
  const working = team.filter((p) => p.workedToday || p.online).length
  const late = kpis?.followUpsOverdue ?? 0
  const items = [
    { key: 'lead', label: 'Add a lead', icon: Plus, sub: 'An owner who wants to sell or rent', go: () => actions?.open('lead') },
    { key: 'late', label: 'Late follow-ups', icon: AlarmClock, hot: late > 0, sub: late ? `${late} lead${late === 1 ? '' : 's'} waiting` : 'Nobody is waiting', go: () => navigate('/agency/leads?focus=overdue') },
    { key: 'files', label: 'Give out contacts', icon: FileSpreadsheet, sub: kpis ? `${(kpis.needsCalling ?? 0).toLocaleString()} not called yet` : 'Hand files to your agents', go: () => navigate('/agency/calls?tab=files') },
    { key: 'team', label: 'My team', icon: Users, sub: floor ? `${working} of ${team.length} working today` : 'Who is working', go: () => navigate('/agency/team') },
    { key: 'viewing', label: 'Book a viewing', icon: CalendarPlus, sub: kpis?.apptsToday ? `${kpis.apptsToday} today` : 'Pick a lead and a time', go: () => actions?.open('viewing') },
    isAdmin
      ? { key: 'company', label: 'Company profile', icon: Building2, sub: 'Your name, logo and colours', go: () => navigate('/agency/company-profile') }
      : { key: 'call', label: 'Start calling', icon: PhoneOutgoing, sub: 'The next owner to phone', go: () => navigate('/agency/calls?tab=next') },
  ]
  return <ActionTiles items={items} />
}

export default function AgencyDashboard() {
  const { user } = useAuthStore()
  const { theme } = useTheme() ?? {}
  const isDark = theme === 'dark'
  const isManager = Boolean(user?.isAgencyManager)
  const navigate = useNavigate()
  const freshRef = useRef(false) // set by the refresh button to bypass the server's 60s cache

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
  const [more, setMore] = useState(() => { try { return localStorage.getItem('rt-dash-more') === '1' } catch { return false } })
  const toggleMore = () => setMore((v) => { try { localStorage.setItem('rt-dash-more', v ? '0' : '1') } catch { /* private mode */ } return !v })
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

  // An agent gets their own home: what to do next, not the company's numbers
  if (!isManager) return <AgentHome overview={o} isDark={isDark} stageTo={stageTo} pickTemperature={pickTemperature} dailySeries={DAILY_SERIES} />

  // The company manager's home: what needs them, who is working and the goal — then one
  // button opens every other number (kept closed, remembered per browser).
  return (
    <div className="relative p-4 sm:p-6 xl:p-8 space-y-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        <span className="aurora w-[520px] h-[240px] -top-24 left-[4%] bg-[#F95C4B]/18 dark:bg-[#F95C4B]/14" />
        <span className="aurora w-[420px] h-[200px] -top-16 right-[8%] bg-[#F95C4B]/10 dark:bg-[#F95C4B]/8" style={{ animationDelay: '-9s', animationDuration: '28s' }} />
        <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FAFAF9] dark:to-[#0B0B0B]" />
      </div>
      <DashboardHeader user={user} floor={floor} needsCount={liveLoading ? null : attention.length} period={period} onPeriod={choosePeriod} scope="agency" company={live?.company ?? agency?.name} />

      {/* Everyday jobs — each one button */}
      <div className="relative"><ManagerActions kpis={k} floor={floor} isAdmin={Boolean(user?.isAgencyAdmin)} /></div>

      {isError && !o && <ErrorBanner onRetry={() => refetch()} />}

      {/* What needs me · who is working · the goal */}
      <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
        <div className="flex flex-col gap-6 min-w-0 xl:min-h-[460px]">
          <NeedsAttention items={attention} loading={liveLoading} />
          <Card delay={140} className="p-5">
            <CardTitle title="Where your leads are" subtitle="From a contact to a closed deal — tap a step to open it" action={<LinkButton to="/agency/leads">All leads</LinkButton>} />
            {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} stageTo={stageTo} />}
          </Card>
        </div>
        {/* On wide screens this column takes the left column's height and the team list
            scrolls inside it, so neither side leaves a gap */}
        <div className="relative">
          <div className="flex flex-col gap-6 xl:absolute xl:inset-0">
            {!o ? <Skeleton className="min-h-[220px]" /> : <Milestone milestone={o.milestone} to="/agency/team?tab=leaderboard" />}
            <OnTheFloor floor={floor} loading={floorLoading} now={tick} scope="agency" fill />
          </div>
        </div>
      </div>

      <div className="relative flex justify-center">
        <button type="button" onClick={toggleMore} aria-expanded={more}
          className="mac-press flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#111111] dark:text-white hover:border-[#F95C4B]/40 hover:text-[#F95C4B]">
          <BarChart3 className="w-4 h-4" /> {more ? 'Hide the numbers' : 'Show all the numbers'}
          <ChevronDown className={`w-4 h-4 transition-transform ${more ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {more && (
        <div className="relative space-y-6">
          <FunnelStrip period={period} />
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
            <LiveActivity scope="agency" fill />
            <div className="space-y-6 self-start">
              <LeadTemperature temperature={live?.temperature} scope="agency" />
              <LeadingThisMonth leaders={live?.leaders} scope="agency" />
            </div>
          </div>
          <SourcesReport sources={live?.sources} />

          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4">
            {!o
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[140px]" />)
              : kpiCards.map((c, i) => <Kpi key={c.label} delay={80 + i * 60} {...c} />)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
            <div className="grid grid-cols-1 gap-6 content-start">
              <Card delay={200} className="p-5">
                <CardTitle title="Generated vs handed over" subtitle="Leads your team found themselves against leads from Reliable Touch" />
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
            <Card delay={180} className="p-5 min-w-0 self-start">
              <CardTitle title="Leads by province" subtitle="Tap a province · darker = more leads" action={<LinkButton to="/agency/calls?tab=areas">Areas</LinkButton>} />
              {!o ? <Skeleton className="h-[360px]" /> : (
                <ProvincePanel provinces={o.provinces} isDark={isDark} provinceTo={(name) => `/agency/leads?province=${encodeURIComponent(name)}`} fixAreasTo="/agency/calls?tab=areas" />
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card delay={260} className="p-5">
              <CardTitle title="Daily activity — last 30 days" subtitle="Calls (left axis) against leads generated, received and closed (right axis)" />
              {!o ? <Skeleton className="h-[250px]" /> : (
                <>
                  <TrendChart data={o.charts.daily} xKey="date" series={DAILY_SERIES} rightAxis isDark={isDark}
                    xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => format(new Date(d), 'EEE, d MMM')} />
                  <ChartLegend series={DAILY_SERIES} isDark={isDark} />
                </>
              )}
            </Card>
            <Card delay={300} className="p-5">
              <CardTitle title="Weekly trend — 12 weeks" subtitle="Leads generated vs received vs closed each week" action={<LinkButton to="/agency/team?tab=leaderboard">Leaderboard</LinkButton>} />
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
              <CardTitle title="When your team calls" subtitle="Calls by hour of day, last 30 days — the busiest hour in full colour" />
              {!o ? <Skeleton className="h-[230px]" /> : <CallsByHourChart hours={o.charts.callsByHour} isDark={isDark} />}
            </Card>
            <Card delay={340} className="p-5">
              <CardTitle title="How calls end" subtitle={o ? `${o.callOutcomes.total.toLocaleString()} calls in the last 30 days` : 'Last 30 days'} />
              {!o ? <Skeleton className="h-[230px]" /> : <CallOutcomes outcomes={o.callOutcomes} />}
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
            <div className="space-y-6 min-w-0">
              <Card delay={360} className="p-5">
                <CardTitle title="Team performance" subtitle="How each agent is doing this month — ranked by deals closed, then calls" action={<LinkButton to="/agency/team">Team</LinkButton>} />
                {!o ? <Skeleton className="h-[280px]" /> : <TeamTable members={o.team} />}
              </Card>
              <Card delay={380} className="p-5">
                <CardTitle title="Recent leads" subtitle="The newest leads in your company" action={<LinkButton to="/agency/leads">View all</LinkButton>} />
                {!o ? <Skeleton className="h-[300px]" /> : <RecentLeads leads={o.recentLeads} isManager />}
              </Card>
            </div>
            <aside className="space-y-6 min-w-0">
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
                <CardTitle title="Upcoming visits" subtitle={`${(k?.apptsUpcoming ?? 0).toLocaleString()} booked from today`} action={<LinkButton to="/agency/diary">Diary</LinkButton>} />
                {!o ? <Skeleton className="h-[200px]" /> : <UpcomingVisits visits={o.upcomingVisits} showAgent leadPath={(id) => `/agency/leads/${id}`} allTo="/agency/diary" />}
              </Card>
              <Card delay={240} className="p-5">
                <CardTitle title="Recent activity" subtitle="Across your company" action={<Clock className="w-4 h-4 text-[#9CA3AF]" />} />
                {!o ? <Skeleton className="h-[320px]" /> : <RecentActivity events={o.activity} />}
              </Card>
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}
