import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, Building2, Mail, Phone, Users, UserCheck, TrendingUp, CalendarCheck, Loader2,
  AlertTriangle, Trash2, Search, X, Clock, MapPin, Power, PowerOff, ShieldCheck,
} from 'lucide-react'
import { agenciesApi } from '../../services/agenciesApi'
import { leadsApi } from '../../services/leadsApi'
import { appointmentsApi } from '../../services/appointmentsApi'
import { LEAD_STATUS_META, getApiErrorMessage } from '../../components/leads/leadShared'
import { TeamPanel, inputCls } from '../../components/agencies/AgencyPeople'
import { useAuthStore } from '../../store/authStore'

const AVATAR_COLORS = ['#F95C4B', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#84CC16']

function colorFor(id = '') {
  const sum = [...id].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const LEAD_TABS = [
  { key: '', label: 'All' },
  { key: 'cold', label: 'Cold' },
  { key: 'warm', label: 'Warm' },
  { key: 'hot', label: 'Hot' },
  { key: 'still_negotiating', label: 'Negotiating' },
  { key: 'listed', label: 'Listed' },
  { key: 'rented_out', label: 'Rented Out' },
  { key: 'sold', label: 'Sold' },
  { key: 'lost', label: 'Lost' },
]

const APPT_META = {
  scheduled: { label: 'Scheduled', color: '#3B82F6' },
  confirmed: { label: 'Confirmed', color: '#10B981' },
  completed: { label: 'Completed', color: '#6B7280' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
  no_show:   { label: 'No show',   color: '#F59E0B' },
}

const PAGE_SIZE = 25

function Pill({ active, color = '#111111', onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
        active
          ? 'text-white border-transparent'
          : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  )
}

function StatTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        <p className="text-xl font-bold text-[#111111] dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Leads of this company ───────────────────────────────────────────────── */

function CompanyLeads({ agencyId, team, onOpen }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState('')
  const [page, setPage] = useState(1)

  const params = { agencyId, status: status || undefined, assignedAgent: agentId || undefined, search: search.trim() || undefined, page, limit: PAGE_SIZE, sort: '-createdAt' }
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-leads', params],
    queryFn: () => leadsApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
  const { data: stats } = useQuery({
    queryKey: ['agency-leads-stats', agencyId, agentId, search.trim()],
    queryFn: () => leadsApi.getStats({ agencyId, assignedAgent: agentId || undefined, search: search.trim() || undefined }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const leads = data?.leads ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const byStatus = stats?.byStatus ?? {}
  const agentName = (l) => (l.assignedAgent ? `${l.assignedAgent.firstName} ${l.assignedAgent.lastName}` : null)

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search landlord, address, phone…"
            className={`${inputCls(false)} pl-9 pr-8`} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <select value={agentId} onChange={(e) => { setAgentId(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none cursor-pointer">
          <option value="">Every agent</option>
          {team.map((m) => <option key={m._id} value={m._id}>{m.firstName} {m.lastName}{m.isAgencyManager ? ' (manager)' : ''}</option>)}
        </select>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LEAD_TABS.map((t) => {
          const count = t.key ? byStatus[t.key] ?? 0 : Object.values(byStatus).reduce((s, c) => s + c, 0)
          return (
            <Pill key={t.key || 'all'} active={status === t.key} color={LEAD_STATUS_META[t.key]?.color ?? '#111111'}
              onClick={() => { setStatus(t.key); setPage(1) }}>
              {t.label}
              <span className={`text-[10px] font-bold ${status === t.key ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
            </Pill>
          )
        })}
      </div>

      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-between">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{isLoading ? 'Loading…' : `${total} lead${total === 1 ? '' : 's'}`}</p>
        </div>
        {isError ? (
          <div className="p-5 text-sm text-[#EF4444] flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Could not load leads.</div>
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white">No leads match</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Try another status, agent or search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                <tr>
                  {['Landlord / Address', 'Assigned agent', 'Status', 'Created', 'Follow-up'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                {leads.map((l) => {
                  const meta = LEAD_STATUS_META[l.status] ?? { label: l.status, color: '#6B7280' }
                  return (
                    <tr key={l._id} onClick={() => onOpen(l._id)} className="hover:bg-[#FAFAF9] dark:hover:bg-[#111111] cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[260px]">{l.landlordName}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[260px] flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{l.propertyAddress}</p>
                      </td>
                      <td className="px-4 py-3">
                        {agentName(l) ? (
                          <span className="text-xs font-semibold text-[#111111] dark:text-white flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-[#10B981]" />{agentName(l)}</span>
                        ) : (
                          <span className="text-xs italic text-[#F59E0B]">Not attached yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{format(new Date(l.createdAt), 'd MMM yyyy')}</td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{l.followUpDate ? format(new Date(l.followUpDate), 'd MMM yyyy') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Appointments of this company ────────────────────────────────────────── */

function CompanyAppointments({ agencyId, team }) {
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState('')
  const [page, setPage] = useState(1)
  const params = { agencyId, status: status || undefined, agentId: agentId || undefined, page, limit: PAGE_SIZE }
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-appointments', params],
    queryFn: () => appointmentsApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
  const appts = data?.appointments ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Pill active={!status} onClick={() => { setStatus(''); setPage(1) }}>All</Pill>
          {Object.entries(APPT_META).map(([k, v]) => (
            <Pill key={k} active={status === k} color={v.color} onClick={() => { setStatus(k); setPage(1) }}>{v.label}</Pill>
          ))}
        </div>
        <select value={agentId} onChange={(e) => { setAgentId(e.target.value); setPage(1) }}
          className="lg:ml-auto px-3 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none cursor-pointer">
          <option value="">Every agent</option>
          {team.map((m) => <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        {isError ? (
          <div className="p-5 text-sm text-[#EF4444] flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Could not load appointments.</div>
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
        ) : appts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white">No appointments</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Nothing matches this filter yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
            {appts.map((a) => {
              const meta = APPT_META[a.status] ?? { label: a.status, color: '#6B7280' }
              const agent = a.agentId
              return (
                <li key={a._id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-11 text-center flex-shrink-0">
                    <p className="text-lg font-bold text-[#111111] dark:text-white leading-none">{format(new Date(a.scheduledDate), 'd')}</p>
                    <p className="text-[10px] uppercase tracking-widest text-[#6B7280]">{format(new Date(a.scheduledDate), 'MMM')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{a.leadId?.landlordName ?? 'Lead'}</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5 truncate">
                      <Clock className="w-3 h-3 flex-shrink-0" /> {a.scheduledTime}
                      {agent && <> · {agent.firstName} {agent.lastName}</>}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
            <p className="text-xs text-[#6B7280]">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Delete (typed confirmation) ─────────────────────────────────────────── */

function DeleteCompanyModal({ agency, onClose, onDeleted }) {
  const [typed, setTyped] = useState('')
  const [blocked, setBlocked] = useState(null)
  const qc = useQueryClient()
  const matches = typed.trim() === agency.name
  const mut = useMutation({
    mutationFn: () => agenciesApi.remove(agency._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencies'] })
      toast.success(`${agency.name} moved to the Bin`)
      onDeleted()
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, 'Could not delete this company')
      if (err.response?.status === 409) setBlocked(msg)
      else toast.error(msg)
    },
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={!mut.isPending ? onClose : undefined} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div>
              <h3 className="font-bold text-[#111111] dark:text-white">Delete {agency.name}?</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 leading-relaxed">
                The company moves to the Bin and can be restored from there. Its agents are switched off so they can no longer sign in.
              </p>
            </div>
          </div>

          {blocked ? (
            <div className="p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-xs text-[#111111] dark:text-white leading-relaxed">
              {blocked}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Type <span className="font-semibold text-[#111111] dark:text-white">{agency.name}</span> to confirm.</p>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls(false)} autoFocus />
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
              {blocked ? 'Close' : 'Cancel'}
            </button>
            {!blocked && (
              <button onClick={() => mut.mutate()} disabled={!matches || mut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 flex items-center justify-center gap-2">
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete company
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function AgencyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [tab, setTab] = useState('team')
  const [deleting, setDeleting] = useState(false)

  const { data: agency, isLoading, isError } = useQuery({
    queryKey: ['agency', id],
    queryFn: () => agenciesApi.getById(id).then((r) => r.data.data.agency),
  })

  const { data: teamData } = useQuery({
    queryKey: ['agency-team', id],
    queryFn: () => agenciesApi.listTeam(id).then((r) => r.data.data.team),
    enabled: Boolean(id),
  })
  const team = teamData ?? []

  const toggleActive = useMutation({
    mutationFn: () => agenciesApi.update(id, { isActive: !agency.isActive }),
    onSuccess: () => {
      toast.success(agency.isActive ? 'Company deactivated' : 'Company reactivated')
      qc.invalidateQueries({ queryKey: ['agency', id] })
      qc.invalidateQueries({ queryKey: ['agencies'] })
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not change status')),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
  }
  if (isError || !agency) {
    return (
      <div className="p-8">
        <button onClick={() => navigate('/admin/agencies')} className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#F95C4B] mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to agencies
        </button>
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4" /> This company could not be loaded.
        </div>
      </div>
    )
  }

  const color = colorFor(agency._id)
  const stats = agency.stats ?? {}
  const managers = team.filter((m) => m.isAgencyManager && m.isActive).length
  const tabs = [
    { key: 'team', label: 'Team', count: team.length, icon: Users },
    { key: 'leads', label: 'Leads', count: stats.leads ?? 0, icon: TrendingUp },
    { key: 'appointments', label: 'Appointments', count: stats.upcomingAppointments ?? 0, icon: CalendarCheck },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <button onClick={() => navigate('/admin/agencies')} className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#F95C4B] transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to agencies
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center gap-5 pb-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-sm flex-shrink-0" style={{ backgroundColor: color }}>
              {initials(agency.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight truncate">{agency.name}</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  agency.isActive ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#6B7280]/10 text-[#6B7280]'
                }`}>
                  {agency.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-[#6B7280] dark:text-[#A1A1AA] flex-wrap">
                {agency.contactEmail && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{agency.contactEmail}</span>}
                {agency.contactPhone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{agency.contactPhone}</span>}
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />Since {format(new Date(agency.createdAt), 'MMM yyyy')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => toggleActive.mutate()} disabled={toggleActive.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
              {agency.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
              {agency.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
            <button onClick={() => setDeleting(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#EF4444] bg-[#EF4444]/8 hover:bg-[#EF4444]/15 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        <div className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all rounded-t-lg ${
                  active ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5' : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-[#F95C4B]/15' : 'bg-[#F5F5F4] dark:bg-[#202020]'}`}>{t.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 sm:px-8 py-4 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Users} label="Team" value={stats.agents ?? 0} sub={`${stats.activeAgents ?? 0} active`} color="#3B82F6" />
          <StatTile icon={ShieldCheck} label="Company logins" value={managers} sub={managers ? 'Can run the company' : 'None yet — add one from Team'} color="#F95C4B" />
          <StatTile icon={TrendingUp} label="Leads" value={(stats.leads ?? 0).toLocaleString()} sub="Attached to this company" color="#10B981" />
          <StatTile icon={CalendarCheck} label="Upcoming visits" value={stats.upcomingAppointments ?? 0} sub="Scheduled or confirmed" color="#8B5CF6" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
        {tab === 'team' && (
          <TeamPanel
            agencyId={id}
            agencyName={agency.name}
            currentUserId={user?._id}
            canManage
            canMakeManager
            canReset
            showAdd
          />
        )}
        {tab === 'leads' && <CompanyLeads agencyId={id} team={team} onOpen={(lid) => navigate(`/admin/leads/${lid}`)} />}
        {tab === 'appointments' && <CompanyAppointments agencyId={id} team={team} />}
      </div>

      {deleting && (
        <DeleteCompanyModal agency={agency} onClose={() => setDeleting(false)} onDeleted={() => navigate('/admin/agencies')} />
      )}
    </div>
  )
}
