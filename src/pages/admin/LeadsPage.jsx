import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast, differenceInDays } from 'date-fns'
import {
  Plus, Search, X, Pencil, Trash2, Eye, AlertTriangle, Loader2,
  FileText, Phone, Mail, MapPin, User, Users, Building2, Calendar,
  Clock, SlidersHorizontal, CheckCircle2, ShieldCheck, PhoneCall,
  Info, History, ArrowRight, Repeat,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { contactsApi } from '../../services/contactsApi'
import { usersApi } from '../../services/usersApi'
import LeadAppointments from '../../components/appointments/LeadAppointments'
import { ListingFields, ListingBadge, PropertyFromContact } from '../../components/leads/leadShared'
import { DateField, TimeField } from '../../components/common/DateTimeFields'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'cold',      label: 'Cold' },
  { key: 'warm',      label: 'Warm' },
  { key: 'hot',       label: 'Hot' },
  { key: 'converted', label: 'Converted' },
  { key: 'lost',      label: 'Lost' },
]

const LEAD_STATUS_META = {
  cold:      { label: 'Cold',      color: '#6B7280', bg: '#6B728018' },
  warm:      { label: 'Warm',      color: '#F59E0B', bg: '#F59E0B18' },
  hot:       { label: 'Hot',       color: '#EF4444', bg: '#EF444418' },
  converted: { label: 'Converted', color: '#10B981', bg: '#10B98118' },
  lost:      { label: 'Lost',      color: '#9CA3AF', bg: '#9CA3AF18' },
}

const SORT_OPTIONS = [
  { value: '-createdAt',   label: 'Newest first' },
  { value: 'createdAt',    label: 'Oldest first' },
  { value: 'followUpDate', label: 'Follow-up soonest' },
]

const EMPTY_CREATE = {
  contactId: '', landlordName: '', listingType: '', priceMin: '', priceMax: '',
  phone: '', email: '', comments: '', availability: '', bestCallTime: '',
  followUpDate: '', appointmentDate: '', appointmentTime: '', assignedAgent: '',
}

const STATUS_OPTS = ['cold', 'warm', 'hot', 'converted', 'lost']

