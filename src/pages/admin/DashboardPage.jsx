import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  BookUser,
  TrendingUp,
  CalendarCheck,
  DollarSign,
  Megaphone,
  PhoneCall,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  CalendarClock,
  ChevronRight,
  Bell,
  X,
  ArrowRight,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'
import { contactRequestsApi } from '../../services/contactRequestsApi'

/* ─── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, trend, color = '#F95C4B', loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
        </div>
        {trend != null && !loading && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-lg ${
              trend >= 0
                ? 'text-[#16A34A] bg-[#16A34A]/10'
                : 'text-[#DC2626] bg-[#DC2626]/10'
            }`}
          >
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-16 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
            {value ?? '—'}
          </p>
        )}
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
        {sub && !loading && (
          <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60 mt-1">{sub}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Quick Action ────────────────────────────────────────────────────────── */

function QuickAction({ icon: Icon, label, description, to, color = '#F95C4B' }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="group flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#F95C4B]/40 dark:hover:border-[#F95C4B]/40 hover:shadow-sm transition-all text-left w-full"
    >
      <div
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{label}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{description}</p>
      </div>
    </button>
  )
}

/* ─── Commission Status Badge ─────────────────────────────────────────────── */

const COMM_STATUS = {
  pending:  { label: 'Pending',  color: '#F59E0B', bg: '#F59E0B18', Icon: Clock },
  invoiced: { label: 'Invoiced', color: '#3B82F6', bg: '#3B82F618', Icon: FileText },
  paid:     { label: 'Paid',     color: '#10B981', bg: '#10B98118', Icon: CheckCircle2 },
  overdue:  { label: 'Overdue',  color: '#EF4444', bg: '#EF444418', Icon: AlertTriangle },
}

const RENEWAL_STATUS = {
  upcoming: { label: 'Upcoming', color: '#3B82F6', bg: '#3B82F618', Icon: CalendarClock },
  due:      { label: 'Due',      color: '#F59E0B', bg: '#F59E0B18', Icon: Clock },
  renewed:  { label: 'Renewed',  color: '#10B981', bg: '#10B98118', Icon: CheckCircle2 },
  lapsed:   { label: 'Lapsed',   color: '#EF4444', bg: '#EF444418', Icon: AlertTriangle },
}

function Badge({ meta }) {
  const Icon = meta.Icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: meta.bg }}>
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {meta.label}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'd MMM yyyy')
}

function fmtCurrency(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(n)
}

function resolveAgent(visit) {
  const a = visit?.agentId
  if (a && typeof a === 'object') return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()
  return '—'
}

function resolveLead(visit) {
  const l = visit?.leadId
  if (l && typeof l === 'object') return l.landlordName ?? l.propertyAddress ?? '—'
  return '—'
}

/* ─── Finance Panel (Commissions + Renewals side by side) ─────────────────── */

