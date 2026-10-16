import { useState } from 'react'
import { useCallFlow, telHref } from '../../lib/useCallFlow'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  Search, X, Upload, Loader2, Users, CheckCircle2,
  PhoneCall, PhoneMissed, Voicemail, Clock, ThumbsDown, AlertCircle, PhoneOff, Phone,
  BarChart3, BookUser, UserCheck, RefreshCw, Sparkles,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { agenciesApi } from '../../services/agenciesApi'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { inputCls, getApiErrorMessage } from '../../components/leads/leadShared'
import { CALL_OUTCOME_META, DEFAULT_OUTCOME_META } from '../../constants/callOutcomes'
import SidePanel from '../../components/common/SidePanel'
import CreateLeadDrawer from '../../components/leads/CreateLeadDrawer'
import SharedImportModal from '../../components/contacts/ImportExcelModal'
import DuplicatesReviewModal from '../../components/contacts/DuplicatesReviewModal'

const STATUS_META = {
  unassigned: { label: 'Unassigned', color: '#6B7280' },
  assigned:   { label: 'Assigned',   color: '#3B82F6' },
  contacted:  { label: 'Contacted',  color: '#F59E0B' },
  converted:  { label: 'Converted',  color: '#10B981' },
  dnc:        { label: 'DNC',        color: '#EF4444' },
}

const OUTCOMES = [
  { value: 'no_answer',          label: 'No Answer',          icon: PhoneMissed,  color: '#6B7280' },
  { value: 'voicemail',          label: 'Voicemail',          icon: Voicemail,    color: '#6B7280' },
  { value: 'callback_requested', label: 'Callback Requested', icon: Clock,        color: '#F59E0B' },
  { value: 'interested',         label: 'Interested',         icon: CheckCircle2, color: '#10B981', requiresLead: true },
  { value: 'not_interested',     label: 'Not Interested',     icon: ThumbsDown,   color: '#F97316' },
  { value: 'wrong_number',       label: 'Wrong Number',       icon: AlertCircle,  color: '#8B5CF6' },
  { value: 'remove_me',          label: 'Remove Me (DNC)',    icon: PhoneOff,     color: '#EF4444' },
]


/* ─── Import Excel — the same modal and formats as admin (shared component), in
   agency mode: Area is optional, a manager's upload lands in the company pool and an
   agent's is assigned straight to them. Duplicates are checked within the company's own
   pool and can be reviewed right here, exactly like admin. ─────────────────── */
export function ImportModal({ onClose, onDone, isManager }) {
  const [duplicates, setDuplicates] = useState(null)
  return (
    <>
      <SharedImportModal
        agencyMode
        isManager={isManager}
        onClose={onClose}
        onDone={onDone}
        onReviewDuplicates={setDuplicates}
      />
      {duplicates && (
        <DuplicatesReviewModal
          duplicates={duplicates}
          onClose={() => setDuplicates(null)}
          onDone={() => { setDuplicates(null); onDone() }}
        />
      )}
    </>
  )
}

