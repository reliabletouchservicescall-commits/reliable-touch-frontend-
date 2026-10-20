import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Flame, AlertTriangle, Clock, Building2, MessageSquareText, CalendarCheck, RefreshCw, Trophy, Crown,
  ArrowRight, Hourglass,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import {
  Card, CardTitle, LinkButton, Skeleton, ErrorBanner, Hero, Milestone, Kpi, Pipeline, Donut, TrendChart,
  ChartLegend, ScopedProvinceCard, TodaysTasks, PhotoCard, UpcomingVisits, CompanySnapshot, CORAL, CORAL_3,
} from '../../components/dashboard/DashboardKit'

// The follow-up manager's dashboard — the admin command centre's look, built around the
// hot-lead queue: what's overdue, what's never been touched, what still needs an agency,
// and how fresh the follow-ups are — plus where the whole company stands.
// Data: GET /reports/my-overview.

const DAILY_SERIES = [
  { key: 'newHot', name: 'New hot leads',           color: CORAL,     kind: 'area' },
  { key: 'team',   name: 'Follow-ups (all managers)', color: 'ink',   kind: 'line' },
  { key: 'mine',   name: 'Your follow-ups',          color: '#10B981', kind: 'line', dashed: true, width: 2.5 },
]
const RECENCY_COLORS = { today: '#10B981', week: CORAL, month: CORAL_3, older: '#D4D4D8', never: '#111111' }
const AGE_COLORS = ['#10B981', '#84CC16', '#F59E0B', CORAL, '#C93A2B']

/* ─── Hot lead age ───────────────────────────────────────────────────────── */