function FinancePanel({ commissions, renewals, loading, navigate }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
            <div className="h-4 w-32 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-4" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-10 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-2" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Commissions */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Commissions</span>
          </div>
          <button
            onClick={() => navigate('/admin/commissions')}
            className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {commissions.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-8">No commissions yet</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {commissions.map((c) => {
              const visit = c.agentVisitId
              const meta = COMM_STATUS[c.status] ?? COMM_STATUS.pending
              const overdue = c.status !== 'paid' && isPast(new Date(c.dueDate))
              return (
                <div key={c._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {resolveAgent(visit)}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
                      {resolveLead(visit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold text-[#111111] dark:text-white">{fmtCurrency(c.amount)}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge meta={meta} />
                      <span className={`text-[10px] font-medium ${overdue ? 'text-[#EF4444]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                        Due {fmtDate(c.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lease Renewals */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#EC4899]/10 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-[#EC4899]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white">Lease Renewals</span>
          </div>
          <button
            onClick={() => navigate('/admin/lease-renewals')}
            className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {renewals.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-8">No lease renewals yet</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {renewals.map((r) => {
              const visit = r.agentVisitId
              const meta = RENEWAL_STATUS[r.status] ?? RENEWAL_STATUS.upcoming
              const isDue = r.renewalDate && (isToday(new Date(r.renewalDate)) || isPast(new Date(r.renewalDate)))
              return (
                <div key={r._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {resolveAgent(visit)}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
                      {resolveLead(visit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge meta={meta} />
                    <span className={`text-[10px] font-medium ${isDue && r.status !== 'renewed' ? 'text-[#F59E0B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                      {fmtDate(r.renewalDate)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const [stats, setStats]         = useState(null)
  const [finance, setFinance]     = useState({ commissions: [], renewals: [] })
  const [loading, setLoading]     = useState(true)
  const [financeLoading, setFinanceLoading] = useState(true)
  const now = new Date()
  const qc  = useQueryClient()

  const { data: contactRequestsData, refetch: refetchRequests } = useQuery({
    queryKey: ['contact-requests-pending'],
    queryFn: () => contactRequestsApi.list({ status: 'pending', limit: 10 }),
    staleTime: 30_000,
  })
  const pendingRequests = contactRequestsData?.requests ?? []

  const fulfillMut = useMutation({
    mutationFn: ({ id }) => contactRequestsApi.updateStatus(id, { status: 'fulfilled' }),
    onSuccess: () => { refetchRequests(); qc.invalidateQueries({ queryKey: ['contact-requests-pending'] }) },
  })
  const dismissMut = useMutation({
    mutationFn: (id) => contactRequestsApi.updateStatus(id, { status: 'dismissed' }),
    onSuccess: () => { refetchRequests(); qc.invalidateQueries({ queryKey: ['contact-requests-pending'] }) },
  })

  useEffect(() => {
    async function fetchStats() {
      const [usersRes, contactsRes, leadsRes, apptRes, campRes, commRes, renewalRes] =
        await Promise.allSettled([
          axiosClient.get('/admin/users?limit=1'),
          axiosClient.get('/contacts?limit=1'),
          axiosClient.get('/leads?limit=1'),
          axiosClient.get('/appointments?limit=1'),
          axiosClient.get('/campaigns?limit=1'),
          axiosClient.get('/commissions?limit=1&status=pending'),
          axiosClient.get('/lease-renewals?limit=1&status=upcoming'),
        ])

      setStats({
        users:        usersRes.status        === 'fulfilled' ? usersRes.value.data?.data?.total        ?? 0 : 0,
        contacts:     contactsRes.status     === 'fulfilled' ? contactsRes.value.data?.data?.total     ?? 0 : 0,
        leads:        leadsRes.status        === 'fulfilled' ? leadsRes.value.data?.data?.total        ?? 0 : 0,
        appointments: apptRes.status         === 'fulfilled' ? apptRes.value.data?.data?.total         ?? 0 : 0,
        campaigns:    campRes.status         === 'fulfilled' ? campRes.value.data?.data?.total         ?? 0 : 0,
        pendingComm:  commRes.status         === 'fulfilled' ? commRes.value.data?.data?.total         ?? 0 : 0,
        upcomingRenew: renewalRes.status     === 'fulfilled' ? renewalRes.value.data?.data?.total      ?? 0 : 0,
      })
      setLoading(false)
    }

    async function fetchFinance() {
      const [commRes, renewRes] = await Promise.allSettled([
        axiosClient.get('/commissions?limit=5'),
        axiosClient.get('/lease-renewals?limit=5'),
      ])
      setFinance({
        commissions: commRes.status  === 'fulfilled' ? commRes.value.data?.data?.commissions  ?? [] : [],
        renewals:    renewRes.status === 'fulfilled' ? renewRes.value.data?.data?.renewals     ?? [] : [],
      })
      setFinanceLoading(false)
    }

    fetchStats()
    fetchFinance()
  }, [])

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8">
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
          <span className="text-xs font-semibold text-[#F95C4B]">System Active</span>
        </div>
      </div>

      {/* CRM Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          CRM Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={Users}        label="Total Users"   value={stats?.users}        color="#F95C4B" loading={loading} />
          <StatCard icon={BookUser}     label="Contacts"      value={stats?.contacts}     color="#8B5CF6" loading={loading} />
          <StatCard icon={TrendingUp}   label="Leads"         value={stats?.leads}        color="#3B82F6" loading={loading} />
          <StatCard icon={CalendarCheck} label="Appointments" value={stats?.appointments}  color="#10B981" loading={loading} />
          <StatCard icon={Megaphone}    label="Campaigns"     value={stats?.campaigns}    color="#F59E0B" loading={loading} />
        </div>
      </div>

      {/* Contact Requests */}
      {pendingRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
              Contact Requests
            </h2>
            <button
              onClick={() => navigate('/admin/contacts')}
              className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"
            >
              Go to Contacts <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#F95C4B]/25 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-[#F95C4B]/5 border-b border-[#F95C4B]/15">
              <div className="w-7 h-7 rounded-lg bg-[#F95C4B]/15 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white flex-1">
                Pending Contact Requests
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F95C4B] text-white">
                {pendingRequests.length}
              </span>
            </div>
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {pendingRequests.map((req) => {
                const caller   = req.requestedBy
                const initials = `${caller?.firstName?.[0] ?? ''}${caller?.lastName?.[0] ?? ''}`.toUpperCase()
                return (
                  <div key={req._id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#F95C4B]/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#F95C4B]">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111111] dark:text-white">
                        {caller?.firstName} {caller?.lastName}
                        <span className="text-xs font-normal text-[#9CA3AF] ml-2">
                          {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                        </span>
                      </p>
                      {req.message && (
                        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate italic mt-0.5">
                          "{req.message}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => navigate('/admin/contacts')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => fulfillMut.mutate({ id: req._id })}
                        disabled={fulfillMut.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 transition-colors"
                      >
                        Fulfilled
                      </button>
                      <button
                        onClick={() => dismissMut.mutate(req._id)}
                        disabled={dismissMut.isPending}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Finance Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Finance
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={DollarSign}
            label="Pending Commissions"
            value={stats?.pendingComm}
            sub="Awaiting payment"
            color="#F59E0B"
            loading={loading}
          />
          <StatCard
            icon={RotateCcw}
            label="Upcoming Renewals"
            value={stats?.upcomingRenew}
            sub="Active lease tracking"
            color="#EC4899"
            loading={loading}
          />
        </div>
      </div>

      {/* Finance Panel */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Recent Finance Activity
        </h2>
        <FinancePanel
          commissions={finance.commissions}
          renewals={finance.renewals}
          loading={financeLoading}
          navigate={navigate}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction icon={Users}        label="Manage Users"      description="Create & manage team accounts"    to="/admin/users"          color="#F95C4B" />
          <QuickAction icon={BookUser}     label="View Contacts"     description="Browse contact database"          to="/admin/contacts"       color="#8B5CF6" />
          <QuickAction icon={CalendarCheck} label="Appointments"     description="Track upcoming appointments"      to="/admin/appointments"   color="#10B981" />
          <QuickAction icon={DollarSign}   label="Commissions"       description="Monitor agent earnings"           to="/admin/commissions"    color="#F59E0B" />
          <QuickAction icon={TrendingUp}   label="Active Leads"      description="Manage lead pipeline"             to="/admin/leads"          color="#3B82F6" />
          <QuickAction icon={PhoneCall}    label="Call Logs"         description="Review calling activity"          to="/admin/call-logs"      color="#06B6D4" />
          <QuickAction icon={RotateCcw}    label="Lease Renewals"    description="Upcoming renewal tracking"        to="/admin/lease-renewals" color="#EC4899" />
          <QuickAction icon={Megaphone}    label="Campaigns"         description="Manage calling campaigns"         to="/admin/campaigns"      color="#F59E0B" />
        </div>
      </div>

      {/* System info */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
          System Info
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Role',       value: 'Administrator' },
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
