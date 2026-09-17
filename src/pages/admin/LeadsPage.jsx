import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast, differenceInDays } from 'date-fns'
import {
  Plus, Search, X, Trash2, AlertTriangle, Loader2,
  FileText, Users, SlidersHorizontal, Info, ChevronDown, CalendarCheck,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { contactsApi } from '../../services/contactsApi'
import { usersApi } from '../../services/usersApi'
import { areasApi } from '../../services/areasApi'
import {
  ListingFields, ListingBadge, ListingTypeFilter, PropertyFromContact, SearchableContactSelect, getApiErrorMessage,
  LastFollowUpCommentCell, LastFollowUpByCell, isLeadFollowedUpToday, isLeadFollowedUpByMeToday,
  FollowUpActivityFilters,
} from '../../components/leads/leadShared'
import { DateField, TimeField } from '../../components/common/DateTimeFields'
import { useAuthStore } from '../../store/authStore'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const STATUS_TABS = [
  { key: '',           label: 'All' },
  { key: 'cold',       label: 'Cold' },
  { key: 'warm',       label: 'Warm' },
  { key: 'hot',        label: 'Hot' },
  { key: 'listed',     label: 'Listed' },
  { key: 'rented_out', label: 'Rented Out' },
  { key: 'sold',       label: 'Sold' },
  { key: 'lost',       label: 'Lost' },
]

const LEAD_STATUS_META = {
  cold:       { label: 'Cold',       color: '#6B7280', bg: '#6B728018' },
  warm:       { label: 'Warm',       color: '#F59E0B', bg: '#F59E0B18' },
  hot:        { label: 'Hot',        color: '#EF4444', bg: '#EF444418' },
  listed:     { label: 'Listed',     color: '#8B5CF6', bg: '#8B5CF618' },
  rented_out: { label: 'Rented Out', color: '#10B981', bg: '#10B98118' },
  sold:       { label: 'Sold',       color: '#F95C4B', bg: '#F95C4B18' },
  lost:       { label: 'Lost',       color: '#9CA3AF', bg: '#9CA3AF18' },
}

const SORT_OPTIONS = [
  { value: '-createdAt',   label: 'Newest first' },
  { value: 'createdAt',    label: 'Oldest first' },
  { value: 'followUpDate', label: 'Follow-up soonest' },
]

const FOLLOWED_UP_OPTIONS = [
  { value: '',      label: 'Any time' },
  { value: 'today', label: 'Followed up today' },
  { value: 'week',  label: 'Followed up this week' },
  { value: 'month', label: 'Followed up this month' },
]

const EMPTY_CREATE = {
  contactId: '', createdBy: '', landlordName: '', listingType: '', priceMin: '', priceMax: '',
  phone: '', email: '', comments: '', availability: '', bestCallTime: '',
  followUpDate: '', appointmentDate: '', appointmentTime: '', assignedAgent: '',
}

const CALLER_COLORS = [
  { bg: '#3B82F6', light: '#3B82F618' },
  { bg: '#8B5CF6', light: '#8B5CF618' },
  { bg: '#10B981', light: '#10B98118' },
  { bg: '#F59E0B', light: '#F59E0B18' },
  { bg: '#EC4899', light: '#EC489918' },
  { bg: '#14B8A6', light: '#14B8A618' },
]

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function inputCls(hasError) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm',
    'bg-[#F5F5F4] dark:bg-[#202020]',
    'border',
    hasError ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818]',
    'text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40',
    'outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

