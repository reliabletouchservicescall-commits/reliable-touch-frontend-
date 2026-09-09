import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  BarChart2, Users, PhoneCall, TrendingUp,
  CheckCircle2, Clock, Building2, UserCheck, Target,
} from 'lucide-react'
import axiosClient from '../../lib/axios'

const BRAND = '#F95C4B'

// ── Shared UI ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      {loading
        ? <div className="h-8 w-20 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
        : <p className="text-3xl font-black text-[#111111] dark:text-white tracking-tight">{value ?? '—'}</p>}
      <div>
        <p className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        {sub && !loading && (
          <p className="text-[10px] text-[#6B7280]/60 dark:text-[#A1A1AA]/50 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, sub, children, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <p className="text-sm font-bold text-[#111111] dark:text-white">{title}</p>
        {sub && <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{sub}</p>}
      </div>
      <div className="p-4">
        {loading
          ? <div className="h-56 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
          : children}
      </div>
    </div>
  )
}

function chartColors(isDark) {
  return {
    grid:  isDark ? '#2A2A2A' : '#F5F5F4',
    text:  isDark ? '#A1A1AA' : '#6B7280',
    bg:    isDark ? '#181818' : '#ffffff',
  }
}

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-[#111111] dark:text-white mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="font-bold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────

function DailyCallsChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BRAND} stopOpacity={0.25} />
            <stop offset="95%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickFormatter={(v) => v.slice(5)} // MM-DD
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="calls"
          name="Calls"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#callGrad)"
          dot={false}
          activeDot={{ r: 4, fill: BRAND }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function LeadPipelineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F5F4' }} />
        <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CallsByHourChart({ data }) {
  // find peak hour
  const maxVal = Math.max(...data.map((d) => d.calls), 1)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 9, fill: '#9CA3AF' }}
          interval={2}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F5F4', radius: 4 }} />
        <Bar dataKey="calls" name="Calls" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.calls === maxVal ? BRAND : '#F95C4B55'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function WeeklyLeadTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v) => <span style={{ color: '#6B7280' }}>{v}</span>}
        />
        <Line
          type="monotone" dataKey="created" name="Created"
          stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone" dataKey="closed" name="Closed"
          stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function AppointmentStatusChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width={200} height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={88}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
            <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] flex-1">{d.name}</span>
            <span className="text-xs font-bold text-[#111111] dark:text-white">{d.value}</span>
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] w-8 text-right">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
        <p className="text-[10px] text-[#6B7280]/60 pt-1">Total: {total.toLocaleString()}</p>
      </div>
    </div>
  )
}

function SystemGrowthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v) => <span style={{ color: '#6B7280' }}>{v}</span>}
        />
        <Bar dataKey="contacts" name="New Contacts" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="leads"    name="New Leads"    fill={BRAND}   radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => axiosClient.get('/reports/dashboard').then((r) => r.data.data),
    staleTime: 120_000,
  })

  const kpis   = data?.kpis   ?? {}
  const charts = data?.charts ?? {}

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">System Reports</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Live overview of activity across the entire CRM</p>
        </div>
      </div>

      {/* KPI strip */}
      <div>
        <h2 className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          System Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={Users}       label="Total Users"        value={kpis.totalUsers}         color="#8B5CF6"  loading={isLoading} />
          <KpiCard icon={PhoneCall}   label="Cold Callers"       value={kpis.coldCallers}         color={BRAND}    loading={isLoading} />
          <KpiCard icon={Building2}   label="Agents"             value={kpis.agencyUsers}         color="#3B82F6"  loading={isLoading} />
          <KpiCard icon={UserCheck}   label="Active Today"       value={kpis.activeTodayCount}    sub="Callers with calls today" color="#10B981" loading={isLoading} />
          <KpiCard icon={Target}      label="Contacts"           value={kpis.totalContacts?.toLocaleString()} color="#F59E0B" loading={isLoading} />
          <KpiCard icon={TrendingUp}  label="Leads"              value={kpis.totalLeads?.toLocaleString()}    color="#EC4899" loading={isLoading} />
        </div>
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Calls This Week</p>
          {isLoading
            ? <div className="h-7 w-16 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mt-2" />
            : <p className="text-2xl font-black text-[#F95C4B] mt-1">{kpis.callsThisWeek?.toLocaleString() ?? '—'}</p>}
        </div>
        <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Leads This Week</p>
          {isLoading
            ? <div className="h-7 w-16 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mt-2" />
            : <p className="text-2xl font-black text-[#3B82F6] mt-1">{kpis.leadsThisWeek?.toLocaleString() ?? '—'}</p>}
        </div>
        <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Leads Closed</p>
          {isLoading
            ? <div className="h-7 w-16 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mt-2" />
            : <p className="text-2xl font-black text-[#10B981] mt-1">{kpis.closedLeads?.toLocaleString() ?? '—'}</p>}
        </div>
        <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Closing Rate</p>
          {isLoading
            ? <div className="h-7 w-16 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mt-2" />
            : (
              <div className="flex items-end gap-1 mt-1">
                <p className="text-2xl font-black text-[#F59E0B]">{kpis.conversionRate ?? 0}%</p>
                <p className="text-[10px] text-[#6B7280] pb-1">leads → listed/rented/sold</p>
              </div>
            )}
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Daily Call Volume"
          sub="Calls logged per day — last 30 days"
          loading={isLoading}
        >
          {charts.dailyCalls && <DailyCallsChart data={charts.dailyCalls} />}
        </ChartCard>

        <ChartCard
          title="Lead Pipeline"
          sub="Current breakdown of all leads by status"
          loading={isLoading}
        >
          {charts.leadPipeline && <LeadPipelineChart data={charts.leadPipeline} />}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Cold Caller Activity by Hour"
          sub="When callers are most active — last 30 days (SAST)"
          loading={isLoading}
        >
          {charts.callsByHour && <CallsByHourChart data={charts.callsByHour} />}
          {!isLoading && charts.callsByHour && (() => {
            const peak = [...(charts.callsByHour ?? [])].sort((a, b) => b.calls - a.calls)[0]
            if (!peak || peak.calls === 0) return null
            return (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-[#F95C4B]/08 border border-[#F95C4B]/20">
                <Clock className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
                <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  Peak hour: <strong className="text-[#F95C4B]">{peak.hour}</strong> with {peak.calls.toLocaleString()} calls
                </span>
              </div>
            )
          })()}
        </ChartCard>

        <ChartCard
          title="Weekly Lead Trend"
          sub="Leads created vs closed — last 8 weeks"
          loading={isLoading}
        >
          {charts.weeklyLeads && <WeeklyLeadTrendChart data={charts.weeklyLeads} />}
        </ChartCard>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Appointment Status"
          sub="Distribution of all appointments by current status"
          loading={isLoading}
        >
          {charts.apptStatus && charts.apptStatus.length > 0
            ? <AppointmentStatusChart data={charts.apptStatus} />
            : !isLoading && (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <CheckCircle2 className="w-8 h-8 text-[#6B7280]/20" />
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No appointments yet</p>
              </div>
            )}
        </ChartCard>

        <ChartCard
          title="New Contacts & Leads Per Week"
          sub="Weekly intake of contacts and leads — last 8 weeks"
          loading={isLoading}
        >
          {charts.systemGrowth && <SystemGrowthChart data={charts.systemGrowth} />}
        </ChartCard>
      </div>

    </div>
  )
}
