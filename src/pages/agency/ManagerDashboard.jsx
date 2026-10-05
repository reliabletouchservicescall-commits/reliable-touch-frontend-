import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  TrendingUp, UserX, Flame, CalendarCheck, Plus, ArrowRight, Loader2, AlertTriangle,
  ShieldCheck, UserCircle2, Clock, MapPin, Building2,
} from 'lucide-react'
import { agentsApi } from '../../services/agentsApi'
import { agenciesApi } from '../../services/agenciesApi'
import { useAuthStore } from '../../store/authStore'
import { AddPersonModal } from '../../components/agencies/AgencyPeople'

const BRAND = '#F95C4B'

function initialsOf(m) {
  return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase()
}

function StatTile({ icon: Icon, label, value, sub, color, onClick }) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex items-start gap-3.5 text-left ${
        onClick ? 'hover:shadow-md hover:border-[#3B82F6]/30 transition-all cursor-pointer' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        <p className="text-xl font-bold text-[#111111] dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{sub}</p>}
      </div>
    </Wrapper>
  )
}

function MemberTile({ member, companyLeads, onViewLeads }) {
  const share = companyLeads > 0 ? Math.round((member.leads / companyLeads) * 100) : 0
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${member.isAgencyManager ? 'bg-[#F95C4B]' : 'bg-[#3B82F6]'}`}>
          {initialsOf(member)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{member.firstName} {member.lastName}</p>
          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            member.isAgencyManager ? 'bg-[#F95C4B]/10 text-[#F95C4B]' : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'
          }`}>
            {member.isAgencyManager ? <ShieldCheck className="w-3 h-3" /> : <UserCircle2 className="w-3 h-3" />}
            {member.isAgencyManager ? 'Manager' : 'Agent'}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Leads assigned</p>
          <p className="text-lg font-bold text-[#111111] dark:text-white leading-none">{member.leads}</p>
        </div>
        <div className="h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, background: `linear-gradient(90deg, ${BRAND}, #FF8C7A)` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] py-2">
          <p className="text-sm font-bold text-[#8B5CF6]">{member.activeLeads}</p>
          <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Active</p>
        </div>
        <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] py-2">
          <p className="text-sm font-bold text-[#EF4444]">{member.hotLeads}</p>
          <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Hot</p>
        </div>
        <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] py-2">
          <p className="text-sm font-bold text-[#3B82F6]">{member.upcomingAppointments}</p>
          <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Visits</p>
        </div>
      </div>

      <button
        onClick={onViewLeads}
        disabled={member.leads === 0}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        View their leads <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function ManagerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-manager-dashboard'],
    queryFn: () => agentsApi.myDashboard().then((r) => r.data.data),
    staleTime: 30_000,
  })

  const { data: agency } = useQuery({
    queryKey: ['agency', user?.agencyId],
    queryFn: () => agenciesApi.getById(user.agencyId).then((r) => r.data.data.agency),
    enabled: Boolean(user?.agencyId),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
  }
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4" /> Couldn't load your company overview.
        </div>
      </div>
    )
  }

  const company = data.company
  const team = data.team ?? []
  const visits = data.todaysAppointments ?? []
  const today = format(new Date(), 'EEEE d MMMM')

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#111111] dark:text-white truncate">{agency?.name ?? 'Your company'}</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{today} · company overview</p>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="w-4 h-4" /> Add agent
        </button>
      </div>

      {/* Company numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={TrendingUp} label="Company leads" value={company.totalLeads} sub={`${company.activeLeads} warm or hot`} color="#3B82F6" onClick={() => navigate('/agency/leads')} />
        <StatTile icon={UserX} label="Not yet with anyone" value={company.unassignedLeads} sub={company.unassignedLeads ? 'Ready to hand out' : 'Everything is assigned'} color="#F59E0B" onClick={() => navigate('/agency/leads?agent=unassigned')} />
        <StatTile icon={Flame} label="Hot leads" value={company.hotLeads} sub="Most urgent right now" color="#EF4444" onClick={() => navigate('/agency/leads')} />
        <StatTile icon={CalendarCheck} label="Visits today" value={company.todaysAppointments} sub="Across the whole team" color="#8B5CF6" onClick={() => navigate('/agency/appointments')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Team */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">Your team</h2>
            <button onClick={() => navigate('/agency/team')} className="text-xs font-semibold text-[#3B82F6] hover:underline">Manage logins</button>
          </div>
          {team.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] p-10 text-center">
              <p className="text-sm font-semibold text-[#111111] dark:text-white mb-1">No one on the team yet</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mb-4">Add your agents so they can sign in and work their leads.</p>
              <button onClick={() => setAdding(true)} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">Add the first agent</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.map((m) => (
                <MemberTile
                  key={m._id}
                  member={m}
                  companyLeads={company.totalLeads - company.unassignedLeads}
                  onViewLeads={() => navigate(`/agency/leads?agent=${m._id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Today's visits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">Visits today</h2>
            <button onClick={() => navigate('/agency/appointments')} className="text-xs font-semibold text-[#3B82F6] hover:underline">All visits</button>
          </div>
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#F5F5F4] dark:divide-[#202020]">
            {visits.length === 0 ? (
              <p className="p-6 text-xs text-center text-[#6B7280] dark:text-[#A1A1AA]">No visits booked for today.</p>
            ) : visits.map((a) => (
              <div key={a._id} className="flex items-start gap-3 p-4">
                <div className="w-1.5 self-stretch rounded-full bg-[#8B5CF6]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{a.leadId?.landlordName ?? 'Lead'}</p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {a.leadId?.propertyAddress ?? '—'}
                  </p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {a.scheduledTime} · {a.agentId?.firstName} {a.agentId?.lastName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {adding && (
        <AddPersonModal
          agencyId={user?.agencyId}
          agencyName={agency?.name}
          canMakeManager={false}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