function LeadStatusBadge({ status, size }) {
  const meta = LEAD_STATUS_META[status] ?? LEAD_STATUS_META.cold
  const pad  = size === 'lg' ? 'px-4 py-1.5 text-xs' : 'px-2.5 py-1 text-[10px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}

function FollowUpChip({ date }) {
  if (!date) return <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">Not set</span>
  const d = new Date(date)
  const overdue = isPast(d)
  const days    = differenceInDays(d, new Date())
  const soon    = !overdue && days <= 7

  if (overdue) {
    return <span className="text-xs font-semibold text-[#EF4444]">{format(d, 'd MMM yyyy')} (overdue)</span>
  }
  if (soon) {
    return <span className="text-xs font-semibold text-[#F59E0B]">{format(d, 'd MMM yyyy')}</span>
  }
  return <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{format(d, 'd MMM yyyy')}</span>
}

function ActionBtn({ icon: Icon, title, onClick, variant }) {
  const colors = {
    blue: 'hover:bg-[#3B82F6]/10 hover:text-[#3B82F6]',
    red:  'hover:bg-[#EF4444]/10 hover:text-[#EF4444]',
    def:  'hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white',
  }
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] transition-all ${colors[variant] ?? colors.def}`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
    </button>
  )
}

function resolveUser(obj) {
  if (!obj) return null
  if (typeof obj === 'object' && obj.firstName) return obj
  return null
}

/* ─── Caller Stats Strip ─────────────────────────────────────────────────── */

function CallerFilterDropdown({ callerFilter, onCallerChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const { data: callersData } = useQuery({
    queryKey: ['cold-callers-select'],
    queryFn: () => usersApi.list({ role: 'cold_caller', limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const rawCallers = callersData?.users ?? callersData ?? []
  const callerList = Array.isArray(rawCallers) ? rawCallers : []

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['leads-all-count'],
    queryFn: () => leadsApi.list({ limit: 1 }).then((r) => r.data.data?.total ?? 0),
    staleTime: 30_000,
  })

  const { data: counts = {} } = useQuery({
    queryKey: ['leads-caller-counts', callerList.map((c) => c._id)],
    queryFn: async () => {
      const results = await Promise.all(
        callerList.map((c) =>
          leadsApi.list({ createdBy: c._id, limit: 1 }).then((r) => [c._id, r.data.data?.total ?? 0])
        )
      )
      return Object.fromEntries(results)
    },
    enabled: callerList.length > 0,
    staleTime: 30_000,
  })

  if (!callerList.length) return null

  const selectedIdx = callerList.findIndex((c) => c._id === callerFilter)
  const selectedCaller = selectedIdx >= 0 ? callerList[selectedIdx] : null
  const selectedColor = selectedIdx >= 0 ? CALLER_COLORS[selectedIdx % CALLER_COLORS.length] : null

  const q = search.trim().toLowerCase()
  const filtered = q
    ? callerList.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
    : callerList

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border',
          selectedCaller
            ? 'border-transparent text-white shadow-sm'
            : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F95C4B]/40',
        ].join(' ')}
        style={selectedCaller ? { backgroundColor: selectedColor.bg } : undefined}
      >
        <span
          className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: selectedCaller ? 'rgba(255,255,255,0.25)' : '#F5F5F4',
            color: selectedCaller ? 'white' : '#6B7280',
          }}
        >
          {selectedCaller
            ? `${selectedCaller.firstName?.[0] ?? ''}${selectedCaller.lastName?.[0] ?? ''}`.toUpperCase()
            : <Users className="w-3 h-3" />}
        </span>
        <span className="max-w-[130px] truncate">
          {selectedCaller ? `${selectedCaller.firstName} ${selectedCaller.lastName}` : 'Cold Caller'}
        </span>
        <span
          className={[
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0',
            selectedCaller ? 'bg-white/20 text-white' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white',
          ].join(' ')}
        >
          {selectedCaller ? (counts[selectedCaller._id] ?? 0) : totalCount}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${selectedCaller ? 'text-white' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-72 bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cold callers…"
              className="w-full pl-8 pr-2 py-2 text-sm bg-[#F5F5F4] dark:bg-[#202020] rounded-lg outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {!q && (
              <button
                type="button"
                onClick={() => { onCallerChange(''); setOpen(false); setSearch('') }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  callerFilter === ''
                    ? 'bg-[#F95C4B]/8 text-[#F95C4B] font-semibold'
                    : 'text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-[#111111] dark:bg-white flex items-center justify-center flex-shrink-0">
                  <Users className="w-3 h-3 text-white dark:text-[#111111]" />
                </span>
                <span className="flex-1 truncate">All Callers</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white min-w-[20px] text-center">
                  {totalCount}
                </span>
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center">
                No cold callers match "{search}"
              </p>
            ) : (
              filtered.map((caller) => {
                const idx = callerList.indexOf(caller)
                const color = CALLER_COLORS[idx % CALLER_COLORS.length]
                const count = counts[caller._id] ?? 0
                const initials = `${caller.firstName?.[0] ?? ''}${caller.lastName?.[0] ?? ''}`.toUpperCase()
                const isActive = callerFilter === caller._id
                return (
                  <button
                    key={caller._id}
                    type="button"
                    onClick={() => { onCallerChange(isActive ? '' : caller._id); setOpen(false); setSearch('') }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                      isActive
                        ? 'bg-[#F95C4B]/8 text-[#F95C4B] font-semibold'
                        : 'text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color.light, color: color.bg }}
                    >
                      {initials}
                    </span>
                    <span className="flex-1 truncate">{caller.firstName} {caller.lastName}</span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                      style={{ backgroundColor: color.light, color: color.bg }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Lead Form (shared for create + edit) ────────────────────────────────── */

function LeadForm({ id, initial, onSubmit, isEdit, onMissingPropertyInfoChange }) {
  const [form, setForm]   = useState(initial)
  const [errors, setErrors] = useState({})
  const [pendingAddress, setPendingAddress] = useState('')
  const [pendingArea, setPendingArea] = useState('')
  const [pendingScheme, setPendingScheme] = useState('')

  // Contacts can run into the thousands, so the picker searches the backend on demand
  // (see SearchableContactSelect) rather than pre-fetching a list here — the currently
  // selected one is still fetched directly, in full, for the property-details panel below.
  const { data: selectedContact, isLoading: contactLoading } = useQuery({
    queryKey: ['contact', form.contactId],
    queryFn: () => contactsApi.getById(form.contactId).then((r) => r.data.data.contact),
    enabled: Boolean(form.contactId),
    staleTime: 30_000,
  })
  const { data: callersData } = useQuery({
    queryKey: ['cold-callers-select'],
    queryFn: () => usersApi.list({ role: 'cold_caller', limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const { data: agentsData } = useQuery({
    queryKey: ['agency-users-select'],
    queryFn: () => usersApi.list({ role: 'agency', limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const { data: areasData } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })

  const callersRaw = callersData?.users ?? callersData ?? []
  const callers   = Array.isArray(callersRaw) ? callersRaw : []
  const agentsRaw = agentsData?.users     ?? agentsData   ?? []
  const agents   = Array.isArray(agentsRaw) ? agentsRaw : []

  const missingAddress = Boolean(selectedContact) && !selectedContact.address && !pendingAddress
  const missingArea = Boolean(selectedContact) && !(selectedContact.area && typeof selectedContact.area === 'object') && !pendingArea
  const missingPropertyInfo = missingAddress || missingArea

  useEffect(() => {
    onMissingPropertyInfoChange?.(missingPropertyInfo)
  }, [missingPropertyInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  // A new contact selection invalidates whatever was typed in for the previous one.
  useEffect(() => {
    setPendingAddress('')
    setPendingArea('')
  }, [form.contactId])

  // Scheme isn't "missing data to fill in" like address/area — it pre-fills from
  // whatever the contact already has (once loaded) but stays editable, since a landlord
  // can own units across more than one sectional scheme.
  useEffect(() => {
    setPendingScheme(selectedContact?.sectionalScheme ?? '')
  }, [selectedContact?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.landlordName.trim())     errs.landlordName     = 'Landlord name is required'
    if (form.priceMin !== '' && form.priceMax !== '' && Number(form.priceMax) < Number(form.priceMin)) {
      errs.priceMax = 'Max price must be at least the min price'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (missingPropertyInfo) return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    // Address/area/scheme live on the Contact, not the Lead — if any changed here
    // (address/area because the contact was missing them, scheme because a landlord
    // can own units across more than one), save that to the contact first so the
    // backend's own contact-derived address/area check on lead creation passes.
    const schemeChanged = selectedContact && pendingScheme.trim() !== (selectedContact.sectionalScheme ?? '').trim()
    if (selectedContact && (pendingAddress || pendingArea || schemeChanged)) {
      try {
        await contactsApi.update(selectedContact._id, {
          ...(pendingAddress ? { address: pendingAddress } : {}),
          ...(pendingArea ? { area: pendingArea } : {}),
          ...(schemeChanged ? { sectionalScheme: pendingScheme.trim() || null } : {}),
        })
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to save the contact's address/area"))
        return
      }
    }

    const payload = {}
    Object.entries(form).forEach(([k, v]) => {
      payload[k] = v === '' ? null : v
    })
    onSubmit(payload)
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Contact">
        <SearchableContactSelect value={form.contactId} onChange={(id) => setField('contactId', id)} />
      </Field>

      {!isEdit && (
        <Field label="Lead Owner" hint="Who this lead is attributed to — defaults to you">
          <select value={form.createdBy} onChange={(e) => setField('createdBy', e.target.value)} className={inputCls(false)}>
            <option value="">Me (Admin)</option>
            {callers.map((c) => (
              <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Landlord Name" required error={errors.landlordName}>
        <input value={form.landlordName} onChange={(e) => setField('landlordName', e.target.value)} placeholder="Full name" className={inputCls(errors.landlordName)} />
      </Field>

      <PropertyFromContact
        contact={selectedContact}
        loading={contactLoading}
        areas={areasData}
        pendingAddress={pendingAddress}
        pendingArea={pendingArea}
        pendingScheme={pendingScheme}
        onAddressChange={setPendingAddress}
        onAreaChange={setPendingArea}
        onSchemeChange={setPendingScheme}
      />

      <ListingFields form={form} setField={setField} errors={errors} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" error={errors.phone}>
          <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+27831234567" className={inputCls(errors.phone)} />
        </Field>
        <Field label="Email">
          <input type="text" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" className={inputCls(false)} />
        </Field>
      </div>

      <Field label="Comments">
        <textarea value={form.comments} onChange={(e) => setField('comments', e.target.value)} placeholder="Notes about this lead..." rows={3} className={`${inputCls(false)} resize-none`} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Availability">
          <input value={form.availability} onChange={(e) => setField('availability', e.target.value)} placeholder="Weekday mornings" className={inputCls(false)} />
        </Field>
        <Field label="Best Call Time">
          <input value={form.bestCallTime} onChange={(e) => setField('bestCallTime', e.target.value)} placeholder="8am - 11am" className={inputCls(false)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Follow-up Date">
          <DateField value={form.followUpDate} onChange={(v) => setField('followUpDate', v)} className={inputCls(false)} />
        </Field>
        <Field label="Appointment Date">
          <DateField value={form.appointmentDate} onChange={(v) => setField('appointmentDate', v)} className={inputCls(false)} />
        </Field>
      </div>

      <Field label="Appointment Time">
        <TimeField value={form.appointmentTime} onChange={(v) => setField('appointmentTime', v)} className={inputCls(false)} />
      </Field>

      <Field label="Assigned Agent">
        <select value={form.assignedAgent} onChange={(e) => setField('assignedAgent', e.target.value)} className={inputCls(false)}>
          <option value="">-- Unassigned --</option>
          {agents.map((a) => (
            <option key={a._id} value={a._id}>{a.firstName} {a.lastName}</option>
          ))}
        </select>
      </Field>

      {isEdit && (
        <>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#3B82F6]/8 border border-[#3B82F6]/20">
            <Info className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-[#3B82F6] leading-relaxed">
              To change this lead's status, use the <strong>Change Status</strong> action — every
              change requires a reason and is logged to the lead's history.
            </p>
          </div>

          <Field label="Admin Reviewed">
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="adminReviewed"
                checked={form.adminReviewed ?? false}
                onChange={(e) => setField('adminReviewed', e.target.checked)}
                className="w-4 h-4 accent-[#F95C4B] cursor-pointer"
              />
              <label htmlFor="adminReviewed" className="text-sm text-[#111111] dark:text-white cursor-pointer">
                Mark as admin reviewed
              </label>
            </div>
          </Field>

          <Field label="Admin Notes">
            <textarea value={form.adminNotes ?? ''} onChange={(e) => setField('adminNotes', e.target.value)} placeholder="Internal notes..." rows={3} className={`${inputCls(false)} resize-none`} />
          </Field>
        </>
      )}
    </form>
  )
}

/* ─── Create Drawer ───────────────────────────────────────────────────────── */

function CreateDrawer({ onClose, onSaved }) {
  const qc = useQueryClient()
  const [missingPropertyInfo, setMissingPropertyInfo] = useState(false)
  const mut = useMutation({
    mutationFn: (data) => leadsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead created successfully')
      onSaved()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create lead')),
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">New Lead</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <LeadForm
            id="create-lead-form"
            initial={EMPTY_CREATE}
            onSubmit={(payload) => mut.mutate(payload)}
            isEdit={false}
            onMissingPropertyInfoChange={setMissingPropertyInfo}
          />
        </div>
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit" form="create-lead-form"
            disabled={mut.isPending || missingPropertyInfo}
            title={missingPropertyInfo ? 'This contact needs an address and area set first' : undefined}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Lead
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Delete Dialog ───────────────────────────────────────────────────────── */

function DeleteDialog({ lead, onClose, onDeleted }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: () => leadsApi.remove(lead._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead deleted')
      onDeleted()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Delete failed')),
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">Delete Lead</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
            Are you sure you want to delete the lead for{' '}
            <span className="font-semibold text-[#111111] dark:text-white">{lead?.landlordName}</span>?{' '}
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Lead Row ────────────────────────────────────────────────────────────── */

function LeadRow({ lead, onOpen, onDelete, currentUserId }) {
  const contactObj = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const agentUser  = resolveUser(lead.assignedAgent)
  const callerUser = resolveUser(lead.createdBy)
  const followedUpToday = isLeadFollowedUpToday(lead)
  const followedUpByMeToday = isLeadFollowedUpByMeToday(lead, currentUserId)

  return (
    <tr
      onClick={onOpen}
      className={[
        'group transition-colors cursor-pointer border-l-2',
        followedUpByMeToday
          ? 'bg-[#10B981]/[0.05] hover:bg-[#10B981]/[0.08] dark:bg-[#10B981]/[0.07] dark:hover:bg-[#10B981]/10 border-l-transparent animate-glow-pulse-ring'
          : followedUpToday
            ? 'bg-[#10B981]/[0.04] hover:bg-[#10B981]/[0.07] dark:bg-[#10B981]/[0.06] dark:hover:bg-[#10B981]/10 border-l-[#10B981]'
            : 'border-l-transparent hover:bg-[#FAFAF9] dark:hover:bg-[#111111]',
      ].join(' ')}
    >
      <td className="px-4 py-3.5">
        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[180px]">{lead.landlordName}</p>
        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[180px]">{lead.propertyAddress}</p>
        <div className="mt-1">
          <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-sm text-[#111111] dark:text-white">{contactObj?.name ?? lead.landlordName}</p>
        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">{lead.phone}</p>
      </td>
      <td className="px-4 py-3.5">
        {callerUser ? (
          <p className="text-sm text-[#111111] dark:text-white">{callerUser.firstName} {callerUser.lastName}</p>
        ) : (
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">Unknown</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {agentUser ? (
          <p className="text-sm text-[#111111] dark:text-white">{agentUser.firstName} {agentUser.lastName}</p>
        ) : (
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <LeadStatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3.5">
        <FollowUpChip date={lead.followUpDate} />
      </td>
      <td className="px-4 py-3.5">
        <LastFollowUpCommentCell lead={lead} currentUserId={currentUserId} />
      </td>
      <td className="px-4 py-3.5">
        <LastFollowUpByCell lead={lead} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <ActionBtn icon={Trash2} title="Delete" onClick={onDelete} variant="red" />
        </div>
      </td>
    </tr>
  )
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <FileText className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No leads found' : 'No leads yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try adjusting your search or filters.' : 'Start by logging your first lead.'}
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

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function LeadsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search,        setSearch]      = useState('')
  const [statusFilter,  setStatus]      = useState('')
  const [listingTypeFilter, setListingTypeFilter] = useState('')
  const [callerFilter,  setCallerFilter] = useState('')
  const [followedUpFilter, setFollowedUpFilter] = useState('')
  const [hasFollowUpFilter, setHasFollowUpFilter] = useState(false)
  const [hasCommentFilter, setHasCommentFilter] = useState(false)
  const [sort,          setSort]        = useState('-createdAt')
  const [drawer,        setDrawer]      = useState(null)
  const [toDelete,      setToDelete]    = useState(null)

  const debouncedSearch = useDebounce(search)

  useEffect(() => { /* reset page if needed */ }, [debouncedSearch, statusFilter, listingTypeFilter, callerFilter, followedUpFilter, hasFollowUpFilter, hasCommentFilter, sort])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leads', { search: debouncedSearch, status: statusFilter, listingType: listingTypeFilter, createdBy: callerFilter, followedUpWithin: followedUpFilter, hasFollowUp: hasFollowUpFilter, hasComment: hasCommentFilter, sort }],
    queryFn: () =>
      leadsApi
        .list({
          search:      debouncedSearch     || undefined,
          status:      statusFilter        || undefined,
          listingType: listingTypeFilter   || undefined,
          followedUpWithin: followedUpFilter || undefined,
          hasFollowUp: hasFollowUpFilter ? 'true' : undefined,
          hasComment:  hasCommentFilter  ? 'true' : undefined,
          createdBy:   callerFilter        || undefined,
          sort,
          limit: 100,
        })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const leads = data?.leads ?? data ?? []
  const total = Array.isArray(leads) ? leads.length : 0
  const hasFilters = Boolean(search || statusFilter || listingTypeFilter || callerFilter || followedUpFilter || hasFollowUpFilter || hasCommentFilter)

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              Leads
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading...' : `${total} lead${total !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-0.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap',
                'border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5 dark:bg-[#F95C4B]/8'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.key && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: LEAD_STATUS_META[tab.key]?.color }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3.5 flex flex-col gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search landlord, address, phone..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <CallerFilterDropdown callerFilter={callerFilter} onCallerChange={setCallerFilter} />

          <ListingTypeFilter value={listingTypeFilter} onChange={setListingTypeFilter} accent="#F95C4B" />

          <div className={[
            'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors',
            followedUpFilter
              ? 'bg-[#10B981]/8 border-[#10B981]/30'
              : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A]',
          ].join(' ')}>
            <CalendarCheck className={`w-3.5 h-3.5 flex-shrink-0 ${followedUpFilter ? 'text-[#10B981]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`} />
            <select
              value={followedUpFilter}
              onChange={(e) => setFollowedUpFilter(e.target.value)}
              className={`bg-transparent text-sm outline-none cursor-pointer ${followedUpFilter ? 'text-[#10B981] font-semibold' : 'text-[#111111] dark:text-white'}`}
            >
              {FOLLOWED_UP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <FollowUpActivityFilters
            hasFollowUp={hasFollowUpFilter}
            onHasFollowUpChange={setHasFollowUpFilter}
            hasComment={hasCommentFilter}
            onHasCommentChange={setHasCommentFilter}
          />

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] ml-auto">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-transparent text-[#111111] dark:text-white text-sm outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Table area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load leads. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
          </div>
        ) : !Array.isArray(leads) || leads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onAdd={() => setDrawer({ mode: 'create' })} />
        ) : (
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Landlord / Address</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Contact</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Agent</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Status</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Follow-up</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Last Follow-Up</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Followed Up By</th>
                    <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                  {leads.map((lead) => (
                    <LeadRow
                      key={lead._id}
                      lead={lead}
                      onOpen={() => navigate(`/admin/leads/${lead._id}`)}
                      onDelete={() => setToDelete(lead)}
                      currentUserId={user?._id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawers / panels ─────────────────────────────────────────────── */}
      {drawer?.mode === 'create' && (
        <CreateDrawer onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} />
      )}

      {/* ── Delete dialog ─────────────────────────────────────────────────── */}
      {toDelete && (
        <DeleteDialog lead={toDelete} onClose={() => setToDelete(null)} onDeleted={() => setToDelete(null)} />
      )}
    </div>
  )
}
