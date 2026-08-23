import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PhoneCall,
  TrendingUp,
  CalendarCheck,
  Bell,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  PhoneOff,
  PhoneMissed,
  Activity,
  Trophy,
  Star,
  Crown,
  Medal,
} from 'lucide-react'
import { format } from 'date-fns'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

/* ─── Stat Card ────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color, loading, badge }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
        </div>
        {badge}
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

/* ─── Performance snapshot ────────────────────────────────────────── */
function PerformanceSnapshot({ myStats, loading }) {
  const navigate = useNavigate()
  const rank = myStats?.rank
  const rankColor = rank === 1 ? '#F59E0B' : rank === 2 ? '#9CA3AF' : rank === 3 ? '#B45309' : '#F95C4B'
  return (
    <button
      onClick={() => navigate('/cold-caller/leaderboard')}
      className="group w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#F95C4B]/5 to-transparent border border-[#F95C4B]/20 hover:border-[#F95C4B]/40 hover:shadow-sm transition-all text-left"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
        <Trophy className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#111111] dark:text-white">My Leaderboard Position</p>
        {loading ? (
          <div className="h-3 w-24 mt-1 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
        ) : (
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
            {rank
              ? <><span className="font-bold" style={{ color: rankColor }}>#{rank}</span> of {myStats.total} · {myStats.score} pts today</>
              : 'No activity today — make some calls!'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!loading && rank && rank <= 3 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${rankColor}20` }}>
            {rank === 1
              ? <Crown  className="w-3.5 h-3.5" style={{ color: rankColor }} />
              : <Medal  className="w-3.5 h-3.5" style={{ color: rankColor }} />
            }
          </div>
        )}
        <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#F95C4B] transition-colors" />
      </div>
    </button>
  )
}

/* ─── Outcome Badge ───────────────────────────────────────────────── */
const OUTCOME_META = {
  no_answer:          { label: 'No Answer',      color: '#6B7280', Icon: PhoneMissed },
  voicemail:          { label: 'Voicemail',      color: '#6B7280', Icon: PhoneMissed },
  wrong_number:       { label: 'Wrong No.',      color: '#8B5CF6', Icon: XCircle },
  remove_me:          { label: 'Remove Me',      color: '#EF4444', Icon: PhoneOff },
  not_interested:     { label: 'Not Interested', color: '#F97316', Icon: PhoneOff },
  interested:         { label: 'Interested',     color: '#10B981', Icon: CheckCircle2 },
  callback_requested: { label: 'Callback',       color: '#F59E0B', Icon: Clock },
}

function OutcomeBadge({ outcome }) {
  const meta = OUTCOME_META[outcome] ?? { label: outcome, color: '#6B7280', Icon: PhoneCall }
  const Icon = meta.Icon
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {meta.label}
    </span>
  )
}

/* ─── Quick Action ────────────────────────────────────────────────── */
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

/* ─── Main ────────────────────────────────────────────────────────── */
export default function ColdCallerDashboard() {
  const { user } = useAuthStore()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const [stats, setStats] = useState({ leads: null, callLogs: null, appointments: null, unread: null })
  const [recentLogs, setRecentLogs] = useState([])
  const [todayAppts, setTodayAppts] = useState([])
  const [loading, setLoading] = useState(true)

  const { data: myStats, isLoading: statsLoading } = useQuery({
    queryKey: ['performance', 'my-stats', 'day'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/performance/me?period=day')
      return data.data.stats
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    async function load() {
      const [leadsRes, logsRes, apptRes, notiRes] = await Promise.allSettled([
        axiosClient.get('/leads?limit=1'),
        axiosClient.get('/call-logs?limit=1'),
        axiosClient.get('/appointments/today'),
        axiosClient.get('/notifications?unread=true&limit=1'),
      ])

      const [recentLogsRes] = await Promise.allSettled([
        axiosClient.get('/call-logs?limit=5'),
      ])

      setStats({
        leads:        leadsRes.status   === 'fulfilled' ? leadsRes.value.data?.data?.total        ?? 0 : null,
        callLogs:     logsRes.status    === 'fulfilled' ? logsRes.value.data?.data?.total         ?? 0 : null,
        appointments: apptRes.status    === 'fulfilled' ? (apptRes.value.data?.data?.appointments ?? apptRes.value.data?.data ?? []).length : null,
        unread:       notiRes.status    === 'fulfilled' ? notiRes.value.data?.data?.total         ?? 0 : null,
      })

      setRecentLogs(
        recentLogsRes.status === 'fulfilled'
          ? recentLogsRes.value.data?.data?.callLogs ?? []
          : []
      )

      setTodayAppts(
        apptRes.status === 'fulfilled'
          ? (apptRes.value.data?.data?.appointments ?? apptRes.value.data?.data ?? [])
          : []
      )

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
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 self-start">
          <Activity className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-semibold text-[#3B82F6]">Cold Caller Active</span>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          My Activity
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={PhoneCall}
            label="Total Call Logs"
            value={stats.callLogs}
            sub="All time"
            color="#3B82F6"
            loading={loading}
          />
          <StatCard
            icon={TrendingUp}
            label="Leads Created"
            value={stats.leads}
            sub="All time"
            color="#10B981"
            loading={loading}
          />
          <StatCard
            icon={CalendarCheck}
            label="Today's Appointments"
            value={stats.appointments}
            sub={format(now, 'd MMM yyyy')}
            color="#F59E0B"
            loading={loading}
          />
          <StatCard
            icon={Bell}
            label="Unread Notifications"
            value={stats.unread}
            color="#8B5CF6"
            loading={loading}
          />
        </div>
      </div>

      {/* Performance snapshot */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">
          Today's Performance
        </h2>
        <PerformanceSnapshot myStats={myStats} loading={statsLoading} />
      </div>

      {/* Today's appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white">Today's Appointments</span>
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-10 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CalendarCheck className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No appointments today</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {todayAppts.slice(0, 5).map((a) => (
                <li key={a._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {a.contactName ?? a.leadId?.landlordName ?? 'Appointment'}
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
                      {a.scheduledAt ? format(new Date(a.scheduledAt), 'HH:mm') : '—'} · {a.location ?? 'Location TBD'}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    a.status === 'confirmed'  ? 'bg-[#10B981]/10 text-[#10B981]' :
                    a.status === 'scheduled'  ? 'bg-[#3B82F6]/10 text-[#3B82F6]' :
                    a.status === 'cancelled'  ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                    'bg-[#F59E0B]/10 text-[#F59E0B]'
                  }`}>
                    {a.status ?? 'scheduled'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent call logs */}
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white">Recent Calls</span>
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-10 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <PhoneCall className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No calls logged yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {recentLogs.map((log) => (
                <li key={log._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {log.contactId?.firstName
                        ? `${log.contactId.firstName} ${log.contactId.lastName ?? ''}`
                        : 'Contact'}
                    </p>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                      {log.calledAt ? format(new Date(log.calledAt), 'd MMM, HH:mm') : '—'}
                    </p>
                  </div>
                  <OutcomeBadge outcome={log.outcome} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction icon={PhoneCall}    label="Call Logs"       description="View & log call outcomes"       to="/cold-caller/call-logs"    color="#3B82F6" />
          <QuickAction icon={TrendingUp}   label="My Leads"        description="Leads you've generated"         to="/cold-caller/leads"        color="#10B981" />
          <QuickAction icon={CalendarCheck} label="Appointments"   description="Appointments you've booked"     to="/cold-caller/appointments" color="#F59E0B" />
          <QuickAction icon={Trophy}       label="Leaderboard"     description="See your rank against the team" to="/cold-caller/leaderboard"  color="#F95C4B" />
          <QuickAction icon={Bell}         label="Notifications"   description="Team updates & alerts"          to="/cold-caller/notifications" color="#8B5CF6" />
        </div>
      </div>

      {/* System info */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Account
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Role',       value: 'Cold Caller' },
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
