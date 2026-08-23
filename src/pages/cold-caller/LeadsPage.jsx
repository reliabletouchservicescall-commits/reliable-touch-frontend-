import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  FileText, Plus, Search, X, Loader2, AlertTriangle, MapPin,
  Phone, Calendar, ChevronRight, Users,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { contactsApi } from '../../services/contactsApi'
import { LEAD_STATUS_META, LeadStatusBadge, FollowUpChip } from '../../components/leads/leadShared'
import SidePanel from '../../components/common/SidePanel'
import CreateLeadDrawer from '../../components/leads/CreateLeadDrawer'
import LeadDetailDrawer from '../../components/leads/LeadDetailDrawer'

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'cold',      label: 'Cold' },
  { key: 'warm',      label: 'Warm' },
  { key: 'hot',       label: 'Hot' },
  { key: 'converted', label: 'Converted' },
  { key: 'lost',      label: 'Lost' },
]

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

/* ─── Contact Picker (step 1 of manual "New Lead") ──────────────────────── */

function ContactPickerPanel({ onClose, onPick }) {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts-for-lead', debounced],
    queryFn: () => contactsApi.list({ search: debounced || undefined, limit: 50 }).then((r) => r.data.data),
    staleTime: 15_000,
  })
  const contacts = data?.contacts ?? []

  return (
    <SidePanel onClose={onClose} icon={Users} iconColor="#3B82F6" title="Select a Contact" subtitle="Who is this lead for?">
      <div className="px-5 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your contacts…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#3B82F6] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-10">No contacts found.</p>
        ) : (
          <ul className="space-y-1.5">
            {contacts.map((c) => (
              <li key={c._id}>
                <button
                  onClick={() => onPick(c)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/5 text-left transition-all"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#3B82F6]">
                      {c.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{c.name}</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">{c.phone}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidePanel>
  )
}

/* ─── Lead Card ──────────────────────────────────────────────────────────── */

function LeadCard({ lead, onOpen }) {
  const areaObj = (lead.area && typeof lead.area === 'object') ? lead.area : null
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] hover:shadow-card transition-all p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{lead.landlordName}</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 truncate">{lead.propertyAddress}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-3">
        <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
          <Phone className="w-3 h-3 flex-shrink-0" />
          {lead.phone}
        </span>
        {areaObj && (
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {areaObj.name}
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          {format(new Date(lead.createdAt), 'd MMM')}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F5F5F4] dark:border-[#202020]">
        <FollowUpChip date={lead.followUpDate} />
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#3B82F6]">
          View details <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No leads found' : 'No leads yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters
          ? 'Try a different search or status filter.'
          : 'When a landlord sounds interested on a call, mark it "Interested" and we\'ll help you log it here.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function ColdCallerLeadsPage() {
  const { contactId } = useParams()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [createContact, setCreateContact] = useState(null)
  const [activeLead, setActiveLead] = useState(null)

  const debouncedSearch = useDebounce(search)

  // Deep link: /cold-caller/leads/new/:contactId — jump straight into the create form.
  const { data: deepLinkContact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsApi.getById(contactId).then((r) => r.data.data.contact),
    enabled: Boolean(contactId),
  })
  useEffect(() => {
    if (deepLinkContact) setCreateContact(deepLinkContact)
  }, [deepLinkContact])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leads', { search: debouncedSearch, status: statusFilter, mine: true }],
    queryFn: () =>
      leadsApi
        .list({ search: debouncedSearch || undefined, status: statusFilter || undefined, limit: 100 })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const leads = data?.leads ?? []
  const total = leads.length
  const hasFilters = Boolean(search || statusFilter)

  const counts = STATUS_TABS.reduce((acc, t) => {
    if (!t.key) return acc
    acc[t.key] = leads.filter((l) => l.status === t.key).length
    return acc
  }, {})

  function closeCreateFlow() {
    setCreateContact(null)
    if (contactId) navigate('/cold-caller/leads', { replace: true })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              My Leads
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : `${total} lead${total !== 1 ? 's' : ''} you've created`}
            </p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md active:scale-[0.98] transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-0.5 overflow-x-auto pb-px">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap',
                'border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5 dark:bg-[#F95C4B]/8'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.key && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: LEAD_STATUS_META[tab.key]?.color }} />}
              {tab.label}
              {tab.key && counts[tab.key] > 0 && (
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#A1A1AA]">{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search landlord, address, phone…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load leads. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onAdd={() => setPickerOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => (
              <LeadCard key={lead._id} lead={lead} onOpen={() => setActiveLead(lead)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Panels ───────────────────────────────────────────────────────── */}
      {pickerOpen && (
        <ContactPickerPanel
          onClose={() => setPickerOpen(false)}
          onPick={(contact) => { setCreateContact(contact); setPickerOpen(false) }}
        />
      )}

      {createContact && (
        <CreateLeadDrawer
          contact={createContact}
          onClose={closeCreateFlow}
          onCreated={closeCreateFlow}
        />
      )}

      {activeLead && (
        <LeadDetailDrawer
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onUpdated={() => setActiveLead(null)}
        />
      )}
    </div>
  )
}