function AgeBars({ ages, total }) {
  const max = Math.max(1, ...ages.map((a) => a.count))
  return (
    <div className="flex items-end gap-3 h-[190px] pt-4">
      {ages.map((a, i) => (
        <div key={a.key} className="flex-1 flex flex-col items-center justify-end h-full gap-2 min-w-0">
          <span className="text-xs font-bold text-[#111111] dark:text-white tabular-nums"><AnimatedNumber value={a.count} /></span>
          <div className="w-full flex-1 flex items-end">
            <div className="mac-rise w-full rounded-t-lg" title={`${a.count} hot leads, hot for ${a.label}`}
              style={{ height: `${Math.max(4, (a.count / max) * 100)}%`, backgroundColor: AGE_COLORS[i], '--d': `${200 + i * 70}ms` }} />
          </div>
          <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] text-center leading-tight">{a.label}</span>
          <span className="text-[9px] text-[#9CA3AF] tabular-nums">{total ? Math.round((a.count / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Standing & where hot leads went ───────────────────────────────────── */

function StandingCard({ standing, kpis }) {
  const navigate = useNavigate()
  const top = standing?.rank === 1
  const share = standing?.teamTotal ? Math.round((standing.mine / standing.teamTotal) * 100) : 0
  return (
    <Card as="button" type="button" delay={160} onClick={() => navigate('/follow-up-manager/leads')}
      className="mac-lift mac-press group w-full text-left p-5 hover:border-[#F95C4B]/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-[#111111] dark:text-white tracking-tight">Your follow-ups</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Notes you logged on hot leads</p>
        </div>
        <ArrowRight className="w-4 h-4 text-[#D4D4D8] dark:text-[#3F3F46] group-hover:text-[#F95C4B] transition-colors" />
      </div>
      {!standing ? <Skeleton className="h-24" /> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[['Today', kpis.mineToday], ['This week', kpis.mineWeek], ['This month', kpis.mineMonth]].map(([label, v], i) => (
              <div key={label} className="mac-pop rounded-xl bg-[#FAFAF9] dark:bg-[#111111] py-2.5 text-center" style={{ '--d': `${220 + i * 60}ms` }}>
                <p className="text-xl font-bold text-[#111111] dark:text-white"><AnimatedNumber value={v} /></p>
                <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">{label}</p>
              </div>
            ))}
          </div>
          <div className={`mt-3 flex items-center gap-3 p-3 rounded-xl ${top ? 'bg-gradient-to-r from-[#F95C4B] to-[#FF8C7A] text-white' : 'bg-[#F95C4B]/8'}`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${top ? 'bg-white/20' : 'bg-[#F95C4B]/15'}`}>
              {top ? <Crown className="w-4 h-4 text-white" /> : <Trophy className="w-4 h-4 text-[#F95C4B]" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${top ? '' : 'text-[#111111] dark:text-white'}`}>
                {standing.rank ? `#${standing.rank} of ${standing.of} follow-up managers` : 'No follow-ups yet this month'}
              </p>
              <p className={`text-[11px] ${top ? 'text-white/80' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                {share}% of the team's {standing.teamTotal.toLocaleString()} follow-ups this month
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

function AgencySpread({ agencies, withAgency, noAgency }) {
  const max = Math.max(1, ...agencies.map((a) => a.count))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#10B981]/8 border border-[#10B981]/20 p-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#10B981]">With an agency</p>
          <p className="text-2xl font-bold text-[#111111] dark:text-white"><AnimatedNumber value={withAgency} /></p>
        </div>
        <div className="rounded-xl bg-[#F59E0B]/8 border border-[#F59E0B]/25 p-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#B45309] dark:text-[#F59E0B]">Still need one</p>
          <p className="text-2xl font-bold text-[#111111] dark:text-white"><AnimatedNumber value={noAgency} /></p>
        </div>
      </div>
      {agencies.length === 0 ? <p className="text-xs text-[#9CA3AF] text-center py-4">No hot lead has gone to an agency yet</p> : (
        <ul className="space-y-2.5">
          {agencies.map((a, i) => (
            <li key={String(a.agencyId)} className="mac-slide-in" style={{ '--d': `${200 + i * 60}ms` }}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-2 font-medium text-[#111111] dark:text-white truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />{a.name}
                </span>
                <span className="font-semibold tabular-nums text-[#111111] dark:text-white">{a.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                <div className="mac-grow-x h-full rounded-full bg-[#F95C4B]" style={{ width: `${(a.count / max) * 100}%`, '--d': `${260 + i * 60}ms` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─── Priority queue ─────────────────────────────────────────────────────── */

function PriorityQueue({ queue }) {
  const navigate = useNavigate()
  if (!queue?.length) {
    return (
      <div className="text-center py-10">
        <Flame className="w-6 h-6 mx-auto text-[#10B981]" />
        <p className="text-sm font-semibold text-[#111111] dark:text-white mt-2">Queue is clear</p>
        <p className="text-xs text-[#9CA3AF]">No overdue or untouched hot leads</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
            {['Owner / Property', 'Area', 'Why it\'s here', 'Follow-up date', 'Last followed up', 'Agency'].map((h) => (
              <th key={h} className="text-left font-semibold px-3 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {queue.map((l, i) => (
            <tr key={l._id} onClick={() => navigate(`/follow-up-manager/leads/${l._id}`)}
              className="mac-in cursor-pointer border-t border-[#F5F5F4] dark:border-[#202020] hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors"
              style={{ '--d': `${i * 40}ms` }}>
              <td className="px-3 py-2.5 max-w-[230px]">
                <p className="font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                <p className="text-[11px] text-[#9CA3AF] truncate">{l.propertyAddress}</p>
              </td>
              <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">{l.area ?? '—'}</td>
              <td className="px-3 py-2.5">
                {l.reason === 'overdue'
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-[#DC2626]/10 text-[#DC2626]"><AlertTriangle className="w-3 h-3" /> Overdue</span>
                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-[#111111]/8 dark:bg-white/10 text-[#111111] dark:text-white"><Clock className="w-3 h-3" /> Never followed up</span>}
              </td>
              <td className={`px-3 py-2.5 whitespace-nowrap ${l.reason === 'overdue' ? 'text-[#DC2626] font-semibold' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                {l.followUpDate ? format(new Date(l.followUpDate), 'd MMM yyyy') : '—'}
              </td>
              <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">
                {l.lastFollowUpAt ? formatDistanceToNow(new Date(l.lastFollowUpAt), { addSuffix: true }) : <span className="text-[#9CA3AF]">Never · added {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}</span>}
              </td>
              <td className="px-3 py-2.5 max-w-[150px] truncate">
                {l.agency ? <span className="text-[#111111] dark:text-white">{l.agency}</span> : <span className="text-[#F59E0B] font-medium">Needs an agency</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function FollowUpManagerDashboard() {
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

  function refreshNow() {
    freshRef.current = true
    refetch().finally(() => { freshRef.current = false })
  }

  const k = o?.kpis
  const kpiCards = useMemo(() => [
    { icon: Flame, label: 'Hot leads', value: k?.hot, sub: `${k?.newHotWeek ?? 0} new this week`, to: '/follow-up-manager/leads', tone: '#EF4444' },
    { icon: AlertTriangle, label: 'Overdue', value: k?.overdue, sub: `${k?.dueToday ?? 0} more due today`, to: '/follow-up-manager/leads?focus=overdue', tone: '#DC2626' },
    { icon: Clock, label: 'Never followed up', value: k?.neverFollowed, sub: 'No note logged yet', to: '/follow-up-manager/leads?focus=never_followed_up', tone: '#111111' },
    { icon: Building2, label: 'Need an agency', value: k?.noAgency, sub: `${k?.withAgency ?? 0} already with one`, to: '/follow-up-manager/leads?focus=no_agent', tone: '#F59E0B' },
    { icon: MessageSquareText, label: 'Your follow-ups', value: k?.mineWeek, sub: `This week · today ${k?.mineToday ?? 0}`, to: '/follow-up-manager/leads' },
    { icon: CalendarCheck, label: 'Visits booked', value: k?.apptsUpcoming, sub: `Today ${k?.apptsToday ?? 0}`, to: '/follow-up-manager/appointments', tone: '#10B981' },
  ], [k])

  const stageTo = {
    hot: '/follow-up-manager/leads',
    touched: '/follow-up-manager/leads?focus=never_followed_up',
    dated: '/follow-up-manager/leads?focus=no_followup_date',
    agency: '/follow-up-manager/leads?focus=no_agent',
    visits: '/follow-up-manager/appointments',
  }
  const recencyColor = (key) => (key === 'never' && isDark ? '#F5F5F4' : RECENCY_COLORS[key])
  const pickRecency = (key) => { if (key === 'never') navigate('/follow-up-manager/leads?focus=never_followed_up') }

  return (
    <div className="p-4 sm:p-6 xl:p-8">
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <Hero
              user={user}
              now={now}
              eyebrow="Follow-up"
              subtitle="The fortune is in the follow-up. Here's your hot-lead queue today."
              stats={[
                { icon: Flame, label: 'hot leads', value: k?.hot, to: '/follow-up-manager/leads' },
                { icon: AlertTriangle, label: 'overdue', value: k?.overdue, to: '/follow-up-manager/leads?focus=overdue' },
                { icon: CalendarCheck, label: 'visits today', value: k?.apptsToday, to: '/follow-up-manager/appointments' },
              ]}
            />
            {!o ? <Skeleton className="min-h-[220px]" /> : <Milestone milestone={o.milestone} to="/follow-up-manager/leads?focus=never_followed_up" />}
          </div>

          {isError && !o && <ErrorBanner onRetry={() => refetch()} />}

          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4">
            {!o
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[140px]" />)
              : kpiCards.map((c, i) => <Kpi key={c.label} delay={80 + i * 60} {...c} />)}
          </div>

          <Card delay={140} className="p-5">
            <CardTitle title="Hot lead coverage" subtitle="How much of the hot queue is followed up, dated and routed — tap a stage to work it" action={<LinkButton to="/follow-up-manager/leads">Hot leads</LinkButton>} />
            {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} stageTo={stageTo} />}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
            <div className="grid grid-cols-1 gap-6 content-start">
              <Card delay={200} className="p-5">
                <CardTitle title="When hot leads were last followed up" subtitle="Fresh is green — black has never had a note" />
                {!o ? <Skeleton className="h-[170px]" /> : <Donut items={o.recency} total={k.hot} color={recencyColor} centerLabel="Hot leads" onPick={pickRecency} />}
              </Card>
              <Card delay={240} className="p-5">
                <CardTitle title="How long they've been hot" subtitle="Older hot leads go cold — work the right-hand bars first" action={<Hourglass className="w-4 h-4 text-[#9CA3AF]" />} />
                {!o ? <Skeleton className="h-[190px]" /> : <AgeBars ages={o.ages} total={k.hot} />}
              </Card>
            </div>
            <ScopedProvinceCard
              isDark={isDark}
              loading={!o}
              title="Hot leads by province"
              subtitle="Your hot queue, or the whole company · tap a province"
              scopes={o ? [
                {
                  key: 'mine', label: 'Hot queue', provinces: o.provinces,
                  metrics: [['leads', 'Hot leads'], ['noAgency', 'Need agency'], ['overdue', 'Overdue']],
                  provinceTo: (name) => `/follow-up-manager/leads?province=${encodeURIComponent(name)}`,
                },
                { key: 'company', label: 'Company', provinces: o.company.provinces },
              ] : [{ key: 'mine', label: 'Hot queue' }]}
            />
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card delay={260} className="p-5">
              <CardTitle title="Last 30 days" subtitle="Leads turning hot each day against follow-ups logged" action={<LinkButton to="/follow-up-manager/leads">Hot leads</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : (
                <>
                  <TrendChart data={o.charts.daily} xKey="date" series={DAILY_SERIES} isDark={isDark}
                    xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => format(new Date(d), 'EEE, d MMM')} />
                  <ChartLegend series={DAILY_SERIES} isDark={isDark} />
                </>
              )}
            </Card>
            <Card delay={300} className="p-5">
              <CardTitle title="Where hot leads went" subtitle="Agencies holding hot leads right now" action={<LinkButton to="/follow-up-manager/leads?focus=no_agent">Route leads</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : <AgencySpread agencies={o.agencies} withAgency={k.withAgency} noAgency={k.noAgency} />}
            </Card>
          </div>

          <Card delay={320} className="p-5">
            <CardTitle title="Priority queue" subtitle="Overdue first (oldest date first), then hot leads nobody has followed up — tap one to work it" action={<LinkButton to="/follow-up-manager/leads?focus=overdue">All overdue</LinkButton>} />
            {!o ? <Skeleton className="h-[300px]" /> : <PriorityQueue queue={o.queue} />}
          </Card>

          <CompanySnapshot company={o?.company} isDark={isDark} delay={340} />
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
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
          <StandingCard standing={o?.standing} kpis={k} />
          <Card delay={200} className="p-5">
            <CardTitle title="Upcoming visits" subtitle={`${(k?.apptsUpcoming ?? 0).toLocaleString()} booked from today`} action={<LinkButton to="/follow-up-manager/appointments">All</LinkButton>} />
            {!o ? <Skeleton className="h-[200px]" /> : <UpcomingVisits visits={o.upcomingVisits} showAgent leadPath={(id) => `/follow-up-manager/leads/${id}`} allTo="/follow-up-manager/appointments" />}
          </Card>
          <PhotoCard
            eyebrow="Hot leads are waiting"
            title="A quick follow-up keeps a deal warm"
            text={<><b className="text-white">{(k?.overdue ?? 0).toLocaleString()}</b> hot leads are past their follow-up date and <b className="text-white">{(k?.neverFollowed ?? 0).toLocaleString()}</b> have never had a note.</>}
            to="/follow-up-manager/leads?focus=overdue"
            buttonLabel="Work the overdue list"
            icon={AlertTriangle}
          />
        </aside>
      </div>
    </div>
  )
}
