import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Users, Phone, CalendarClock, Flame, Home, RefreshCw, PhoneCall, Building2, Clock, TrendingUp, Bell, X, Trophy, CalendarCheck, MapPin,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import { contactRequestsApi } from '../../services/contactRequestsApi'
import FinancePanel from '../../components/dashboard/FinancePanel'
import {
  DashboardHeader, FunnelStrip, NeedsAttention, OnTheFloor, LiveActivity, LeadTemperature, LeadingThisMonth,
  useLiveFloor, useLiveOverview, useAttentionItems, useNow,
} from '../../components/dashboard/LiveOps'
import {
  Card, CardTitle, LinkButton, Skeleton, ErrorBanner, Milestone, Kpi, Pipeline, TemperatureDonut, IntentBars,
  TrendChart, CallsByHourChart, ProvincePanel, TodaysTasks, RecentActivity, PhotoCard, STATUS_COLORS, STATUS_LABEL,
} from '../../components/dashboard/DashboardKit'

const DAILY_SERIES = [
  { key: 'calls',  name: 'Calls',         color: '#F95C4B', kind: 'area' },
  { key: 'leads',  name: 'Leads created', color: 'ink',     kind: 'line', axis: 'right' },
  { key: 'closed', name: 'Deals closed',  color: '#10B981', kind: 'line', axis: 'right', dashed: true },
]
const WEEKLY_SERIES = [
  { key: 'created', name: 'Leads created', color: '#F95C4B', kind: 'line', dots: true, width: 3 },
  { key: 'closed',  name: 'Deals closed',  color: 'ink',     kind: 'line', dots: true, width: 2.5 },
]

/* ─── Tables & feeds ─────────────────────────────────────────────────────── */

const LEAD_TABS = [
  { key: 'all', label: 'All leads', test: () => true },
  { key: 'hot', label: 'Hot', test: (l) => l.status === 'hot' },
  { key: 'followup', label: 'Follow-up due', test: (l) => l.followUpDate && new Date(l.followUpDate) <= new Date() },
  { key: 'unassigned', label: 'No agent yet', test: (l) => !l.agent && !l.agency },
]

