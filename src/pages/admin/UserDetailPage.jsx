import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, Phone, Mail, Calendar, Clock, Flame, PhoneCall, Users,
  CheckCircle2, Home, FileText, CalendarCheck, Activity, ShieldCheck,
  PhoneMissed, AlertTriangle, MapPin, Briefcase, Database, UserCog, Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { usersApi } from '../../services/usersApi'

/* ─── Shared color conventions (match the rest of the app) ──────────────── */

const BRAND = '#F95C4B'
const ROLE_META = {
  admin:             { label: 'Administrator',     color: '#F95C4B', Icon: ShieldCheck },
  cold_caller:       { label: 'Cold Caller',        color: '#3B82F6', Icon: PhoneCall },
  agency:            { label: 'Agency',             color: '#10B981', Icon: Briefcase },
  follow_up_manager: { label: 'Follow Up Manager',  color: '#8B5CF6', Icon: Flame },
}
const STATUS_COLORS = {
  cold: '#6B7280', warm: '#F59E0B', hot: '#EF4444', listed: '#8B5CF6',
  rented_out: '#10B981', sold: '#F95C4B', lost: '#9CA3AF',
}
const OUTCOME_COLORS = {
  interested: '#10B981', no_answer: '#F59E0B', callback_requested: '#3B82F6',
  wrong_number: '#8B5CF6', remove_me: '#EF4444', voicemail: '#6B7280', not_interested: '#F97316',
}
const APPT_STATUS_COLORS = {
  scheduled: '#3B82F6', confirmed: '#10B981', completed: '#6B7280', cancelled: '#EF4444', no_show: '#F59E0B',
}
const OUTCOME_LABEL = {
  interested: 'Interested', no_answer: 'No Answer', callback_requested: 'Callback Requested',
  wrong_number: 'Wrong Number', remove_me: 'Remove Me', voicemail: 'Voicemail', not_interested: 'Not Interested',
}

function labelize(s) {
  return (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ─── Small building blocks ──────────────────────────────────────────────── */

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
    <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-center">
      <Activity className="w-8 h-8 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
    </div>
  )
}

