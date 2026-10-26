import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Phone, PhoneCall, PhoneIncoming, TrendingUp, Flame, CalendarClock, Target, RefreshCw, Trophy, Crown, Medal,
  ArrowRight, Headphones, FileText,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import WorkingHoursSection from '../../components/performance/WorkingHoursSection'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import {
  CallerHero, CallsRing, HappeningFeed, DealsStarted, MonthCard, LeadsOnTheMove, TodaysList, useCallerBoard,
} from '../../components/dashboard/CallerBoard'
import {
  Card, CardTitle, LinkButton, Skeleton, ErrorBanner, Hero, Milestone, Kpi, Pipeline, TemperatureDonut,
  TrendChart, ChartLegend, CallsByHourChart, ScopedProvinceCard, TodaysTasks, PhotoCard, CallOutcomes,
  UpcomingVisits, CompanySnapshot, OUTCOME_META, CORAL,
} from '../../components/dashboard/DashboardKit'

// The cold caller's dashboard — the admin command centre's look, built around the job:
// work the contact list, turn calls into leads, keep those leads followed up — plus where
// the whole company stands. Data: GET /reports/my-overview (+ /performance/me for rank).
// On top, the live board (GET /reports/my-board): what's happening to the leads they found,
// the deals they started, the month's milestone, leads on the move and today's list.

const DAILY_SERIES = [
  { key: 'calls',      name: 'Calls',              color: CORAL,     kind: 'area' },
  { key: 'leads',      name: 'Leads created',      color: 'ink',     kind: 'line', axis: 'right' },
  { key: 'interested', name: 'Interested answers', color: '#10B981', kind: 'line', axis: 'right', dashed: true },
]

/* ─── Rank ───────────────────────────────────────────────────────────────── */