const CALL_OUTCOME_LABEL = {
  no_answer: 'No Answer', voicemail: 'Voicemail', callback_requested: 'Callback Requested',
  interested: 'Interested', not_interested: 'Not Interested', wrong_number: 'Wrong Number', remove_me: 'Remove Me',
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

function userName(obj) {
  const u = resolveUser(obj)
  return u ? `${u.firstName} ${u.lastName}` : null
}

/* ─── Caller Stats Strip ─────────────────────────────────────────────────── */

function CallerStatsStrip({ callerFilter, onCallerChange }) {
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

  return (
    <div className="px-5 sm:px-8 py-3.5 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2.5">
        Filter by Cold Caller
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {/* All */}
        <button
          onClick={() => onCallerChange('')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
            callerFilter === ''
              ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] shadow-sm'
              : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#111111] dark:hover:border-white hover:text-[#111111] dark:hover:text-white',
          ].join(' ')}
        >
          <Users className="w-3.5 h-3.5" />
          All Callers
          <span className={[
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
            callerFilter === ''
              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#111111]'
              : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white',
          ].join(' ')}>
            {totalCount}
          </span>
        </button>

        {callerList.map((caller, idx) => {
          const color    = CALLER_COLORS[idx % CALLER_COLORS.length]
          const count    = counts[caller._id] ?? 0
          const initials = `${caller.firstName?.[0] ?? ''}${caller.lastName?.[0] ?? ''}`.toUpperCase()
          const isActive = callerFilter === caller._id

          return (
            <button
              key={caller._id}
              onClick={() => onCallerChange(isActive ? '' : caller._id)}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                isActive
                  ? 'shadow-sm'
                  : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white',
              ].join(' ')}
              style={isActive ? { backgroundColor: color.bg, color: 'white', borderColor: 'transparent' } : {}}
            >
              <span
                className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : color.light,
                  color: isActive ? 'white' : color.bg,
                }}
              >
                {initials}
              </span>
              {caller.firstName} {caller.lastName}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : color.light,
                  color: isActive ? 'white' : color.bg,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Lead Form (shared for create + edit) ────────────────────────────────── */

function LeadForm({ id, initial, onSubmit, isPending, isEdit }) {
  const [form, setForm]   = useState(initial)
  const [errors, setErrors] = useState({})

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-select'],
    queryFn: () => contactsApi.list({ limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const { data: agentsData } = useQuery({
    queryKey: ['agency-users-select'],
    queryFn: () => usersApi.list({ role: 'agency', limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const contacts = contactsData?.contacts ?? contactsData ?? []
  const agentsRaw = agentsData?.users     ?? agentsData   ?? []
  const agents   = Array.isArray(agentsRaw) ? agentsRaw : []
  const selectedContact = contacts.find((c) => c._id === form.contactId) ?? null

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.landlordName.trim())     errs.landlordName     = 'Landlord name is required'
    if (!form.listingType)             errs.listingType      = 'Select sale or rental'
    if (form.priceMin === '')          errs.priceMin         = 'Enter a minimum price'
    if (form.priceMax === '')          errs.priceMax         = 'Enter a maximum price'
    if (form.priceMin !== '' && form.priceMax !== '' && Number(form.priceMax) < Number(form.priceMin)) {
      errs.priceMax = 'Max price must be at least the min price'
    }
    if (!form.phone.trim())            errs.phone            = 'Phone is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    const payload = {}
    Object.entries(form).forEach(([k, v]) => {
      payload[k] = v === '' ? null : v
    })
    onSubmit(payload)
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Contact">
        <select value={form.contactId} onChange={(e) => setField('contactId', e.target.value)} className={inputCls(false)}>
          <option value="">-- Select contact --</option>
          {Array.isArray(contacts) && contacts.map((c) => (
            <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>
          ))}
        </select>
      </Field>

      <Field label="Landlord Name" required error={errors.landlordName}>
        <input value={form.landlordName} onChange={(e) => setField('landlordName', e.target.value)} placeholder="Full name" className={inputCls(errors.landlordName)} />
      </Field>

      <PropertyFromContact contact={selectedContact} />

      <ListingFields form={form} setField={setField} errors={errors} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" required error={errors.phone}>
          <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+27831234567" className={inputCls(errors.phone)} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" className={inputCls(false)} />
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
  const mut = useMutation({
    mutationFn: (data) => leadsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead created successfully')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to create lead'),
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
            isPending={mut.isPending}
            isEdit={false}
          />
        </div>
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button type="submit" form="create-lead-form" disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Lead
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Edit Drawer ─────────────────────────────────────────────────────────── */

function EditDrawer({ lead, onClose, onSaved }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (data) => leadsApi.update(lead._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead updated successfully')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to update lead'),
  })

  const initial = {
    contactId:       lead.contactId?._id ?? lead.contactId ?? '',
    landlordName:    lead.landlordName   ?? '',
    listingType:     lead.listingType    ?? '',
    priceMin:        lead.priceMin       ?? '',
    priceMax:        lead.priceMax       ?? '',
    phone:           lead.phone          ?? '',
    email:           lead.email          ?? '',
    comments:        lead.comments       ?? '',
    availability:    lead.availability   ?? '',
    bestCallTime:    lead.bestCallTime   ?? '',
    followUpDate:    lead.followUpDate   ? lead.followUpDate.slice(0, 10) : '',
    appointmentDate: lead.appointmentDate ? lead.appointmentDate.slice(0, 10) : '',
    appointmentTime: lead.appointmentTime ?? '',
    assignedAgent:   lead.assignedAgent?._id ?? lead.assignedAgent ?? '',
    adminReviewed:   lead.adminReviewed  ?? false,
    adminNotes:      lead.adminNotes     ?? '',
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">Edit Lead</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{lead.landlordName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <LeadForm
            id="edit-lead-form"
            initial={initial}
            onSubmit={(payload) => mut.mutate(payload)}
            isPending={mut.isPending}
            isEdit={true}
          />
        </div>
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button type="submit" form="edit-lead-form" disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── View Slide-over ─────────────────────────────────────────────────────── */

function ViewPanel({ lead, onClose, onChangeStatus }) {
  const createdByUser  = resolveUser(lead.createdBy)
  const assignedUser   = resolveUser(lead.assignedAgent)
  const contactObj     = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const areaObj        = (lead.area && typeof lead.area === 'object') ? lead.area : null
  const sourceCall     = (lead.callLogId && typeof lead.callLogId === 'object') ? lead.callLogId : null

  function InfoRow({ icon: Icon, label, value }) {
    if (!value) return null
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#181818]">
        <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
          <p className="text-sm text-[#111111] dark:text-white break-words">{value}</p>
        </div>
      </div>
    )
  }

  function Section({ title, children }) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2">{title}</p>
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A] overflow-hidden">
          {children}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[540px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">Lead Details</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-bold text-[#111111] dark:text-white">{lead.landlordName}</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{lead.propertyAddress}</p>
                <div className="mt-2">
                  <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <LeadStatusBadge status={lead.status} size="lg" />
                  <button
                    onClick={onChangeStatus}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-[#3B82F6]/10 transition-colors"
                  >
                    <Repeat className="w-3 h-3" />
                    Change
                  </button>
                </div>
                {lead.adminReviewed && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#10B981]">
                    <ShieldCheck className="w-3 h-3" /> Admin Reviewed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact */}
          <Section title="Contact">
            <InfoRow icon={User}  label="Name"  value={contactObj?.name  ?? lead.landlordName} />
            <InfoRow icon={Phone} label="Phone" value={lead.phone} />
            <InfoRow icon={Mail}  label="Email" value={lead.email} />
          </Section>

          {/* Cold Caller */}
          {createdByUser && (
            <Section title="Cold Caller">
              <InfoRow icon={User} label="Name"  value={`${createdByUser.firstName} ${createdByUser.lastName}`} />
              <InfoRow icon={Mail} label="Email" value={createdByUser.email} />
            </Section>
          )}

          {/* Sourced from call */}
          {sourceCall && (
            <Section title="Sourced From Call">
              <InfoRow
                icon={PhoneCall}
                label="Outcome"
                value={CALL_OUTCOME_LABEL[sourceCall.outcome] ?? sourceCall.outcome}
              />
              <InfoRow
                icon={Clock}
                label="Called At"
                value={sourceCall.calledAt ? format(new Date(sourceCall.calledAt), 'd MMM yyyy, HH:mm') : null}
              />
              <InfoRow icon={FileText} label="Call Notes" value={sourceCall.notes} />
            </Section>
          )}

          {/* Assigned Agent */}
          <Section title="Assigned Agent">
            {assignedUser ? (
              <>
                <InfoRow icon={User} label="Name"  value={`${assignedUser.firstName} ${assignedUser.lastName}`} />
                <InfoRow icon={Mail} label="Email" value={assignedUser.email} />
              </>
            ) : (
              <div className="px-4 py-3 bg-white dark:bg-[#181818]">
                <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] italic">Unassigned</p>
              </div>
            )}
          </Section>

          {/* Property Details */}
          <Section title="Property Details">
            <InfoRow icon={MapPin}    label="Address"          value={lead.propertyAddress} />
            <InfoRow icon={Building2} label="Area"             value={areaObj?.name} />
            <InfoRow icon={Building2} label="Sectional Scheme" value={contactObj?.sectionalScheme} />
            <InfoRow icon={FileText}  label="Unit"             value={contactObj?.unitNumber} />
            <InfoRow icon={FileText}  label="Size"             value={contactObj?.sizeInSqm ? `${contactObj.sizeInSqm} m²` : null} />
            <InfoRow icon={Clock}     label="Availability"     value={lead.availability} />
            <InfoRow icon={Phone}     label="Best Call Time"   value={lead.bestCallTime} />
          </Section>

          {/* Follow-up & Appointments */}
          <Section title="Follow-up and Appointments">
            <InfoRow icon={Calendar} label="Follow-up Date"    value={lead.followUpDate    ? format(new Date(lead.followUpDate),    'd MMM yyyy') : null} />
            <InfoRow icon={Calendar} label="Appointment Date"  value={lead.appointmentDate ? format(new Date(lead.appointmentDate), 'd MMM yyyy') : null} />
            <InfoRow icon={Clock}    label="Appointment Time"  value={lead.appointmentTime} />
          </Section>

          <LeadAppointments lead={lead} />

          {/* Comments */}
          {lead.comments && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Comments
              </p>
              <p className="text-sm text-[#111111] dark:text-white bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                {lead.comments}
              </p>
            </div>
          )}

          {/* Admin Notes */}
          {lead.adminNotes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin Notes
              </p>
              <p className="text-sm text-[#111111] dark:text-white bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                {lead.adminNotes}
              </p>
            </div>
          )}

          {/* Status History */}
          {lead.statusHistory?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Status History
              </p>
              <ul className="space-y-2.5">
                {[...lead.statusHistory].reverse().map((h, i) => {
                  const changer = resolveUser(h.changedBy)
                  return (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                      <div className="flex-shrink-0 mt-0.5">
                        <LeadStatusBadge status={h.status} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {h.reason && (
                          <p className="text-sm text-[#111111] dark:text-white leading-relaxed">"{h.reason}"</p>
                        )}
                        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-1">
                          {changer ? `${changer.firstName} ${changer.lastName}` : 'System'}
                          {h.changedAt && ` · ${format(new Date(h.changedAt), 'd MMM yyyy, HH:mm')}`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] space-y-1">
            <p>Created: {format(new Date(lead.createdAt), 'd MMM yyyy, HH:mm')}</p>
            <p>Updated: {format(new Date(lead.updatedAt), 'd MMM yyyy, HH:mm')}</p>
          </div>
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
    onError: (err) => toast.error(err.response?.data?.message ?? 'Delete failed'),
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

/* ─── Status Change Dialog ───────────────────────────────────────────────── */

function StatusChangeDialog({ lead, onClose, onUpdated }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(lead.status)
  const [reason, setReason] = useState('')
  const [error, setError]   = useState('')

  const mut = useMutation({
    mutationFn: () => leadsApi.updateStatus(lead._id, { status, reason: reason.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead status updated')
      onUpdated(res.data?.data?.lead)
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to update status'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (reason.trim().length < 3) {
      setError('Add a reason — at least 3 characters')
      return
    }
    setError('')
    mut.mutate()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-[#111111] dark:text-white">Change Status</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[220px]">{lead.landlordName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 my-5 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
            <LeadStatusBadge status={lead.status} />
            <ArrowRight className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
            <LeadStatusBadge status={status} />
          </div>

          <div className="space-y-4">
            <Field label="New Status" required>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls(false)}>
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
                ))}
              </select>
            </Field>

            <Field label="Reason" required error={error} hint="Shown to the cold caller and assigned agent, and saved to this lead's history">
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => { setReason(e.target.value); if (error) setError('') }}
                placeholder="e.g. Landlord confirmed the unit was rented out last week"
                rows={3}
                className={`${inputCls(Boolean(error))} resize-none`}
              />
            </Field>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Status
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ─── Lead Row ────────────────────────────────────────────────────────────── */

function LeadRow({ lead, onView, onEdit, onChangeStatus, onDelete }) {
  const contactObj = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const agentUser  = resolveUser(lead.assignedAgent)
  const callerUser = resolveUser(lead.createdBy)

  return (
    <tr className="group hover:bg-[#FAFAF9] dark:hover:bg-[#111111] transition-colors">
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
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBtn icon={Eye}    title="View details"   onClick={onView} />
          <ActionBtn icon={Repeat} title="Change status"  onClick={onChangeStatus} variant="blue" />
          <ActionBtn icon={Pencil} title="Edit lead"      onClick={onEdit} variant="blue" />
          <ActionBtn icon={Trash2} title="Delete"         onClick={onDelete} variant="red" />
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
  const [search,        setSearch]      = useState('')
  const [statusFilter,  setStatus]      = useState('')
  const [callerFilter,  setCallerFilter] = useState('')
  const [sort,          setSort]        = useState('-createdAt')
  const [drawer,        setDrawer]      = useState(null)
  const [toDelete,      setToDelete]    = useState(null)
  const [statusChangeLead, setStatusChangeLead] = useState(null)

  const debouncedSearch = useDebounce(search)

  useEffect(() => { /* reset page if needed */ }, [debouncedSearch, statusFilter, callerFilter, sort])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leads', { search: debouncedSearch, status: statusFilter, createdBy: callerFilter, sort }],
    queryFn: () =>
      leadsApi
        .list({
          search:    debouncedSearch || undefined,
          status:    statusFilter    || undefined,
          createdBy: callerFilter    || undefined,
          sort,
          limit: 100,
        })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const leads = data?.leads ?? data ?? []
  const total = Array.isArray(leads) ? leads.length : 0
  const hasFilters = Boolean(search || statusFilter || callerFilter)

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

      {/* ── Cold Caller Filter Strip ────────────────────────────────────── */}
      <CallerStatsStrip callerFilter={callerFilter} onCallerChange={setCallerFilter} />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3 flex flex-col sm:flex-row gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative flex-1 max-w-sm">
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

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] self-start">
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
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Landlord / Address</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Contact</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Agent</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Status</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Follow-up</th>
                    <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                  {leads.map((lead) => (
                    <LeadRow
                      key={lead._id}
                      lead={lead}
                      onView={() => setDrawer({ mode: 'view', lead })}
                      onEdit={() => setDrawer({ mode: 'edit', lead })}
                      onChangeStatus={() => setStatusChangeLead(lead)}
                      onDelete={() => setToDelete(lead)}
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
      {drawer?.mode === 'edit' && drawer.lead && (
        <EditDrawer lead={drawer.lead} onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} />
      )}
      {drawer?.mode === 'view' && drawer.lead && (
        <ViewPanel
          lead={drawer.lead}
          onClose={() => setDrawer(null)}
          onChangeStatus={() => setStatusChangeLead(drawer.lead)}
        />
      )}

      {/* ── Delete dialog ─────────────────────────────────────────────────── */}
      {toDelete && (
        <DeleteDialog lead={toDelete} onClose={() => setToDelete(null)} onDeleted={() => setToDelete(null)} />
      )}

      {/* ── Status change dialog ────────────────────────────────────────────── */}
      {statusChangeLead && (
        <StatusChangeDialog
          lead={statusChangeLead}
          onClose={() => setStatusChangeLead(null)}
          onUpdated={(updatedLead) => {
            setStatusChangeLead(null)
            if (updatedLead) {
              setDrawer((d) => (d?.lead?._id === updatedLead._id ? { ...d, lead: updatedLead } : d))
            }
          }}
        />
      )}
    </div>
  )
}