function RecentLeads({ leads }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const rows = (leads ?? []).filter(LEAD_TABS.find((t) => t.key === tab).test).slice(0, 8)
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
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
              {['Owner / Property', 'Area', 'Intent', 'Status', 'Follow-up', 'Agent / Agency', 'Created'].map((h) => (
                <th key={h} className="text-left font-semibold px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody key={tab}>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-[#9CA3AF]">Nothing here right now</td></tr>
            ) : rows.map((l, i) => {
              const color = STATUS_COLORS[l.status] ?? '#9CA3AF'
              const overdue = l.followUpDate && new Date(l.followUpDate) < new Date()
              return (
                <tr key={l._id} onClick={() => navigate(`/admin/leads/${l._id}`)}
                  className="mac-in cursor-pointer border-t border-[#F5F5F4] dark:border-[#202020] hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors"
                  style={{ '--d': `${i * 40}ms` }}>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">{l.propertyAddress}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">{l.area ?? '—'}{l.province ? <span className="block text-[10px] text-[#9CA3AF]">{l.province}</span> : null}</td>
                  <td className="px-3 py-2.5">
                    {l.listingType ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.listingType === 'rental' ? 'bg-[#F95C4B]/10 text-[#F95C4B]' : 'bg-[#111111]/8 dark:bg-white/10 text-[#111111] dark:text-white'}`}>
                        {l.listingType === 'rental' ? 'Rent' : 'Sell'}
                      </span>
                    ) : <span className="text-[#9CA3AF]">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color, backgroundColor: `${color}1A` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />{STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${overdue ? 'text-[#DC2626] font-semibold' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                    {l.followUpDate ? format(new Date(l.followUpDate), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] max-w-[170px]">
                    {l.agent || l.agency ? (
                      <><p className="text-[#111111] dark:text-white truncate">{l.agent ?? '—'}</p><p className="text-[10px] truncate">{l.agency}</p></>
                    ) : <span className="text-[#F59E0B] font-medium">Unassigned</span>}
                  </td>
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

function TopAgencies({ agencies }) {
  const navigate = useNavigate()
  if (!agencies?.length) return <p className="text-xs text-[#9CA3AF] py-8 text-center">No agency has been given leads yet</p>
  const max = Math.max(...agencies.map((a) => a.leads))
  return (
    <ul className="space-y-1">
      {agencies.map((a, i) => (
        <li key={String(a.agencyId)}>
          <button type="button" onClick={() => navigate(`/admin/agencies/${a.agencyId}`)}
            className="mac-slide-in w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#FAFAF9] dark:hover:bg-[#202020] transition-colors text-left"
            style={{ '--d': `${150 + i * 60}ms` }}>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${i === 0 ? 'bg-[#F95C4B] text-white' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]'}`}>
              {i === 0 ? <Trophy className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{a.name}</p>
                <span className={`text-xs font-bold tabular-nums ${a.conversion >= 20 ? 'text-[#16A34A]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{a.conversion}%</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
                  <div className="mac-grow-x h-full rounded-full bg-[#F95C4B]" style={{ width: `${(a.leads / max) * 100}%`, '--d': `${300 + i * 60}ms` }} />
                </div>
                <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap tabular-nums">{a.leads} leads · {a.closed} closed</span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ContactRequests() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['contact-requests-pending'],
    queryFn: () => contactRequestsApi.list({ status: 'pending', limit: 10 }),
    staleTime: 30_000,
  })
  const update = useMutation({
    mutationFn: ({ id, status }) => contactRequestsApi.updateStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-requests-pending'] }),
  })
  const requests = data?.requests ?? []
  if (!requests.length) return null
  return (
    <Card delay={200} className="overflow-hidden border-[#F95C4B]/25">
      <div className="flex items-center gap-3 px-5 py-3 bg-[#F95C4B]/5 border-b border-[#F95C4B]/15">
        <Bell className="w-4 h-4 text-[#F95C4B]" />
        <span className="text-sm font-bold text-[#111111] dark:text-white flex-1">Cold callers asking for more contacts</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F95C4B] text-white">{requests.length}</span>
      </div>
      <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
        {requests.map((req) => (
          <li key={req._id} className="flex items-center gap-3 px-5 py-3">
            <span className="w-8 h-8 rounded-full bg-[#F95C4B]/15 flex items-center justify-center text-[11px] font-bold text-[#F95C4B]">
              {`${req.requestedBy?.firstName?.[0] ?? ''}${req.requestedBy?.lastName?.[0] ?? ''}`.toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#111111] dark:text-white">
                {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                <span className="text-xs font-normal text-[#9CA3AF] ml-2">{formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</span>
              </p>
              {req.message && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate italic">&ldquo;{req.message}&rdquo;</p>}
            </div>
            <button onClick={() => navigate('/admin/contacts')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">Assign</button>
            <button onClick={() => update.mutate({ id: req._id, status: 'fulfilled' })} disabled={update.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20">Fulfilled</button>
            <button onClick={() => update.mutate({ id: req._id, status: 'dismissed' })} disabled={update.isPending} title="Dismiss"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10"><X className="w-3.5 h-3.5" /></button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { theme } = useTheme() ?? {}
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const freshRef = useRef(false) // set by the refresh button to bypass the server's 60s cache

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { data: o, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => axiosClient.get('/reports/overview', { params: freshRef.current ? { fresh: 'true' } : undefined }).then((r) => r.data.data),
    staleTime: 55_000,
    refetchInterval: 60_000,
  })

  const [finance, setFinance] = useState({ commissions: [], renewals: [], loading: true })
  useEffect(() => {
    Promise.allSettled([axiosClient.get('/commissions?limit=5'), axiosClient.get('/lease-renewals?limit=5')]).then(([c, r]) => {
      setFinance({
        commissions: c.status === 'fulfilled' ? c.value.data?.data?.commissions ?? [] : [],
        renewals: r.status === 'fulfilled' ? r.value.data?.data?.renewals ?? [] : [],
        loading: false,
      })
    })
  }, [])

  function refreshNow() {
    freshRef.current = true
    refetch().finally(() => { freshRef.current = false })
  }

  // Live operations board (top of the page)
  const [period, setPeriod] = useState(() => { try { return localStorage.getItem('rt-dash-period') || 'month' } catch { return 'month' } })
  const choosePeriod = (p) => { setPeriod(p); try { localStorage.setItem('rt-dash-period', p) } catch { /* private mode */ } }
  const tick = useNow(15_000)
  const { data: floor, isLoading: floorLoading } = useLiveFloor()
  const { data: live, isLoading: liveLoading } = useLiveOverview()
  const attention = useAttentionItems(live, floor, tick)

  const k = o?.kpis
  const kpiCards = useMemo(() => [
    { icon: Users, label: 'Total leads', value: k?.totalLeads, sub: `${(k?.leadsThisWeek ?? 0).toLocaleString()} this week`, trend: k?.leadsWeekChangePct, to: '/admin/leads' },
    { icon: Phone, label: 'Needs calling', value: k?.needsCalling, sub: 'Contacts never called', to: '/admin/contacts', tone: '#111111' },
    { icon: CalendarClock, label: 'Follow-ups due', value: k?.followUpsDue, sub: `Today ${k?.followUpsToday ?? 0} · Overdue ${(k?.followUpsOverdue ?? 0).toLocaleString()}`, to: '/admin/leads', tone: '#F59E0B' },
    { icon: Flame, label: 'Qualified (hot)', value: k?.qualified, sub: 'Ready for an agent', to: '/admin/leads', tone: '#EF4444' },
    { icon: Home, label: 'Listed / rented / sold', value: k?.closedThisMonth, sub: 'Closed this month', to: '/admin/leads', tone: '#10B981' },
  ], [k])

  return (
    <div className="relative p-4 sm:p-6 xl:p-8 space-y-6">
      {/* Slow aurora behind the header */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        <span className="aurora w-[520px] h-[240px] -top-24 left-[4%] bg-[#F95C4B]/18 dark:bg-[#F95C4B]/14" />
        <span className="aurora w-[420px] h-[200px] -top-16 right-[8%] bg-[#10B981]/14 dark:bg-[#10B981]/10" style={{ animationDelay: '-9s', animationDuration: '28s' }} />
        <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FAFAF9] dark:to-[#0B0B0B]" />
      </div>

      <DashboardHeader user={user} floor={floor} needsCount={liveLoading ? null : attention.length} period={period} onPeriod={choosePeriod} />
      <div className="relative"><FunnelStrip period={period} /></div>

      {/* Two columns; Live activity stretches to the right column's height — no gaps either side */}
      <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
        <div className="flex flex-col gap-6 min-w-0">
          <NeedsAttention items={attention} loading={liveLoading} />
          <LiveActivity fill />
        </div>
        <div className="space-y-6 self-start">
          <OnTheFloor floor={floor} loading={floorLoading} now={tick} />
          <LeadTemperature temperature={live?.temperature} />
          <LeadingThisMonth leaders={live?.leaders} />
        </div>
      </div>

      <div className="relative grid grid-cols-1 2xl:grid-cols-[1fr_340px] xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">

          {isError && !o && (
            <ErrorBanner onRetry={() => refetch()} />
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4">
            {!o
              ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[140px]" />)
              : kpiCards.map((c, i) => <Kpi key={c.label} delay={80 + i * 60} {...c} />)}
          </div>

          <Card delay={140} className="p-5">
            <CardTitle title="Lead pipeline" subtitle="From first contact to a closed deal — and how many make each step" action={<LinkButton to="/admin/leads">View all leads</LinkButton>} />
            {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} />}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 content-start">
              <Card delay={200} className="p-5">
                <CardTitle title="Lead temperature" subtitle="Where every lead stands right now" />
                {!o ? <Skeleton className="h-[170px]" /> : <TemperatureDonut temperature={o.temperature} total={o.kpis.totalLeads} isDark={isDark} />}
              </Card>
              <Card delay={240} className="p-5">
                <CardTitle title="Property intent" subtitle="What owners want to do" />
                {!o ? <Skeleton className="h-[170px]" /> : <IntentBars intent={o.intent} />}
              </Card>
            </div>
            <Card delay={180} className="p-5">
              <CardTitle title="Leads by province" subtitle="Hover or tap a province · darker coral = more leads" action={<LinkButton to="/admin/areas">Areas</LinkButton>} />
              {!o ? <Skeleton className="h-[360px]" /> : <ProvincePanel provinces={o.provinces} isDark={isDark} fixAreasTo="/admin/areas" />}
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card delay={260} className="p-5">
              <CardTitle title="Daily activity — last 30 days" subtitle="Calls (left axis) against leads created and deals closed (right axis)" action={<LinkButton to="/admin/call-logs">Call logs</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : <TrendChart data={o.charts.daily} xKey="date" series={DAILY_SERIES} rightAxis isDark={isDark} xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => format(new Date(d), 'EEE, d MMM')} />}
            </Card>
            <Card delay={300} className="p-5">
              <CardTitle title="Weekly trend — 12 weeks" subtitle="New leads vs deals closed each week" action={<LinkButton to="/admin/performance">Performance</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : <TrendChart data={o.charts.weekly} xKey="weekStart" series={WEEKLY_SERIES} isDark={isDark} delay={350} xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => `Week of ${format(new Date(d), 'd MMM')}`} />}
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-6">
            <Card delay={320} className="p-5">
              <CardTitle title="When calls happen" subtitle="Calls by hour of day, last 30 days — peak hour in full coral" />
              {!o ? <Skeleton className="h-[230px]" /> : <CallsByHourChart hours={o.charts.callsByHour} isDark={isDark} />}
            </Card>
            <Card delay={340} className="p-5">
              <CardTitle title="Top performing agencies" subtitle="By leads handed over · conversion = listed, rented or sold" action={<LinkButton to="/admin/agencies">All agencies</LinkButton>} />
              {!o ? <Skeleton className="h-[230px]" /> : <TopAgencies agencies={o.topAgencies} />}
            </Card>
          </div>

          <Card delay={360} className="p-5">
            <CardTitle title="Recent leads" subtitle="The newest leads in the system" action={<LinkButton to="/admin/leads">View all</LinkButton>} />
            {!o ? <Skeleton className="h-[300px]" /> : <RecentLeads leads={o.recentLeads} />}
          </Card>

          <ContactRequests />

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Finance
            </h2>
            <FinancePanel commissions={finance.commissions} renewals={finance.renewals} loading={finance.loading} navigate={navigate} />
          </div>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <aside className="space-y-6 min-w-0">
          {!o ? <Skeleton className="min-h-[220px]" /> : <Milestone milestone={o?.milestone} />}
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
          <Card delay={240} className="p-5">
            <CardTitle title="Recent activity" subtitle="Across the whole system" action={<Clock className="w-4 h-4 text-[#9CA3AF]" />} />
            {!o ? <Skeleton className="h-[320px]" /> : <RecentActivity events={o.activity} />}
          </Card>
          <PhotoCard
            eyebrow="Next stop"
            title="The whole of South Africa"
            text={<>Leads in <b className="text-white">{(o?.provinces?.list ?? []).filter((p) => p.leads > 0).length}</b> of 9 provinces so far. More cities, more agents, more opportunities.</>}
            to="/admin/areas"
            buttonLabel="Manage coverage"
            icon={MapPin}
          />
          <p className="text-center text-[10px] text-[#9CA3AF] flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Reliable Touch Services · Lead generation · Cold calling · Follow-up · Distribution
          </p>
        </aside>
      </div>
    </div>
  )
}
