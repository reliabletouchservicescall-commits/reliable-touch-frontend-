import { createContext, useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, ChevronRight, CalendarPlus, PencilLine } from 'lucide-react'
import SidePanel from '../common/SidePanel'
import BookAppointmentDrawer from '../appointments/BookAppointmentDrawer'
import { NewApplicationModal } from '../tenants/TenantApplications'
import { NewLeadFlow } from '../../pages/agency/LeadsPage'
import { leadsApi } from '../../services/leadsApi'
import { useAuthStore } from '../../store/authStore'
import { LeadStatusBadge, inputCls } from '../leads/leadShared'
import ReminderDialog from './ReminderDialog'
import LeadUpdateDialog from './LeadUpdateDialog'

// The agent's everyday actions, opened in place from anywhere — the top bar's "+ New",
// the Home buttons, the Diary and a lead's action bar all call the same forms:
//   open('lead')                       new lead (pick or add the contact first)
//   open('viewing', { lead? })         book a viewing (pick the lead first if none given)
//   open('tenant', { lead? })          send a tenant application link
//   open('update', { leadId | lead? }) one-step update; no lead → pick a waiting landlord

const late = (h) => { const d = Math.max(1, Math.round(-h / 24)); return `Waiting ${d} day${d === 1 ? '' : 's'} past the promise` }

const Ctx = createContext(null)
export const useAgentActions = () => useContext(Ctx)

// Pick one of my leads — searchable; `preset` shows a ready list first (e.g. landlords waiting)
function PickLead({ title, subtitle, icon, preset, onPick, onClose }) {
  const [q, setQ] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['agent-pick-lead', q],
    queryFn: () => leadsApi.list({ search: q || undefined, limit: 8 }).then((r) => r.data.data.leads),
    enabled: !preset || Boolean(q),
    staleTime: 15_000,
  })
  const rows = preset && !q ? preset : data ?? []
  return (
    <SidePanel onClose={onClose} icon={icon} title={title} subtitle={subtitle} widthClass="sm:max-w-md">
      <div className="space-y-3 p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search landlord, address or phone…" className={`${inputCls(false)} pl-9`} />
        </div>
        {isFetching && !rows.length ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#F95C4B]" /></div>
          : !rows.length ? <p className="rounded-xl bg-[#F5F5F4] p-4 text-center text-xs text-[#6B7280] dark:bg-[#202020] dark:text-[#A1A1AA]">No leads match{q ? ' that' : ''}.</p>
            : (
              <ul className="space-y-1.5">
                {rows.map((l) => (
                  <li key={l._id ?? l.id}>
                    <button type="button" onClick={() => onPick(l)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[#E5E7EB] p-3 text-left transition-colors hover:border-[#F95C4B]/50 dark:border-[#2A2A2A]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#111111] dark:text-white">{l.landlordName}</span>
                        <span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{l.note ?? l.propertyAddress}</span>
                      </span>
                      {l.status && <LeadStatusBadge status={l.status} />}
                      <ChevronRight className="h-4 w-4 flex-none text-[#9CA3AF]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </div>
    </SidePanel>
  )
}

export function AgentActionsProvider({ children }) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [cur, setCur] = useState(null)
  const close = () => setCur(null)
  const refresh = () => ['agent-home', 'agent-diary', 'agent-leads', 'leads-my-counts', 'tenant-apps'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const api = useMemo(() => ({ open: (kind, payload = {}) => setCur({ kind, ...payload }) }), [])

  // Landlords waiting on news, from Home's data (already loaded there)
  const home = qc.getQueryData(['agent-home'])
  const waiting = (home?.promise?.leads ?? []).map((l) => ({ _id: l.id, landlordName: l.landlordName, note: l.hoursLeft <= 0 ? late(l.hoursLeft) : `Update due in ${l.hoursLeft}h` }))

  let el = null
  if (cur?.kind === 'lead') {
    el = <NewLeadFlow isManager={false} team={[]} currentUserId={user?._id} onClose={close} onCreated={() => { close(); refresh() }} />
  } else if (cur?.kind === 'viewing') {
    el = cur.lead
      ? <BookAppointmentDrawer lead={cur.lead} agencyMode={{ isManager: false, currentUserId: user?._id }} onClose={close} onBooked={() => { close(); refresh() }} />
      : <PickLead title="Book a viewing" subtitle="Which lead is it for?" icon={CalendarPlus} onClose={close} onPick={(l) => setCur({ kind: 'viewing', lead: l })} />
  } else if (cur?.kind === 'tenant') {
    const l = cur.lead
    el = <NewApplicationModal initialLead={l ? { id: l._id ?? l.id, propertyAddress: l.propertyAddress, landlordName: l.landlordName } : null} onClose={close} onCreated={refresh} />
  } else if (cur?.kind === 'reminder') {
    el = <ReminderDialog reminder={cur.reminder} lead={cur.lead} date={cur.date} onClose={close} />
  } else if (cur?.kind === 'update') {
    el = cur.leadId || cur.lead
      ? <LeadUpdateDialog leadId={cur.leadId ?? cur.lead?._id} lead={cur.lead} onClose={close}
          onTenantLink={(l) => setCur({ kind: 'tenant', lead: l })}
          onOpenLead={(l) => navigate(`/agency/leads/${l._id}`)} />
      : <PickLead title="Update a landlord" subtitle="Who are you updating?" icon={PencilLine} preset={waiting.length ? waiting : null} onClose={close} onPick={(l) => setCur({ kind: 'update', leadId: l._id })} />
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {el}
    </Ctx.Provider>
  )
}