function PieBreakdown({ data, colors, labelMap }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  if (total === 0) return <EmptyChart label="No data yet" />
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} isAnimationActive>
            {data.map((d) => (
              <Cell key={d.name} fill={colors[d.name] ?? '#6B7280'} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [v, labelMap?.[n] ?? labelize(n)]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 min-w-0">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[d.name] ?? '#6B7280' }} />
            <span className="text-[#6B7280] dark:text-[#A1A1AA] truncate flex-1">{labelMap?.[d.name] ?? labelize(d.name)}</span>
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
        <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
          {items.map(renderItem)}
        </ul>
      )}
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-activity', id],
    queryFn: () => usersApi.activity(id).then((r) => r.data.data),
  })

  const { data: loginData } = useQuery({
    queryKey: ['user-login-history', id],
    queryFn: () => usersApi.loginHistory(id).then((r) => r.data.data),
    staleTime: 30_000,
  })
  const recentSessions = (loginData?.loginHistory ?? []).slice(-6).reverse()

  if (isLoading) {
    return (
      <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-5 sm:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Could not load this user's activity.
        </div>
      </div>
    )
  }

  const { user, systemTotals, contacts, callLogs, leads, appointments } = data
  const roleMeta = ROLE_META[user.role] ?? { label: labelize(user.role), color: BRAND, Icon: UserCog }
  const RoleIcon = roleMeta.Icon
  const fullName = `${user.firstName} ${user.lastName}`
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()

  const leadStatusData = leads
    ? Object.entries(leads.byStatus).map(([name, value]) => ({ name, value }))
    : []
  const outcomeData = callLogs
    ? Object.entries(callLogs.outcomeBreakdown).map(([name, value]) => ({ name, value }))
    : []
  // Contacts is excluded here — it already has its own stat card above, and its raw
  // count runs an order of magnitude ahead of everything else, which would otherwise
  // flatten Leads/Appointments/Call Logs into invisible slivers on a linear axis.
  const operationsData = systemTotals ? [
    { name: 'Leads', value: systemTotals.totalLeads, fill: '#F95C4B' },
    { name: 'Appointments', value: systemTotals.totalAppointments, fill: '#10B981' },
    { name: 'Call Logs', value: systemTotals.totalCallLogs, fill: '#F59E0B' },
  ] : []

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Users
      </button>

      {/* Profile header */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
          style={{ backgroundColor: roleMeta.color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight">{fullName}</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ color: roleMeta.color, backgroundColor: `${roleMeta.color}18` }}
            >
              <RoleIcon className="w-3 h-3" /> {roleMeta.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
              user.isActive ? 'text-[#10B981] bg-[#10B981]/10' : 'text-[#EF4444] bg-[#EF4444]/10'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: user.isActive ? '#10B981' : '#EF4444' }} />
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user.email}</span>
            <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {user.phone}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Joined {format(new Date(user.createdAt), 'd MMM yyyy')}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {user.lastLoginAt ? `Active ${formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}` : 'Never logged in'}
            </span>
          </div>
        </div>
      </div>

      {/* ── COLD CALLER ─────────────────────────────────────────────────── */}
      {user.role === 'cold_caller' && contacts && (
        <>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
              Contact Queue
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Users}        label="Assigned"        value={contacts.assigned}       color="#3B82F6" delay={0} />
              <StatCard icon={CheckCircle2} label="Managed to Call"  value={contacts.calledEver}     sub="All-time"        color="#10B981" delay={40} />
              <StatCard icon={PhoneMissed}  label="Left to Call Today" value={contacts.remainingToday} sub="Today's queue"  color="#F59E0B" delay={80} />
              <StatCard icon={Clock}        label="Called Yesterday" value={contacts.calledYesterday} color="#8B5CF6" delay={120} />
              <StatCard icon={AlertTriangle} label="Do Not Call"     value={contacts.dnc}            color="#EF4444" delay={160} />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard icon={Activity} title="Calls — Last 14 Days" delay={0}>
              {callLogs.total === 0 ? <EmptyChart label="No calls logged yet" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={callLogs.last14Days} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="callFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TrendTooltip />} />
                    <Area type="monotone" dataKey="count" name="Calls" stroke="#3B82F6" strokeWidth={2} fill="url(#callFill)" isAnimationActive animationDuration={900} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard icon={PhoneCall} title="Call Outcomes" delay={60}>
              <PieBreakdown data={outcomeData} colors={OUTCOME_COLORS} labelMap={OUTCOME_LABEL} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentListCard
              icon={FileText} title={`Leads Created (${leads.total})`} items={leads.recent}
              emptyLabel="No leads created yet" delay={0}
              renderItem={(l) => (
                <li key={l._id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${STATUS_COLORS[l.status]}18` }}>
                    <FileText className="w-4 h-4" style={{ color: STATUS_COLORS[l.status] }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {l.propertyAddress}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: STATUS_COLORS[l.status], backgroundColor: `${STATUS_COLORS[l.status]}15` }}>
                    {labelize(l.status)}
                  </span>
                </li>
              )}
            />
            <RecentListCard
              icon={PhoneCall} title="Recent Calls" items={callLogs.recent}
              emptyLabel="No calls logged yet" delay={60}
              renderItem={(c) => (
                <li key={c._id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OUTCOME_COLORS[c.outcome]}18` }}>
                    <PhoneCall className="w-4 h-4" style={{ color: OUTCOME_COLORS[c.outcome] }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{c.contactName}</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">{c.contactPhone}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-semibold" style={{ color: OUTCOME_COLORS[c.outcome] }}>{OUTCOME_LABEL[c.outcome] ?? c.outcome}</p>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{formatDistanceToNow(new Date(c.calledAt), { addSuffix: true })}</p>
                  </div>
                </li>
              )}
            />
          </div>
        </>
      )}

      {/* ── AGENCY / FOLLOW UP MANAGER ──────────────────────────────────── */}
      {(user.role === 'agency' || user.role === 'follow_up_manager') && leads && appointments && (
        <>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
              {user.role === 'agency' ? 'Assigned Work' : 'Hot Leads Worked'}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={FileText} label={user.role === 'agency' ? 'Leads Assigned' : 'Leads Followed Up'} value={leads.total} color={roleMeta.color} delay={0} />
              <StatCard icon={CalendarCheck} label="Appointments" value={appointments.total} color="#3B82F6" delay={40} />
              <StatCard icon={CheckCircle2} label="Completed" value={appointments.byStatus.completed ?? 0} color="#10B981" delay={80} />
              <StatCard icon={Home} label="Hot / Listed" value={(leads.byStatus.hot ?? 0) + (leads.byStatus.listed ?? 0)} color="#EF4444" delay={120} />
            </div>
          </section>

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
                    <Bar dataKey="leads" name="Leads" fill={roleMeta.color} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
                    <Bar dataKey="appointments" name="Appointments" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard icon={FileText} title="Leads by Status" delay={60}>
              <PieBreakdown data={leadStatusData} colors={STATUS_COLORS} />
            </ChartCard>
          </div>

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
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{a.leadId?.propertyAddress}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-[#111111] dark:text-white">{format(new Date(a.scheduledDate), 'd MMM')}</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{a.scheduledTime}</p>
                </div>
              </li>
            )}
          />
        </>
      )}

      {/* ── ADMIN ────────────────────────────────────────────────────────── */}
      {user.role === 'admin' && (
        <>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
              System-Wide Totals
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Users}         label="Total Contacts"     value={systemTotals.totalContacts}     color="#3B82F6" delay={0} />
              <StatCard icon={FileText}      label="Total Leads"        value={systemTotals.totalLeads}        color="#F95C4B" delay={40} />
              <StatCard icon={CalendarCheck} label="Total Appointments" value={systemTotals.totalAppointments} color="#10B981" delay={80} />
              <StatCard icon={PhoneCall}     label="Total Call Logs"    value={systemTotals.totalCallLogs}     color="#F59E0B" delay={120} />
              <StatCard icon={UserCog}       label="Team Members"       value={systemTotals.totalUsers}        color="#8B5CF6" delay={160} />
            </div>
          </section>

          <ChartCard icon={Database} title="Operations Breakdown" delay={0}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={operationsData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F5F5F4' }} formatter={(v) => v.toLocaleString()} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900}>
                  {operationsData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {leads && appointments && (
            <>
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
                  Personally Logged
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={FileText} label="Leads Created" value={leads.total} color="#F95C4B" delay={0} />
                  <StatCard icon={CalendarCheck} label="Appointments Booked" value={appointments.total} color="#3B82F6" delay={40} />
                  <StatCard icon={Flame} label="Hot Leads" value={leads.byStatus.hot ?? 0} color="#EF4444" delay={80} />
                  <StatCard icon={CheckCircle2} label="Closed (Listed/Sold/Rented)" value={(leads.byStatus.listed ?? 0) + (leads.byStatus.sold ?? 0) + (leads.byStatus.rented_out ?? 0)} color="#10B981" delay={120} />
                </div>
              </section>

              {leads.total > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard icon={Activity} title="My Activity — Last 14 Days" delay={0}>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={mergeSeries(leads.last14Days, appointments.last14Days)} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<TrendTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="leads" name="Leads" stroke={BRAND} strokeWidth={2} fill="url(#adminFill)" isAnimationActive animationDuration={900} />
                        <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#3B82F6" strokeWidth={2} fillOpacity={0} isAnimationActive animationDuration={900} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard icon={FileText} title="My Leads by Status" delay={60}>
                    <PieBreakdown data={leadStatusData} colors={STATUS_COLORS} />
                  </ChartCard>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Recent login sessions — role-agnostic, shown for everyone */}
      <RecentListCard
        icon={Clock} title="Recent Login Sessions" items={recentSessions}
        emptyLabel="No login sessions recorded yet" delay={0}
        renderItem={(s, i) => (
          <li key={i} className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="text-xs font-semibold text-[#111111] dark:text-white">
                {format(new Date(s.loginAt), 'd MMM yyyy, HH:mm')}
              </p>
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

// Merges two {date,count}[] series (same 14-day date range from bucketByDay on the
// backend) into one array of {date, leads, appointments} rows for a combined chart.
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
