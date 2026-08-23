import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  Bell,
  Clock,
  ArrowRight,
  Activity,
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Trophy,
  Crown,
  Medal,
  Home,
  TrendingUp,
  DollarSign,
  ClipboardList,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { agentsApi } from '../../services/agentsApi'

const APPT_META = {
  scheduled:  { label: 'Scheduled',  color: '#3B82F6' },
  confirmed:  { label: 'Confirmed',  color: '#10B981' },
  completed:  { label: 'Completed',  color: '#6B7280' },
  cancelled:  { label: 'Cancelled',  color: '#EF4444' },
  no_show:    { label: 'No Show',    color: '#F59E0B' },
}

function ApptBadge({ status }) {
  const meta = APPT_META[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
      {meta.label}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-14 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">{value ?? '—'}</p>
        )}
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
        {sub && !loading && <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, description, to, color }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="group flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#F95C4B]/40 hover:shadow-sm transition-all text-left w-full"
    >
      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{label}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#6B7280]/40 group-hover:text-[#F95C4B] transition-colors flex-shrink-0" />
    </button>
  )
}

const RANK_COLORS = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#B45309' }

export default function AgencyDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const [todayAppts, setTodayAppts] = useState([])
  const [upcomingAppts, setUpcomingAppts] = useState([])
  const [stats, setStats] = useState({ today: null, upcoming: null, unread: null, completed: null })
  const [loading, setLoading] = useState(true)

  const { data: myPerfStats } = useQuery({
    queryKey: ['agent-perf-snapshot'],
    queryFn: () => axiosClient.get('/performance/agents/me?period=week').then((r) => r.data.data.stats),
    staleTime: 60_000,
  })

  const { data: agentDash } = useQuery({
    queryKey: ['agent-dashboard'],
    queryFn: () => agentsApi.myDashboard().then((r) => r.data.data),
    staleTime: 60_000,
  })

  useEffect(() => {
    async function load() {
      const [todayRes, upcomingRes, notiRes] = await Promise.allSettled([
        axiosClient.get('/appointments/today'),
        axiosClient.get('/appointments?limit=10&status=scheduled'),
        axiosClient.get('/notifications?unread=true&limit=1'),
      ])

      const todayList =
        todayRes.status === 'fulfilled'
          ? (todayRes.value.data?.data?.appointments ?? todayRes.value.data?.data ?? [])
          : []

      const upcomingList =
        upcomingRes.status === 'fulfilled'
          ? (upcomingRes.value.data?.data?.appointments ?? [])
          : []

      setTodayAppts(todayList)
      setUpcomingAppts(upcomingList)
      setStats({
        today:     todayList.length,
        upcoming:  upcomingRes.status === 'fulfilled' ? upcomingRes.value.data?.data?.total ?? 0 : null,
        unread:    notiRes.status  === 'fulfilled' ? notiRes.value.data?.data?.total ?? 0 : null,
        completed: todayList.filter((a) => a.status === 'completed').length,
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
            {greeting}, {user?.firstName} 👋
          </h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {format(now, "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F95C4B]/10 border border-[#F95C4B]/20 self-start">
          <Activity className="w-4 h-4 text-[#F95C4B]" />
          <span className="text-xs font-semibold text-[#F95C4B]">Agency Active</span>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Today's Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={CalendarCheck}  label="Today's Appointments" value={stats.today}     sub={format(now, 'd MMM yyyy')} color="#F95C4B" loading={loading} />
          <StatCard icon={CheckCircle2}   label="Completed Today"      value={stats.completed} sub="Done for the day"           color="#10B981" loading={loading} />
          <StatCard icon={CalendarClock}  label="Scheduled"            value={stats.upcoming}  sub="All upcoming"               color="#F59E0B" loading={loading} />
          <StatCard icon={Bell}           label="Notifications"        value={stats.unread}    sub="Unread"                     color="#8B5CF6" loading={loading} />
        </div>
      </div>

      {/* Pipeline stats from /agents/me/dashboard */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          My Pipeline
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={TrendingUp}    label="Total Leads"         value={agentDash?.totalLeads}         sub="Assigned to me"     color="#3B82F6" loading={!agentDash} />
          <StatCard icon={ClipboardList} label="Active Leads"        value={agentDash?.activeLeads}        sub="Warm & hot"          color="#F95C4B" loading={!agentDash} />
          <StatCard icon={Home}          label="Total Visits"        value={agentDash?.totalVisits}        sub="All property visits"  color="#10B981" loading={!agentDash} />
          <StatCard icon={DollarSign}    label="Pending Commissions" value={agentDash?.pendingCommissions} sub="Awaiting payment"     color="#F59E0B" loading={!agentDash} />
        </div>
      </div>

      {/* Performance snapshot */}
      {myPerfStats && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
            My Performance This Week
          </h2>
          <div
            className="rounded-2xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-5 cursor-pointer hover:shadow-md transition-all"
            style={{
              borderColor: `${RANK_COLORS[myPerfStats.rank] ?? '#F95C4B'}40`,
              backgroundColor: `${RANK_COLORS[myPerfStats.rank] ?? '#F95C4B'}06`,
            }}
            onClick={() => navigate('/agency/leaderboard')}
          >
            {/* Rank block */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                style={{ backgroundColor: RANK_COLORS[myPerfStats.rank] ?? '#F95C4B' }}
              >
                {myPerfStats.rank === 1
                  ? <Crown className="w-7 h-7 text-white" strokeWidth={2} />
                  : <Medal className="w-7 h-7 text-white" strokeWidth={2} />}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Your Rank</p>
                <p className="text-3xl font-black text-[#111111] dark:text-white leading-none">
                  {myPerfStats.rank
                    ? `#${myPerfStats.rank}`
                    : '—'}
                  {myPerfStats.total > 0 && (
                    <span className="text-sm font-medium text-[#6B7280] ml-2">of {myPerfStats.total}</span>
                  )}
                </p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: RANK_COLORS[myPerfStats.rank] ?? '#F95C4B' }}>
                  Score: {myPerfStats.score ?? 0}
                </p>
              </div>
            </div>

            {/* Stats pills */}
            <div className="flex flex-wrap gap-2 flex-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6]/10">
                <Home className="w-3.5 h-3.5 text-[#3B82F6]" strokeWidth={1.75} />
                <span className="text-xs font-bold text-[#3B82F6]">{myPerfStats.totalVisits ?? 0}</span>
                <span className="text-[10px] text-[#6B7280]">visits</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={1.75} />
                <span className="text-xs font-bold text-[#10B981]">{myPerfStats.listingsSigned ?? 0}</span>
                <span className="text-[10px] text-[#6B7280]">listings</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F95C4B]/10">
                <TrendingUp className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
                <span className="text-xs font-bold text-[#F95C4B]">{myPerfStats.dealsClosed ?? 0}</span>
                <span className="text-[10px] text-[#6B7280]">deals</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F95C4B] flex-shrink-0">
              <Trophy className="w-3.5 h-3.5" strokeWidth={1.75} />
              View leaderboard
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* Today's appointments */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Today's Appointments</span>
          </div>
          <a href="/agency/appointments" className="text-xs font-semibold text-[#F95C4B] hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
            ))}
          </div>
        ) : todayAppts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CalendarCheck className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#111111] dark:text-white">No appointments today</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Your schedule is clear for today</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {todayAppts.map((a) => (
              <li key={a._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-[#F95C4B] leading-none">{a.scheduledTime ?? '--'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                    {a.leadId?.landlordName ?? 'Appointment'}
                  </p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    {a.leadId?.propertyAddress ?? 'Address TBD'}
                  </p>
                </div>
                <ApptBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Upcoming Appointments</span>
          </div>
          <a href="/agency/appointments" className="text-xs font-semibold text-[#F95C4B] hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
            ))}
          </div>
        ) : upcomingAppts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertCircle className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#111111] dark:text-white">No upcoming appointments</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">New appointments will appear here when scheduled</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {upcomingAppts.slice(0, 5).map((a) => (
              <li key={a._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-[#F59E0B] leading-none">
                    {a.scheduledDate ? format(new Date(a.scheduledDate), 'dd') : '--'}
                  </span>
                  <span className="text-[8px] text-[#F59E0B]/70 leading-none uppercase">
                    {a.scheduledDate ? format(new Date(a.scheduledDate), 'MMM') : ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                    {a.leadId?.landlordName ?? 'Appointment'}
                  </p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    {a.leadId?.propertyAddress ?? 'Address TBD'}
                    {a.scheduledTime && <span className="ml-1">· {a.scheduledTime}</span>}
                  </p>
                </div>
                <ApptBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction icon={CalendarCheck} label="All Appointments"  description="View your full appointment schedule" to="/agency/appointments"  color="#F95C4B" />
          <QuickAction icon={TrendingUp}    label="My Leads"          description="Leads assigned to you"               to="/agency/leads"         color="#3B82F6" />
          <QuickAction icon={Trophy}        label="Leaderboard"       description="See your rank among agents"          to="/agency/leaderboard"   color="#F59E0B" />
          <QuickAction icon={Bell}          label="Notifications"     description="Team updates and alerts"              to="/agency/notifications" color="#8B5CF6" />
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Account
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Role',       value: 'Agency' },
            { label: 'Last Login', value: user?.lastLoginAt ? format(new Date(user.lastLoginAt), 'd MMM yyyy, HH:mm') : '—' },
            { label: 'Email',      value: user?.email ?? '—' },
            { label: 'Status',     value: user?.isActive ? 'Active' : 'Inactive' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1">{label}</p>
              <p className="text-sm font-medium text-[#111111] dark:text-white truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
