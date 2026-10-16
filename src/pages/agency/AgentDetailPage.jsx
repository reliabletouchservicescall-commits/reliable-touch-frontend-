import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, Phone, Mail, Calendar, Clock, Briefcase,
  CheckCircle2, Home, FileText, CalendarCheck, Activity, Crown, Loader2,
  AlertTriangle, MapPin, Trophy, Star, TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import WorkingHoursSection from '../../components/performance/WorkingHoursSection'

const BRAND = '#10B981'
const STATUS_COLORS = {
  cold: '#6B7280', warm: '#F59E0B', hot: '#EF4444', listed: '#8B5CF6',
  rented_out: '#10B981', sold: '#F95C4B', lost: '#9CA3AF',
}
const APPT_STATUS_COLORS = {
  scheduled: '#3B82F6', confirmed: '#10B981', completed: '#6B7280', cancelled: '#EF4444', no_show: '#F59E0B',
}

function labelize(s) {
  return (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function StatCard({ icon: Icon, label, value, sub, color = BRAND, delay = 0 }) {
  return (
    <div
      className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-card transition-all animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">{value ?? 0}</p>
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function ChartCard({ icon: Icon, title, children, delay = 0 }) {
  return (
    <div
      className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}15` }}>
          <Icon className="w-4 h-4" style={{ color: BRAND }} strokeWidth={1.75} />
        </div>
        <span className="text-sm font-bold text-[#111111] dark:text-white">{title}</span>
      </div>
      {children}
    </div>
  )
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-[#111111] dark:text-white mb-1">{format(new Date(label), 'd MMM')}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="font-bold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center gap-2.5 text-center">
      <Activity className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
    </div>
  )
}

function PieBreakdown({ data, colors }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  if (total === 0) return <EmptyChart label="No data yet" />
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} isAnimationActive>
            {data.map((d) => <Cell key={d.name} fill={colors[d.name] ?? '#6B7280'} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [v, labelize(n)]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 min-w-0">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[d.name] ?? '#6B7280' }} />
            <span className="text-[#6B7280] dark:text-[#A1A1AA] truncate flex-1">{labelize(d.name)}</span>
            <span className="font-bold text-[#111111] dark:text-white">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecentListCard({ icon: Icon, title, items, renderItem, emptyLabel, delay = 0 }) {
  return (
    <div
      className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}15` }}>
          <Icon className="w-4 h-4" style={{ color: BRAND }} strokeWidth={1.75} />
        </div>
        <span className="text-sm font-bold text-[#111111] dark:text-white">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center py-10">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">{items.map(renderItem)}</ul>
      )}
    </div>
  )
}

