import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Flame, CalendarCheck, Bell, Clock, ArrowRight, Activity, MapPin,
  Building2, AlertTriangle, CalendarClock, Home,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, isPast } from 'date-fns'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { leadsApi } from '../../services/leadsApi'

const APPT_META = {
  scheduled: { label: 'Scheduled', color: '#3B82F6' },
  confirmed: { label: 'Confirmed', color: '#10B981' },
  completed: { label: 'Completed', color: '#6B7280' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
  no_show:   { label: 'No Show',   color: '#F59E0B' },
}

function ApptBadge({ status }) {
  const meta = APPT_META[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
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
      className="group flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#8B5CF6]/40 hover:shadow-sm transition-all text-left w-full"
    >
      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{label}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#6B7280]/40 group-hover:text-[#8B5CF6] transition-colors flex-shrink-0" />
    </button>
  )
}

export default function FollowUpManagerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const [todayAppts, setTodayAppts] = useState([])
  const [stats, setStats] = useState({ today: null, unread: null })
  const [loadingAppts, setLoadingAppts] = useState(true)

  const { data: hotLeadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ['fum-dashboard-leads'],
    queryFn: () => leadsApi.list({ limit: 100 }).then((r) => r.data.data.leads ?? []),
    staleTime: 30_000,
  })
  const hotLeads = hotLeadsData ?? []
  const unassignedCount = hotLeads.filter((l) => !l.assignedAgent).length
  const overdueLeads = hotLeads
    .filter((l) => l.followUpDate && isPast(new Date(l.followUpDate)))
    .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate))
    .slice(0, 5)

  useEffect(() => {
    async function load() {
      const [todayRes, notiRes] = await Promise.allSettled([
        axiosClient.get('/appointments/today'),
        axiosClient.get('/notifications?unread=true&limit=1'),
      ])
      const todayList = todayRes.status === 'fulfilled'
        ? (todayRes.value.data?.data?.appointments ?? [])
        : []
      setTodayAppts(todayList)
      setStats({
        today: todayList.length,
        unread: notiRes.status === 'fulfilled' ? notiRes.value.data?.data?.total ?? 0 : null,
      })
      setLoadingAppts(false)
    }
    load()
  }, [])

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-8">

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
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 self-start">
          <Activity className="w-4 h-4 text-[#8B5CF6]" />
          <span className="text-xs font-semibold text-[#8B5CF6]">Follow-Up Manager Active</span>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Today's Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Flame}         label="Hot Leads"          value={hotLeads.length}   sub="Currently in your queue" color="#8B5CF6" loading={loadingLeads} />
          <StatCard icon={Building2}     label="No Agency Assigned" value={unassignedCount}   sub="Still need routing"      color="#F59E0B" loading={loadingLeads} />
          <StatCard icon={CalendarCheck} label="Today's Appointments" value={stats.today}    sub={format(now, 'd MMM yyyy')} color="#3B82F6" loading={loadingAppts} />
          <StatCard icon={Bell}          label="Notifications"      value={stats.unread}      sub="Unread"                   color="#F95C4B" loading={loadingAppts} />
        </div>
      </div>

      {/* Overdue follow-ups */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Overdue Follow-ups</span>
          </div>
          <button onClick={() => navigate('/follow-up-manager/leads')} className="text-xs font-semibold text-[#8B5CF6] hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loadingLeads ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-14 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
          </div>
        ) : overdueLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Flame className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#111111] dark:text-white">Nothing overdue</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Every hot lead's follow-up is on track</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {overdueLeads.map((l) => (
              <li key={l._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-[#EF4444]" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {l.propertyAddress}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[#EF4444] flex-shrink-0">
                  Due {format(new Date(l.followUpDate), 'd MMM')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Today's appointments */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Today's Appointments</span>
          </div>
          <button onClick={() => navigate('/follow-up-manager/appointments')} className="text-xs font-semibold text-[#8B5CF6] hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loadingAppts ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
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
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-[#3B82F6] leading-none">{a.scheduledTime ?? '--'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{a.leadId?.landlordName ?? 'Appointment'}</p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {a.leadId?.propertyAddress ?? 'Address TBD'}
                  </p>
                </div>
                <ApptBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction icon={Flame}         label="Hot Leads"      description="See every hot lead you're working"     to="/follow-up-manager/leads"         color="#8B5CF6" />
          <QuickAction icon={CalendarCheck} label="Appointments"   description="View and schedule property visits"     to="/follow-up-manager/appointments"  color="#3B82F6" />
          <QuickAction icon={Bell}          label="Notifications"  description="Updates and alerts"                    to="/follow-up-manager/notifications" color="#F95C4B" />
          <QuickAction icon={Home}          label="Contact Admin"  description="Reach out for anything you're unsure of" to="/follow-up-manager/chat"        color="#10B981" />
        </div>
      </div>

      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Account
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Role',       value: 'Follow Up Manager' },
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