/* ─── Outcome sheet — logs the real outcome for a just-initiated call ────── */
// `onSubmit` comes from useCallFlow — see the cold caller's OutcomeSheet for why.
function OutcomeSheet({ contact, onSubmit, onClose, onSaved }) {
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const selectedMeta = OUTCOMES.find((o) => o.value === selected)

  const mut = useMutation({
    mutationFn: () => onSubmit({ outcome: selected, notes }),
    onSuccess: (logId) => {
      toast.success('Call outcome saved')
      onSaved(selectedMeta, logId)
    },
    onError: () => toast.error('Could not save the outcome — check your connection and tap Save again'),
  })

  return (
    <SidePanel
      onClose={onClose} icon={PhoneCall} iconColor="#10B981" title={contact.name} subtitle={contact.phone}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Skip for now
          </button>
          <button onClick={() => mut.mutate()} disabled={!selected || mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50 flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} {selectedMeta?.requiresLead ? 'Save & Create Lead' : 'Save Outcome'}
          </button>
        </>
      }
    >
      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">What was the call outcome?</p>
        <div className="space-y-2">
          {OUTCOMES.map((o) => {
            const Icon = o.icon
            const active = selected === o.value
            return (
              <button key={o.value} onClick={() => setSelected(o.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  active ? '' : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] bg-white dark:bg-[#202020]'
                }`}
                style={active ? { backgroundColor: `${o.color}10`, borderColor: o.color } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: o.color }} strokeWidth={1.75} />
                <span className="text-sm font-medium text-[#111111] dark:text-white flex-1">{o.label}</span>
                {o.requiresLead && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide"
                    style={active ? { backgroundColor: `${o.color}20`, color: o.color } : { backgroundColor: '#10B98118', color: '#10B981' }}>
                    <Sparkles className="w-2.5 h-2.5" /> Lead
                  </span>
                )}
                {active && !o.requiresLead && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: o.color }} strokeWidth={2} />}
              </button>
            )
          })}
        </div>
        {selectedMeta?.requiresLead && (
          <div className="flex items-start gap-2.5 mt-3 p-3 rounded-xl bg-[#10B981]/8 border border-[#10B981]/20">
            <Sparkles className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-[#10B981] leading-relaxed">You'll be taken straight to a lead form so this doesn't get lost.</p>
          </div>
        )}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={3}
          className="mt-4 w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none resize-none" />
      </div>
    </SidePanel>
  )
}

/* ─── Manager: company contacts table + bulk assign ───────────────────── */
function ManagerContactsPanel({ team }) {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '')
  const [assignedTo, setAssignedTo] = useState(() => searchParams.get('assignedTo') ?? '')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [targetAgent, setTargetAgent] = useState('')

  const params = { search: search.trim() || undefined, status: status || undefined, assignedTo: assignedTo || undefined, page, limit: 20 }
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['agency-contacts', params],
    queryFn: () => contactsApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
  const contacts = data?.contacts ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const assignMut = useMutation({
    mutationFn: () => contactsApi.assignToAgent({ ids: [...selected], agentId: targetAgent }),
    onSuccess: (res) => {
      toast.success(`${res.data.data.assigned} contact${res.data.data.assigned !== 1 ? 's' : ''} assigned`)
      setSelected(new Set())
      setTargetAgent('')
      qc.invalidateQueries({ queryKey: ['agency-contacts'] })
      qc.invalidateQueries({ queryKey: ['agency-workload'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to assign')),
  })

  function toggleOne(id) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((s) => s.size === contacts.length ? new Set() : new Set(contacts.map((c) => c._id)))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — search fills the row, agent filter fixed width, status as chips */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name or phone number…"
              className={`${inputCls(false)} pl-10 pr-9`} />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="relative sm:w-64 flex-shrink-0">
            <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
            <select value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); setPage(1) }} className={`${inputCls(false)} pl-10 cursor-pointer`}>
              <option value="">Everyone</option>
              <option value="unassigned">Unassigned (pool)</option>
              {team.map((m) => <option key={m._id} value={m._id}>{m.firstName} {m.lastName}{m.isAgencyManager ? ' (you)' : ''}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mr-1">Status</span>
          {[['', { label: 'All', color: '#F95C4B' }], ...Object.entries(STATUS_META)].map(([k, v]) => {
            const active = status === k
            return (
              <button key={k || 'all'} type="button" onClick={() => { setStatus(k); setPage(1) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active ? 'shadow-sm' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#D4D4D8] dark:hover:border-[#3F3F46]'
                }`}
                style={active ? { color: v.color, backgroundColor: `${v.color}12`, borderColor: `${v.color}55` } : undefined}>
                {k && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }} />}
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F95C4B]/8 border border-[#F95C4B]/25">
          <UserCheck className="w-4 h-4 text-[#F95C4B] flex-shrink-0" />
          <p className="text-xs font-semibold text-[#F95C4B]">{selected.size} selected</p>
          <select value={targetAgent} onChange={(e) => setTargetAgent(e.target.value)} className={`${inputCls(false)} flex-1 max-w-xs`}>
            <option value="">Assign to…</option>
            {team.map((m) => <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>)}
          </select>
          <button onClick={() => assignMut.mutate()} disabled={!targetAgent || assignMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-40">
            {assignMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assign
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-[#6B7280] hover:text-[#111111] dark:hover:text-white">Clear</button>
        </div>
      )}

      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-between">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{isLoading ? 'Loading…' : `${total} contact${total === 1 ? '' : 's'}`}</p>
          {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F95C4B]" />}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white">No contacts yet</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Import an Excel file to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                <tr>
                  <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size === contacts.length} onChange={toggleAll} className="w-4 h-4 accent-[#F95C4B] cursor-pointer" /></th>
                  {['Name / Phone', 'Scheme / Address', 'Status', 'Assigned To', 'Last Called'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                {contacts.map((c) => {
                  const meta = STATUS_META[c.status] ?? STATUS_META.unassigned
                  return (
                    <tr key={c._id} className="hover:bg-[#FAFAF9] dark:hover:bg-[#111111]">
                      <td className="px-4 py-3"><input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleOne(c._id)} className="w-4 h-4 accent-[#F95C4B] cursor-pointer" /></td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#111111] dark:text-white">{c.name}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">{c.phone ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[200px]">{c.sectionalScheme || c.address || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#111111] dark:text-white">
                        {c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : <span className="italic text-[#F59E0B]">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                        {c.lastCalledAt ? formatDistanceToNow(new Date(c.lastCalledAt), { addSuffix: true }) : '—'}
                      </td>
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

/* ─── Manager: calling performance ──────────────────────────────────────── */
function CallingPerformancePanel() {
  const [period, setPeriod] = useState('week')
  const { data, isLoading } = useQuery({
    queryKey: ['agency-calling-stats', period],
    queryFn: () => axiosClient.get(`/performance/agents/calling?period=${period}`).then((r) => r.data.data.agents),
  })
  const agents = data ?? []
  const maxCalls = Math.max(1, ...agents.map((a) => a.totalCalls))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] w-fit">
        {['day', 'week', 'month', 'year'].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              period === p ? 'bg-white dark:bg-[#181818] text-[#F95C4B] shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
            }`}>
            {p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
      ) : agents.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
          <p className="text-sm font-semibold text-[#111111] dark:text-white">No active agents yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((a) => (
            <div key={a.userId} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#F95C4B]">#{a.rank}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{a.name}{a.isAgencyManager ? ' (you)' : ''}</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{a.totalCalls} call{a.totalCalls !== 1 ? 's' : ''} · {a.interested} interested</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#111111] dark:text-white">{a.called}/{a.totalAssigned}</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">contacts called</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                <div className="h-full rounded-full bg-[#F95C4B] transition-all" style={{ width: `${Math.min(100, (a.totalCalls / maxCalls) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Agent: call queue ──────────────────────────────────────────────────── */
function AgentQueuePanel() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('todo')
  const [page, setPage] = useState(1)
  const [leadPrompt, setLeadPrompt] = useState(null)
  const callFlow = useCallFlow([['agent-contacts'], ['agent-contacts-today-count']])
  const [showImport, setShowImport] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['agent-contacts', { search, page, view: viewMode }],
    queryFn: () => contactsApi.list({ search: search || undefined, page, limit: 20, view: viewMode === 'today' ? 'today' : undefined }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
  const { data: todayData } = useQuery({
    queryKey: ['agent-contacts-today-count'],
    queryFn: () => contactsApi.list({ view: 'today', limit: 1 }).then((r) => r.data.data),
  })
  const calledTodayCount = todayData?.total ?? 0
  const contacts = data?.contacts ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1


  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <BookUser className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} /> My Contacts
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : viewMode === 'today' ? `${total} call${total !== 1 ? 's' : ''} logged today` : `${total} to call · ${calledTodayCount} called today`}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm">
              <Upload className="w-3.5 h-3.5" /> Import Excel
            </button>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#2A2A2A] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {[{ key: 'todo', label: 'To Call', count: total }, { key: 'today', label: 'Called Today', count: calledTodayCount }].map((t) => (
            <button key={t.key} onClick={() => { setViewMode(t.key); setPage(1) }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                viewMode === t.key ? 'bg-[#F95C4B] text-white shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#2A2A2A] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
              }`}>
              {t.label} <span className="opacity-80">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search name or phone…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />)}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#10B981]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
              {viewMode === 'today' ? 'No calls logged yet' : 'Nothing to call'}
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs mb-5">
              {viewMode === 'today'
                ? 'Head to "To Call" to get started.'
                : 'Ask your manager to assign you contacts, or import your own list.'}
            </p>
            {viewMode !== 'today' && (
              <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm">
                <Upload className="w-4 h-4" /> Import Excel
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {contacts.map((c) => {
                const outcomeMeta = CALL_OUTCOME_META[c.lastCallOutcome] ?? { ...DEFAULT_OUTCOME_META, label: c.lastCallOutcome ?? 'Unknown' }
                const OutcomeIcon = outcomeMeta.icon
                return (
                  <div key={c._id} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] hover:shadow-sm transition-all p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#F95C4B]">{c.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{c.name}</p>
                        <p className="text-sm font-mono font-semibold text-[#111111] dark:text-white mt-0.5">{c.phone}</p>
                      </div>
                    </div>
                    {(c.sectionalScheme || c.address) && (
                      <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate mb-3">{c.sectionalScheme || c.address}</p>
                    )}
                    {viewMode === 'today' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold" style={{ color: outcomeMeta.color, backgroundColor: `${outcomeMeta.color}15` }}>
                        <OutcomeIcon className="w-3.5 h-3.5" /> {outcomeMeta.label}
                      </span>
                    ) : (
                      <a href={telHref(c.phone)} onClick={() => callFlow.startCall(c)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] active:scale-[0.98] transition-all shadow-sm">
                        <Phone className="w-4 h-4" strokeWidth={2} /> Call Now
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">Previous</button>
                <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {callFlow.activeCall && (
        <OutcomeSheet
          key={callFlow.activeCall.startedAt}
          contact={callFlow.activeCall.contact}
          onSubmit={callFlow.saveOutcome}
          onClose={callFlow.skip}
          onSaved={(outcomeMeta, logId) => {
            if (outcomeMeta?.requiresLead) {
              setLeadPrompt({ contact: callFlow.activeCall.contact, logId, outcome: outcomeMeta.value })
            }
            callFlow.finish()
          }}
        />
      )}
      {leadPrompt && (
        <CreateLeadDrawer
          contact={leadPrompt.contact}
          callLog={{ _id: leadPrompt.logId, outcome: leadPrompt.outcome }}
          defaultStatus="hot"
          onClose={() => setLeadPrompt(null)}
          onCreated={() => setLeadPrompt(null)}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ContactsPage() {
  const { user } = useAuthStore()
  const isManager = Boolean(user?.isAgencyManager)
  const [tab, setTab] = useState('contacts')
  const [showImport, setShowImport] = useState(false)

  const { data: teamData } = useQuery({
    queryKey: ['agency-team-mine'],
    queryFn: () => agenciesApi.myTeam().then((r) => r.data.data.team),
    enabled: isManager,
    staleTime: 60_000,
  })
  const team = (teamData ?? []).filter((m) => m.isActive)

  if (!isManager) return <AgentQueuePanel />

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
              <BookUser className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Contacts</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Your company's contact pool — import, assign and track calling</p>
            </div>
          </div>
          <button onClick={() => setShowImport(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors shadow-sm shadow-[#F95C4B]/30 whitespace-nowrap self-start sm:self-auto">
            <Upload className="w-4 h-4" /> Import Excel
          </button>
        </div>
        <div className="flex gap-1">
          {[
            { key: 'contacts', label: 'Company Contacts', icon: Users },
            { key: 'performance', label: 'Calling Performance', icon: BarChart3 },
          ].map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all rounded-t-lg ${
                  active ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5' : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
        {tab === 'contacts' ? <ManagerContactsPanel team={team} /> : <CallingPerformancePanel />}
      </div>
      {showImport && <ImportModal isManager onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />}
    </div>
  )
}