function RankCard({ day, month }) {
  const navigate = useNavigate()
  const rows = [
    { key: 'day', label: 'Today', s: day },
    { key: 'month', label: 'This month', s: month },
  ]
  return (
    <Card as="button" type="button" delay={160} onClick={() => navigate('/cold-caller/leaderboard')}
      className="mac-lift mac-press group w-full text-left p-5 hover:border-[#F95C4B]/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-[#111111] dark:text-white tracking-tight">Your rank</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">On the cold caller leaderboard</p>
        </div>
        <ArrowRight className="w-4 h-4 text-[#D4D4D8] dark:text-[#3F3F46] group-hover:text-[#F95C4B] transition-colors" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((r, i) => {
          const rank = r.s?.rank
          const Icon = rank === 1 ? Crown : rank && rank <= 3 ? Medal : Trophy
          return (
            <div key={r.key} className={`mac-pop rounded-xl p-3 ${rank === 1 ? 'bg-gradient-to-br from-[#F95C4B] to-[#FF8C7A] text-white' : 'bg-[#FAFAF9] dark:bg-[#111111]'}`} style={{ '--d': `${240 + i * 80}ms` }}>
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${rank === 1 ? 'text-white/80' : 'text-[#9CA3AF]'}`}>{r.label}</p>
                <Icon className={`w-4 h-4 ${rank === 1 ? 'text-white' : 'text-[#F95C4B]'}`} />
              </div>
              {r.s === undefined ? <Skeleton className="h-8 mt-2" /> : (
                <>
                  <p className={`text-2xl font-bold tracking-tight mt-1 ${rank === 1 ? '' : 'text-[#111111] dark:text-white'}`}>
                    {rank ? <>#{rank}<span className={`text-xs font-medium ${rank === 1 ? 'text-white/75' : 'text-[#9CA3AF]'}`}> of {r.s.total}</span></> : '—'}
                  </p>
                  <p className={`text-[11px] ${rank === 1 ? 'text-white/80' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                    {rank ? <><AnimatedNumber value={r.s.score} /> pts</> : 'No points yet'}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ─── Recent calls ───────────────────────────────────────────────────────── */

function RecentCalls({ calls }) {
  const navigate = useNavigate()
  if (!calls?.length) return <p className="text-xs text-[#9CA3AF] py-8 text-center">No calls yet — your first call shows up here</p>
  return (
    <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
      {calls.map((c, i) => {
        const meta = OUTCOME_META[c.outcome] ?? { label: c.outcome, color: '#9CA3AF' }
        return (
          <li key={c._id}>
            <button type="button" onClick={() => navigate(c.leadId ? `/cold-caller/leads/${c.leadId}` : '/cold-caller/call-logs')}
              className="mac-in w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors text-left"
              style={{ '--d': `${i * 40}ms` }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
                <PhoneCall className="w-4 h-4" style={{ color: meta.color }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-[#111111] dark:text-white truncate">{c.contactName}</span>
                <span className="block text-[11px] text-[#9CA3AF] truncate">{c.phone ?? 'No number'} · {formatDistanceToNow(new Date(c.calledAt), { addSuffix: true })}</span>
              </span>
              {c.leadId && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#111111]/8 dark:bg-white/10 text-[#111111] dark:text-white">Lead</span>}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>{meta.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function ColdCallerDashboard() {
  const { user } = useAuthStore()
  const { theme } = useTheme() ?? {}
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const freshRef = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { data: o, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['my-overview', user?._id],
    queryFn: () => axiosClient.get('/reports/my-overview', { params: freshRef.current ? { fresh: 'true' } : undefined }).then((r) => r.data.data),
    staleTime: 55_000,
    refetchInterval: 60_000,
  })
  // Rank comes from the leaderboard itself (heavier to build) — loaded alongside, not blocking
  const rankQuery = (period) => ({
    queryKey: ['performance', 'my-stats', period],
    queryFn: () => axiosClient.get(`/performance/me?period=${period}`).then((r) => r.data.data.stats),
    staleTime: 60_000,
  })
  const { data: dayRank } = useQuery(rankQuery('day'))
  const { data: board, isLoading: boardLoading } = useCallerBoard()
  const { data: monthRank } = useQuery(rankQuery('month'))

  function refreshNow() {
    freshRef.current = true
    refetch().finally(() => { freshRef.current = false })
  }

  const k = o?.kpis
  const kpiCards = useMemo(() => [
    { icon: Phone, label: 'Calls this week', value: k?.callsWeek, sub: `Today ${k?.callsToday ?? 0} · Month ${(k?.callsMonth ?? 0).toLocaleString()}`, to: '/cold-caller/call-logs' },
    { icon: Headphones, label: 'Contacts to call', value: k?.toCall, sub: `${(k?.contacts ?? 0).toLocaleString()} assigned to you`, to: '/cold-caller/contacts', tone: '#111111' },
    { icon: TrendingUp, label: 'Leads this month', value: k?.leadsMonth, sub: `Today ${k?.leadsToday ?? 0} · Week ${k?.leadsWeek ?? 0}`, to: '/cold-caller/leads', tone: '#8B5CF6' },
    { icon: Flame, label: 'Hot leads', value: k?.hot, sub: `${k?.closed ?? 0} of yours closed`, to: '/cold-caller/leads?status=hot', tone: '#EF4444' },
    { icon: CalendarClock, label: 'Follow-ups due', value: k?.followUpsDue, sub: `Today ${k?.followUpsToday ?? 0} · Overdue ${k?.followUpsOverdue ?? 0}`, to: '/cold-caller/leads?focus=overdue', tone: '#F59E0B' },
    { icon: Target, label: 'Call → lead rate', value: k?.conversionMonth, suffix: '%', sub: `${k?.interestedMonth ?? 0} interested this month`, to: '/cold-caller/call-logs', tone: '#10B981' },
  ], [k])

  const stageTo = {
    contacts: '/cold-caller/contacts',
    called: '/cold-caller/call-logs',
    leads: '/cold-caller/leads',
    warm: '/cold-caller/leads?status=warm',
    hot: '/cold-caller/leads?status=hot',
    closed: '/cold-caller/leads',
  }
  const pickTemperature = (key) => {
    if (!key) return
    navigate(key === 'closed' ? '/cold-caller/leads?focus=closed_month' : `/cold-caller/leads?status=${key}`)
  }

  return (
    <div className="p-4 sm:p-6 xl:p-8 space-y-6">
      {/* ── Live board ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-stretch">
        <CallerHero user={user} board={board} />
        <CallsRing callsToday={k?.callsToday ?? 0} toCall={k?.toCall ?? 0} loading={!o} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <HappeningFeed board={board} loading={boardLoading} />
        <div className="space-y-6">
          <DealsStarted deals={board?.deals} />
          <MonthCard milestone={o?.milestone} rank={board?.rank} hotLeadPoints={board?.hotLeadPoints} conversion={k?.conversionMonth} />
        </div>
      </div>
      <LeadsOnTheMove moving={board?.moving} />
      <TodaysList today={board?.today} overview={o} />

      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">

          {isError && !o && <ErrorBanner onRetry={() => refetch()} />}

          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4">
            {!o
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[140px]" />)
              : kpiCards.map((c, i) => <Kpi key={c.label} delay={80 + i * 60} {...c} />)}
          </div>

          <Card delay={140} className="p-5">
            <CardTitle title="Your pipeline" subtitle="From your contact list to a closed deal — tap a stage to open it" action={<LinkButton to="/cold-caller/leads">My leads</LinkButton>} />
            {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} stageTo={stageTo} />}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
            <div className="grid grid-cols-1 gap-6 content-start">
              <Card delay={200} className="p-5">
                <CardTitle title="Your leads by temperature" subtitle="Tap one to see those leads" />
                {!o ? <Skeleton className="h-[170px]" /> : <TemperatureDonut temperature={o.temperature} total={k.totalLeads} isDark={isDark} onPick={pickTemperature} />}
              </Card>
              <Card delay={240} className="p-5">
                <CardTitle title="How your calls end" subtitle={o ? `${o.callOutcomes.total.toLocaleString()} calls in the last 30 days` : 'Last 30 days'} action={<LinkButton to="/cold-caller/call-logs">Call logs</LinkButton>} />
                {!o ? <Skeleton className="h-[220px]" /> : <CallOutcomes outcomes={o.callOutcomes} />}
              </Card>
            </div>
            <ScopedProvinceCard
              isDark={isDark}
              loading={!o}
              subtitle="Your leads and contacts, or the whole company · tap a province"
              scopes={o ? [
                { key: 'mine', label: 'Mine', provinces: o.provinces, provinceTo: (name) => `/cold-caller/leads?province=${encodeURIComponent(name)}` },
                { key: 'company', label: 'Company', provinces: o.company.provinces },
              ] : [{ key: 'mine', label: 'Mine' }]}
            />
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card delay={260} className="p-5">
              <CardTitle title="Your last 30 days" subtitle="Calls (left axis) against leads created and interested answers (right axis)" action={<LinkButton to="/cold-caller/call-logs">Call logs</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : (
                <>
                  <TrendChart data={o.charts.daily} xKey="date" series={DAILY_SERIES} rightAxis isDark={isDark}
                    xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => format(new Date(d), 'EEE, d MMM')} />
                  <ChartLegend series={DAILY_SERIES} isDark={isDark} />
                </>
              )}
            </Card>
            <Card delay={300} className="p-5">
              <CardTitle title="When you call" subtitle="Your calls by hour, last 30 days — peak hour in full coral" />
              {!o ? <Skeleton className="h-[250px]" /> : <CallsByHourChart hours={o.charts.callsByHour} isDark={isDark} height={250} />}
            </Card>
          </div>

          <CompanySnapshot company={o?.company} isDark={isDark} delay={320} />

          <Card delay={340} className="p-5">
            <CardTitle title="Your recent calls" subtitle="Tap a call to open its lead, or the call log" action={<LinkButton to="/cold-caller/call-logs">All calls</LinkButton>} />
            {!o ? <Skeleton className="h-[260px]" /> : <RecentCalls calls={o.recentCalls} />}
          </Card>

          <div className="mac-in" style={{ '--d': '360ms' }}>
            <WorkingHoursSection endpoint="/performance/working-hours/me" />
          </div>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <aside className="space-y-6 min-w-0">
          <div className="flex justify-end">
            <button type="button" onClick={refreshNow} title="Refresh now"
              className="flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Updated {dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm') : ''}
            </button>
          </div>
          <RankCard day={dayRank} month={monthRank} />
          <Card delay={200} className="p-5">
            <CardTitle title="Upcoming visits" subtitle={`${(k?.apptsUpcoming ?? 0).toLocaleString()} booked from today`} action={<LinkButton to="/cold-caller/appointments">All</LinkButton>} />
            {!o ? <Skeleton className="h-[200px]" /> : <UpcomingVisits visits={o.upcomingVisits} leadPath={(id) => `/cold-caller/leads/${id}`} allTo="/cold-caller/appointments" />}
          </Card>
          <PhotoCard
            eyebrow="Keep dialling"
            title="Your next lead is one call away"
            text={<><b className="text-white">{(k?.toCall ?? 0).toLocaleString()}</b> contacts are waiting in your list{k?.callbacks ? <> and <b className="text-white">{k.callbacks}</b> asked you to call back</> : ''}.</>}
            to="/cold-caller/contacts"
            buttonLabel="Start calling"
            icon={PhoneCall}
          />
          <button type="button" onClick={() => navigate('/cold-caller/leads?new=1')}
            className="mac-in mac-press w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-semibold text-[#F95C4B] border border-[#F95C4B]/30 hover:bg-[#F95C4B]/5 transition-colors"
            style={{ '--d': '400ms' }}>
            <FileText className="w-4 h-4" /> Log a new lead
          </button>
        </aside>
      </div>
    </div>
  )
}