function mergeSeries(leadsSeries = [], apptSeries = []) {
  const map = new Map()
  for (const d of leadsSeries) map.set(d.date, { date: d.date, leads: d.count, appointments: 0 })
  for (const d of apptSeries) {
    const row = map.get(d.date) ?? { date: d.date, leads: 0, appointments: 0 }
    row.appointments = d.count
    map.set(d.date, row)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export default function AgentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user: viewer } = useAuthStore()

  const fromKey = location.state?.from
  const backTo = fromKey === 'login-activity' ? '/agency/login-activity' : fromKey === 'team' ? '/agency/team' : '/agency/leaderboard'
  const backLabel = fromKey === 'login-activity' ? 'Back to Login Activity' : fromKey === 'team' ? 'Back to Team' : 'Back to Leaderboard'

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['agent-activity', id],
    queryFn: () => axiosClient.get(`/agents/${id}/activity`).then((r) => r.data.data),
    retry: false,
  })

  const { data: loginData } = useQuery({
    queryKey: ['agent-login-history', id],
    queryFn: () => axiosClient.get(`/agents/${id}/login-history`).then((r) => r.data.data),
    staleTime: 30_000,
    enabled: !isError,
  })
  const recentSessions = (loginData?.loginHistory ?? []).slice(-6).reverse()

  const { data: scoreStats, isLoading: scoreLoading } = useQuery({
    queryKey: ['agent-score-detail', id],
    queryFn: () => axiosClient.get(`/performance/agency/agents/${id}`, { params: { period: 'month' } }).then((r) => r.data.data.stats),
    enabled: !isError,
    staleTime: 30_000,
  })

  const {
    data: dailyScoresData, isLoading: dailyScoresLoading, isError: dailyScoresError,
  } = useQuery({
    queryKey: ['agency-daily-scores', 30],
    queryFn: () => axiosClient.get('/performance/agency/daily-scores', { params: { days: 30 } }).then((r) => r.data.data),
    enabled: !isError,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
      </div>
    )
  }

  if (isError || !data) {
    const message = error?.response?.status === 403
      ? "You don't have access to this agent's activity."
      : "Could not load this agent's activity."
    return (
      <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-4">
        <button onClick={() => navigate(backTo)} className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]">
          <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
        </button>
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {message}
        </div>
      </div>
    )
  }

  const { user, leads, appointments } = data
  const fullName = `${user.firstName} ${user.lastName}`
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  const isSelf = viewer?._id === id

  const leadStatusData = scoreStats
    ? [
        { name: 'cold', value: scoreStats.coldCount ?? 0 },
        { name: 'warm', value: scoreStats.warmCount ?? 0 },
        { name: 'hot', value: scoreStats.hotCount ?? 0 },
        { name: 'listed', value: scoreStats.listedCount ?? 0 },
        { name: 'rented_out', value: scoreStats.rentedOutCount ?? 0 },
        { name: 'sold', value: scoreStats.soldCount ?? 0 },
        { name: 'lost', value: scoreStats.lostCount ?? 0 },
      ].filter((d) => d.value > 0)
    : []

  const teamSize = dailyScoresData?.agents?.length ?? 0
  const myDailySeries = (dailyScoresData?.series ?? []).map((day) => {
    const mine = day.agents.find((a) => a.userId === id)
    return { date: day.date, score: mine?.score ?? 0, rank: mine?.rank ?? null }
  })

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <button onClick={() => navigate(backTo)} className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
      </button>

      {/* Profile header */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ backgroundColor: BRAND }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight">{fullName}{isSelf && ' (You)'}</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ color: BRAND, backgroundColor: `${BRAND}18` }}>
              <Briefcase className="w-3 h-3" /> {user.isAgencyManager ? 'Company Manager' : 'Agent'}
            </span>
            {user.isAgencyManager && <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${user.isActive ? 'text-[#10B981] bg-[#10B981]/10' : 'text-[#EF4444] bg-[#EF4444]/10'}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: user.isActive ? '#10B981' : '#EF4444' }} />
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user.email}</span>
            <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {user.phone}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Joined {format(new Date(user.createdAt), 'd MMM yyyy')}</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {user.lastLoginAt ? `Active ${formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}` : 'Never logged in'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">Performance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <StatCard icon={Star} label="Score (This Month)" value={scoreStats?.score ?? 0} color="#F95C4B" delay={0} />
          <StatCard icon={Trophy} label="Company Rank" value={scoreStats?.rank ? `#${scoreStats.rank}` : '—'} sub={scoreStats?.total ? `of ${scoreStats.total} agents` : undefined} color="#F59E0B" delay={40} />
          <StatCard icon={Phone} label="Calls (This Month)" value={scoreStats?.totalCalls ?? 0} color="#FF8C7A" delay={80} />
          <StatCard icon={TrendingUp} label="Leads Closed" value={scoreStats?.leadsClosed ?? 0} color="#8B5CF6" delay={120} />
          <StatCard icon={CalendarCheck} label="Appointments Attended" value={scoreStats?.appointmentsAttended ?? 0} color="#10B981" delay={160} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard icon={Activity} title="Daily Points — Last 30 Days" delay={0}>
            {dailyScoresLoading ? (
              <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
            ) : dailyScoresError ? (
              <EmptyChart label="Couldn't load daily points." />
            ) : myDailySeries.every((d) => d.score === 0) ? (
              <EmptyChart label="No points scored in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={myDailySeries} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TrendTooltip />} />
                  <Line type="monotone" dataKey="score" name="Points" stroke="#F95C4B" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={900} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard icon={Trophy} title="Daily Company Rank — Last 30 Days" delay={60}>
            {dailyScoresLoading ? (
              <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
            ) : !teamSize ? (
              <EmptyChart label="No team data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={myDailySeries} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis dataKey="rank" reversed domain={[1, teamSize]} allowDecimals={false} tickFormatter={(v) => `#${v}`} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TrendTooltip />} />
                  <Line type="monotone" dataKey="rank" name="Rank" stroke="#8B5CF6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={900} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>

      <WorkingHoursSection endpoint={`/performance/agency/working-hours/${id}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard icon={Activity} title="Activity — Last 14 Days" delay={0}>
          {leads.total === 0 && appointments.total === 0 ? <EmptyChart label="No activity yet" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mergeSeries(leads.last14Days, appointments.last14Days)} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="leads" name="Leads" fill={BRAND} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
                <Bar dataKey="appointments" name="Appointments" fill="#F59E0B" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard icon={FileText} title="Leads by Status (This Month)" delay={60}>
          {scoreLoading ? <div className="h-[220px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div> : <PieBreakdown data={leadStatusData} colors={STATUS_COLORS} />}
        </ChartCard>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">Assigned Work</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Leads Assigned" value={leads.total} color={BRAND} delay={0} />
          <StatCard icon={CalendarCheck} label="Appointments" value={appointments.total} color="#FF8C7A" delay={40} />
          <StatCard icon={CheckCircle2} label="Completed" value={appointments.byStatus.completed ?? 0} color="#10B981" delay={80} />
          <StatCard icon={Home} label="Hot / Listed" value={(leads.byStatus.hot ?? 0) + (leads.byStatus.listed ?? 0)} color="#EF4444" delay={120} />
        </div>
      </section>

      <RecentListCard
        icon={CalendarCheck} title="Upcoming Appointments" items={appointments.upcoming}
        emptyLabel="No upcoming appointments" delay={0}
        renderItem={(a) => (
          <li key={a._id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${APPT_STATUS_COLORS[a.status]}18` }}>
              <CalendarCheck className="w-4 h-4" style={{ color: APPT_STATUS_COLORS[a.status] }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{a.leadId?.landlordName ?? 'Lead'}</p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {a.leadId?.propertyAddress}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold text-[#111111] dark:text-white">{format(new Date(a.scheduledDate), 'd MMM')}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{a.scheduledTime}</p>
            </div>
          </li>
        )}
      />

      <RecentListCard
        icon={Clock} title="Recent Login Sessions" items={recentSessions}
        emptyLabel="No login sessions recorded yet" delay={0}
        renderItem={(s, i) => (
          <li key={i} className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="text-xs font-semibold text-[#111111] dark:text-white">{format(new Date(s.loginAt), 'd MMM yyyy, HH:mm')}</p>
              {s.ip && <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{s.ip}</p>}
            </div>
            {s.logoutAt ? (
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">Signed out {format(new Date(s.logoutAt), 'HH:mm')}</p>
            ) : (
              <span className="text-[10px] font-semibold text-[#10B981]">Active session</span>
            )}
          </li>
        )}
      />
    </div>
  )
}
