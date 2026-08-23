import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  TrendingUp,
  DollarSign,
  Bell,
  Clock,
  ArrowRight,
  CheckCircle2,
  Activity,
  MapPin,
  RotateCcw,
  AlertCircle,
  Star,
  Building2,
} from 'lucide-react'
import { format, isToday } from 'date-fns'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

/* ─── Stat Card ────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
        </div>
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

/* ─── Pending Card ─────────────────────────────────────────────────── */
function PendingCard({ icon: Icon, title, description, color = '#F59E0B' }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#0F0F0F]">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#111111] dark:text-white">{title}</p>
        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{description}</p>
      </div>
      <span className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] text-[9px] font-bold uppercase tracking-wide">
        Pending
      </span>
    </div>
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

/* ─── Lead Status Badge ───────────────────────────────────────────── */
const LEAD_META = {
  cold:      { label: 'Cold',      color: '#3B82F6' },
  warm:      { label: 'Warm',      color: '#F59E0B' },
  hot:       { label: 'Hot',       color: '#EF4444' },
  converted: { label: 'Converted', color: '#10B981' },
  lost:      { label: 'Lost',      color: '#6B7280' },
}

function LeadBadge({ status }) {
  const meta = LEAD_META[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
      {meta.label}
    </span>
  )
}

/* ─── Appointment Status Badge ────────────────────────────────────── */
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

/* ─── Main ────────────────────────────────────────────────────────── */
export default function AgentDashboard() {
  const { user } = useAuthStore()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const [stats, setStats] = useState({ leads: null, todayAppts: null, unread: null })
  const [recentLeads, setRecentLeads] = useState([])
  const [todayAppts, setTodayAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [leadsRes, apptRes, notiRes, recentLeadsRes] = await Promise.allSettled([
        axiosClient.get('/leads?limit=1'),
        axiosClient.get('/appointments/today'),
        axiosClient.get('/notifications?unread=true&limit=1'),
        axiosClient.get('/leads?limit=5'),
      ])

      const apptList =
        apptRes.status === 'fulfilled'
          ? (apptRes.value.data?.data?.appointments ?? apptRes.value.data?.data ?? [])
          : []

      setStats({
        leads:      leadsRes.status === 'fulfilled' ? leadsRes.value.data?.data?.total ?? 0 : null,
        todayAppts: apptList.length,
        unread:     notiRes.status  === 'fulfilled' ? notiRes.value.data?.data?.total  ?? 0 : null,
      })

      setTodayAppts(apptList)
      setRecentLeads(
        recentLeadsRes.status === 'fulfilled'
          ? recentLeadsRes.value.data?.data?.leads ?? []
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
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 self-start">
          <Activity className="w-4 h-4 text-[#10B981]" />
          <span className="text-xs font-semibold text-[#10B981]">Agent Active</span>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          My Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CalendarCheck}
            label="Today's Appointments"
            value={stats.todayAppts}
            sub={format(now, 'd MMM yyyy')}
            color="#F59E0B"
            loading={loading}
          />
          <StatCard
            icon={TrendingUp}
            label="Active Leads"
            value={stats.leads}
            sub="Assigned to me"
            color="#10B981"
            loading={loading}
          />
          <StatCard
            icon={DollarSign}
            label="Commissions"
            value="—"
            sub="Pending access"
            color="#F95C4B"
            loading={false}
          />
          <StatCard
            icon={Bell}
            label="Notifications"
            value={stats.unread}
            sub="Unread"
            color="#8B5CF6"
            loading={loading}
          />
        </div>
      </div>

      {/* Pending integrations */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PendingCard
            icon={DollarSign}
            title="My Commissions"
            description="View your pending, invoiced, and paid commissions in one place."
            color="#F95C4B"
          />
          <PendingCard
            icon={RotateCcw}
            title="Lease Renewals"
            description="Track upcoming lease renewals for properties you've closed."
            color="#EC4899"
          />
          <PendingCard
            icon={Star}
            title="Deal Performance"
            description="Win rate, average deal size, and monthly deal breakdown."
            color="#F59E0B"
          />
          <PendingCard
            icon={MapPin}
            title="Property Map View"
            description="View your appointments and leads on an interactive map."
            color="#3B82F6"
          />
        </div>
      </div>

      {/* Today's appts + Recent leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today's appointments */}
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white">Today's Appointments</span>
            </div>
            <button
              onClick={() => {}}
              className="text-xs font-semibold text-[#F95C4B] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CalendarCheck className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[#111111] dark:text-white">Clear schedule today</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No appointments are booked for today</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {todayAppts.slice(0, 5).map((a) => (
                <li key={a._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#F59E0B]/10 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-[#F59E0B] leading-none">
                      {a.scheduledAt ? format(new Date(a.scheduledAt), 'HH') : '--'}
                    </span>
                    <span className="text-[8px] text-[#F59E0B]/70 leading-none">
                      {a.scheduledAt ? format(new Date(a.scheduledAt), 'mm') : '--'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {a.contactName ?? a.leadId?.landlordName ?? a.leadId?.propertyAddress ?? 'Appointment'}
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 truncate">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                      {a.location ?? 'Location TBD'}
                    </p>
                  </div>
                  <ApptBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent leads */}
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#10B981]" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white">Recent Leads</span>
            </div>
            <button
              onClick={() => {}}
              className="text-xs font-semibold text-[#F95C4B] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <TrendingUp className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[#111111] dark:text-white">No leads yet</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Leads assigned to you will appear here</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {recentLeads.map((lead) => (
                <li key={lead._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#10B981]" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {lead.landlordName ?? lead.propertyAddress ?? 'Lead'}
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
                      {lead.propertyAddress ?? lead.suburb ?? '—'}
                    </p>
                  </div>
                  <LeadBadge status={lead.status} />
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
          <QuickAction icon={CalendarCheck} label="Appointments"    description="View your schedule"                 to="/agent/appointments"  color="#F59E0B" />
          <QuickAction icon={TrendingUp}    label="My Leads"        description="Manage your lead pipeline"          to="/agent/leads"         color="#10B981" />
          <QuickAction icon={Bell}          label="Notifications"   description="Team updates & alerts"              to="/agent/notifications" color="#8B5CF6" />
        </div>
      </div>

      {/* System info */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Account
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Role',       value: 'Agent' },
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
