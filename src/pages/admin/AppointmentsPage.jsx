import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns'
import {
  Calendar, Plus, Search, X, Pencil, Eye, AlertTriangle, Loader2,
  Clock, CheckCircle2, XCircle, UserX, ChevronLeft, ChevronRight,
  SlidersHorizontal, MapPin, User, Phone, FileText, CalendarCheck,
  CalendarClock, Hourglass, Ban, Users,
} from 'lucide-react'
import { appointmentsApi } from '../../services/appointmentsApi'
import { leadsApi }        from '../../services/leadsApi'
import { DateField, TimeField } from '../../components/common/DateTimeFields'

const ROLE_LABEL = { admin: 'Admin', agency: 'Agency', cold_caller: 'Cold Caller' }

/* ─── Constants ───────────────────────────────────────────────────────────── */

const STATUS_META = {
  scheduled:  { label: 'Scheduled',  color: '#3B82F6', bg: '#3B82F618', Icon: CalendarClock },
  confirmed:  { label: 'Confirmed',  color: '#10B981', bg: '#10B98118', Icon: CalendarCheck },
  completed:  { label: 'Completed',  color: '#6B7280', bg: '#6B728018', Icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  color: '#EF4444', bg: '#EF444418', Icon: Ban },
  no_show:    { label: 'No Show',    color: '#F59E0B', bg: '#F59E0B18', Icon: UserX },
}

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show',   label: 'No Show' },
]

const SORT_OPTIONS = [
  { value: 'scheduledDate',  label: 'Date soonest' },
  { value: '-scheduledDate', label: 'Date latest' },
  { value: '-createdAt',     label: 'Newest created' },
]

const EMPTY_FORM = {
  leadId: '', agentId: '', scheduledDate: '', scheduledTime: '', adminNotes: '', status: '',
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function inputCls(err) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border',
    err ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{hint}</p>}
    </div>
  )
}

function StatusBadge({ status, size = 'sm' }) {
  const meta = STATUS_META[status] ?? STATUS_META.scheduled
  const Icon = meta.Icon
  const pad  = size === 'lg' ? 'px-3.5 py-1.5 text-xs' : 'px-2.5 py-1 text-[10px]'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}>
      <Icon className="w-3 h-3" strokeWidth={2} />
      {meta.label}
    </span>
  )
}

function DateChip({ date }) {
  if (!date) return null
  const d = new Date(date)
  const base = 'text-xs font-semibold'
  if (isToday(d))     return <span className={`${base} text-[#F95C4B]`}>Today</span>
  if (isTomorrow(d))  return <span className={`${base} text-[#F59E0B]`}>Tomorrow</span>
  if (isPast(d))      return <span className={`${base} text-[#6B7280] dark:text-[#A1A1AA]`}>{format(d, 'd MMM yyyy')}</span>
  return <span className={`${base} text-[#111111] dark:text-white`}>{format(d, 'd MMM yyyy')}</span>
}

function resolveUser(obj) {
  return obj && typeof obj === 'object' && obj.firstName ? obj : null
}
function resolveLead(obj) {
  return obj && typeof obj === 'object' && obj.landlordName ? obj : null
}

/* ─── Appointment Form ────────────────────────────────────────────────────── */

function AppointmentForm({ id, initial, onSubmit, isPending, isEdit }) {
  const [form, setForm]     = useState(initial)
  const [errors, setErrors] = useState({})

  const { data: leadsData } = useQuery({
    queryKey: ['leads-select'],
    queryFn: () => leadsApi.list({ limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const { data: assigneesData } = useQuery({
    queryKey: ['appointment-assignees'],
    queryFn: () => appointmentsApi.assignees().then((r) => r.data.data?.users ?? []),
    staleTime: 60_000,
  })

  const leads     = leadsData?.leads ?? []
  const assignees = assigneesData    ?? []

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.leadId)          errs.leadId        = 'Select a lead'
    if (!form.agentId)         errs.agentId        = 'Choose who this is for'
    if (!form.scheduledDate)   errs.scheduledDate  = 'Date is required'
    if (!form.scheduledTime.trim()) errs.scheduledTime = 'Time is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({
      leadId:        form.leadId,
      agentId:       form.agentId,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime.trim(),
      adminNotes:    form.adminNotes.trim() || null,
      ...(isEdit && form.status ? { status: form.status } : {}),
    })
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Lead" required error={errors.leadId}>
        <select value={form.leadId} onChange={(e) => set('leadId', e.target.value)} className={inputCls(errors.leadId)}>
          <option value="">-- Select lead --</option>
          {leads.map((l) => (
            <option key={l._id} value={l._id}>{l.landlordName} — {l.propertyAddress}</option>
          ))}
        </select>
      </Field>

      <Field label="Assign To" required error={errors.agentId} hint="Any admin, agency user, or cold caller — they'll get an email + in-app reminder 30 minutes before">
        <select value={form.agentId} onChange={(e) => set('agentId', e.target.value)} className={inputCls(errors.agentId)}>
          <option value="">-- Select a person --</option>
          {assignees.map((a) => (
            <option key={a._id} value={a._id}>{a.firstName} {a.lastName} — {ROLE_LABEL[a.role] ?? a.role}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date" required error={errors.scheduledDate}>
          <DateField value={form.scheduledDate} onChange={(v) => set('scheduledDate', v)} className={inputCls(errors.scheduledDate)} />
        </Field>
        <Field label="Time" required error={errors.scheduledTime}>
          <TimeField value={form.scheduledTime} onChange={(v) => set('scheduledTime', v)} className={inputCls(errors.scheduledTime)} />
        </Field>
      </div>

      {isEdit && (
        <Field label="Status">
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls(false)}>
            <option value="">-- No change --</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Note for Agency" hint="Visible to whoever this appointment is assigned to">
        <textarea value={form.adminNotes} onChange={(e) => set('adminNotes', e.target.value)}
          placeholder="Special instructions or landlord preferences..." rows={4}
          className={`${inputCls(false)} resize-none`} />
      </Field>

      {isEdit && initial.agencyNotes && (
        <Field label="Note from Agency" hint="Read-only — added by the assignee">
          <p className="text-sm text-[#111111] dark:text-white bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-3.5 leading-relaxed whitespace-pre-wrap">
            {initial.agencyNotes}
          </p>
        </Field>
      )}
    </form>
  )
}

/* ─── Shared Drawer Shell ─────────────────────────────────────────────────── */

function DrawerShell({ title, subtitle, icon, iconBg, formId, submitLabel, submitColor = 'bg-[#F95C4B] hover:bg-[#E84B3A]', isPending, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[500px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h2>
              {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[280px]">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">Cancel</button>
          <button type="submit" form={formId} disabled={isPending} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white ${submitColor} disabled:opacity-60 flex items-center justify-center gap-2`}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Create Drawer ───────────────────────────────────────────────────────── */

function CreateDrawer({ onClose, onSaved }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: (d) => appointmentsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Appointment scheduled'); onSaved() },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to create appointment'),
  })
  return (
    <DrawerShell title="New Appointment" icon={<Calendar className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />} iconBg="bg-[#F95C4B]/10" formId="create-appt" submitLabel="Schedule" isPending={mut.isPending} onClose={onClose}>
      <AppointmentForm id="create-appt" initial={EMPTY_FORM} onSubmit={(p) => mut.mutate(p)} isPending={mut.isPending} isEdit={false} />
    </DrawerShell>
  )
}

/* ─── Edit Drawer ─────────────────────────────────────────────────────────── */

function EditDrawer({ appt, onClose, onSaved }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: (d) => appointmentsApi.update(appt._id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Appointment updated'); onSaved() },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to update appointment'),
  })
  const lead  = resolveLead(appt.leadId)
  const initial = {
    leadId:        lead?._id        ?? appt.leadId  ?? '',
    agentId:       resolveUser(appt.agentId)?._id ?? appt.agentId ?? '',
    scheduledDate: appt.scheduledDate ? appt.scheduledDate.slice(0, 10) : '',
    scheduledTime: appt.scheduledTime ?? '',
    adminNotes:    appt.adminNotes ?? '',
    agencyNotes:   appt.agencyNotes ?? '',
    status:        appt.status ?? '',
  }
  return (
    <DrawerShell title="Edit Appointment" subtitle={lead?.landlordName} icon={<Pencil className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />} iconBg="bg-[#3B82F6]/10" formId="edit-appt" submitLabel="Save Changes" isPending={mut.isPending} onClose={onClose}>
      <AppointmentForm id="edit-appt" initial={initial} onSubmit={(p) => mut.mutate(p)} isPending={mut.isPending} isEdit={true} />
    </DrawerShell>
  )
}

/* ─── View Panel ──────────────────────────────────────────────────────────── */

function ViewPanel({ appt, onClose, onEdit }) {
  const lead  = resolveLead(appt.leadId)
  const agent = resolveUser(appt.agentId)

  function InfoRow({ icon: Icon, label, value }) {
    if (!value) return null
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#181818]">
        <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
          <p className="text-sm text-[#111111] dark:text-white">{value}</p>
        </div>
      </div>
    )
  }

  function Section({ title, children }) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2">{title}</p>
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A] overflow-hidden">{children}</div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">Appointment Details</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3B82F6] bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20">
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Hero */}
          <div className="p-5 rounded-2xl bg-[#FAFAF9] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#F95C4B]" strokeWidth={1.5} />
              </div>
              <StatusBadge status={appt.status} size="lg" />
            </div>
            <p className="text-base font-bold text-[#111111] dark:text-white">{lead?.landlordName ?? 'Appointment'}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{lead?.propertyAddress}</p>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#111111] dark:text-white">
                <Calendar className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
                <DateChip date={appt.scheduledDate} />
              </div>
              <span className="text-[#6B7280]">·</span>
              <div className="flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                <Clock className="w-4 h-4" strokeWidth={1.75} />
                {appt.scheduledTime}
              </div>
            </div>
            {appt.confirmedAt && (
              <p className="text-[10px] text-[#10B981] mt-2">
                Confirmed {formatDistanceToNow(new Date(appt.confirmedAt), { addSuffix: true })}
              </p>
            )}
          </div>

          <Section title="Property">
            <InfoRow icon={MapPin} label="Address"  value={lead?.propertyAddress} />
            <InfoRow icon={Phone}  label="Phone"    value={lead?.phone} />
          </Section>

          <Section title="Assigned To">
            <InfoRow icon={User}  label="Name"  value={agent ? `${agent.firstName} ${agent.lastName}` : null} />
            <InfoRow icon={Users} label="Role"  value={agent ? (ROLE_LABEL[agent.role] ?? agent.role) : null} />
            <InfoRow icon={Phone} label="Phone" value={agent?.phone} />
          </Section>

          {appt.adminNotes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2">Note for Agency</p>
              <p className="text-sm text-[#111111] dark:text-white bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 leading-relaxed whitespace-pre-wrap">{appt.adminNotes}</p>
            </div>
          )}

          {appt.agencyNotes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2">Note from Agency</p>
              <p className="text-sm text-[#111111] dark:text-white bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">{appt.agencyNotes}</p>
            </div>
          )}

          <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] space-y-1 pt-2 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
            <p>Created: {format(new Date(appt.createdAt), 'd MMM yyyy, HH:mm')}</p>
            <p>Updated: {format(new Date(appt.updatedAt), 'd MMM yyyy, HH:mm')}</p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Today strip ─────────────────────────────────────────────────────────── */

function TodayStrip() {
  const { data: todayData } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () => appointmentsApi.today().then((r) => r.data.data?.appointments ?? []),
    staleTime: 60_000,
  })
  const { data: tomData } = useQuery({
    queryKey: ['appointments-tomorrow'],
    queryFn: () => appointmentsApi.tomorrow().then((r) => r.data.data?.appointments ?? []),
    staleTime: 60_000,
  })

  const today    = todayData ?? []
  const tomorrow = tomData   ?? []

  return (
    <div className="px-5 sm:px-8 py-3.5 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
      <div className="flex items-center gap-6 overflow-x-auto">
        {/* Today */}
        <div className="flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F95C4B] mb-1.5">Today</p>
          {today.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">None scheduled</p>
          ) : (
            <div className="flex items-center gap-2">
              {today.map((a) => {
                const lead  = resolveLead(a.leadId)
                const agent = resolveUser(a.agentId)
                return (
                  <div key={a._id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_META[a.status]?.color }} />
                    <span className="text-xs font-semibold text-[#111111] dark:text-white">{a.scheduledTime}</span>
                    <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{lead?.landlordName ?? 'Lead'}</span>
                    {agent && <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">· {agent.firstName}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-[#E5E7EB] dark:bg-[#2A2A2A] flex-shrink-0" />

        {/* Tomorrow */}
        <div className="flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F59E0B] mb-1.5">Tomorrow</p>
          {tomorrow.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">None scheduled</p>
          ) : (
            <div className="flex items-center gap-2">
              {tomorrow.map((a) => {
                const lead  = resolveLead(a.leadId)
                const agent = resolveUser(a.agentId)
                return (
                  <div key={a._id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_META[a.status]?.color }} />
                    <span className="text-xs font-semibold text-[#111111] dark:text-white">{a.scheduledTime}</span>
                    <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{lead?.landlordName ?? 'Lead'}</span>
                    {agent && <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">· {agent.firstName}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, color, icon: Icon, isLoading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        {isLoading ? <div className="h-5 w-8 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mt-0.5" /> : (
          <p className="text-lg font-bold text-[#111111] dark:text-white leading-tight">{value}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Empty State ─────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <Calendar className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No appointments found' : 'No appointments yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try adjusting your filters or search.' : 'Schedule the first property visit appointment.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">
          <Plus className="w-4 h-4" /> Schedule Appointment
        </button>
      )}
    </div>
  )
}

/* ─── Appointment Row ─────────────────────────────────────────────────────── */

function ApptRow({ appt, onView, onEdit, onStatusChange, isChanging }) {
  const lead  = resolveLead(appt.leadId)
  const agent = resolveUser(appt.agentId)
  const d     = new Date(appt.scheduledDate)

  return (
    <tr className="group hover:bg-[#FAFAF9] dark:hover:bg-[#111111] transition-colors">
      <td className="px-4 py-3.5">
        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[180px]">{lead?.landlordName ?? '—'}</p>
        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[180px]">{lead?.propertyAddress}</p>
      </td>
      <td className="px-4 py-3.5">
        {agent ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F95C4B]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-[#F95C4B]">{agent.firstName?.[0]}{agent.lastName?.[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{agent.firstName} {agent.lastName}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{ROLE_LABEL[agent.role] ?? agent.role}</p>
            </div>
          </div>
        ) : <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">Unassigned</span>}
      </td>
      <td className="px-4 py-3.5">
        <DateChip date={appt.scheduledDate} />
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{appt.scheduledTime}</p>
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={appt.status} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="View" onClick={onView} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white transition-all">
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button title="Edit" onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#3B82F6]/10 hover:text-[#3B82F6] transition-all">
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          {appt.status === 'scheduled' && (
            <button
              title="Confirm"
              disabled={isChanging}
              onClick={() => onStatusChange(appt._id, 'confirmed')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50 transition-all"
            >
              {isChanging ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" strokeWidth={2} />}
              Confirm
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function AppointmentsPage() {
  const [statusFilter, setStatus]  = useState('')
  const [search,       setSearch]  = useState('')
  const [agentFilter,  setAgent]   = useState('')
  const [sort,         setSort]    = useState('scheduledDate')
  const [page,         setPage]    = useState(1)
  const [panel,        setPanel]   = useState(null)
  const [changing,     setChanging] = useState(null)

  const debouncedSearch = useDebounce(search)
  const qc = useQueryClient()

  useEffect(() => { setPage(1) }, [statusFilter, debouncedSearch, agentFilter, sort])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['appointments', { page, status: statusFilter, search: debouncedSearch, agentId: agentFilter, sort }],
    queryFn: () =>
      appointmentsApi.list({
        page, limit: 20,
        status:  statusFilter   || undefined,
        agentId: agentFilter    || undefined,
        sort,
      }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const { data: assigneesData } = useQuery({
    queryKey: ['appointment-assignees'],
    queryFn: () => appointmentsApi.assignees().then((r) => r.data.data?.users ?? []),
    staleTime: 60_000,
  })

  const { data: allData } = useQuery({
    queryKey: ['appointments-all'],
    queryFn: () => appointmentsApi.list({ limit: 100 }).then((r) => r.data.data),
    staleTime: 30_000,
  })

  const appointments = data?.appointments ?? []
  const total        = data?.total        ?? 0
  const totalPages   = data?.totalPages   ?? 1
  const assignees    = assigneesData ?? []
  const allAppts     = allData?.appointments ?? []
  const hasFilters   = Boolean(statusFilter || debouncedSearch || agentFilter)

  const stats = {
    total:     allData?.total ?? 0,
    scheduled: allAppts.filter((a) => a.status === 'scheduled').length,
    confirmed: allAppts.filter((a) => a.status === 'confirmed').length,
    completed: allAppts.filter((a) => a.status === 'completed').length,
    cancelled: allAppts.filter((a) => a.status === 'cancelled').length,
    no_show:   allAppts.filter((a) => a.status === 'no_show').length,
  }

  async function handleStatusChange(id, status) {
    setChanging(id)
    try {
      await appointmentsApi.update(id, { status })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success(`Appointment ${status}`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally {
      setChanging(null)
    }
  }

  function pageNums(cur, tot) {
    if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1)
    const pages = [1]
    if (cur > 3) pages.push('...')
    for (let p = Math.max(2, cur - 1); p <= Math.min(tot - 1, cur + 1); p++) pages.push(p)
    if (cur < tot - 2) pages.push('...')
    pages.push(tot)
    return pages
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              Appointments
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading...' : `${total} total`}
            </p>
          </div>
          <button onClick={() => setPanel({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Schedule
          </button>
        </div>
        <div className="flex gap-0.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setStatus(tab.key)}
              className={['flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}>
              {tab.key && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_META[tab.key]?.color }} />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Today/Tomorrow strip */}
      <TodayStrip />

      {/* Stats */}
      <div className="px-5 sm:px-8 py-4 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <StatCard label="Total"     value={stats.total}     color="#F95C4B" icon={Calendar}      isLoading={!allData} />
          <StatCard label="Scheduled" value={stats.scheduled} color="#3B82F6" icon={CalendarClock}  isLoading={!allData} />
          <StatCard label="Confirmed" value={stats.confirmed} color="#10B981" icon={CalendarCheck}  isLoading={!allData} />
          <StatCard label="Completed" value={stats.completed} color="#6B7280" icon={CheckCircle2}   isLoading={!allData} />
          <StatCard label="Cancelled" value={stats.cancelled} color="#EF4444" icon={Ban}            isLoading={!allData} />
          <StatCard label="No Show"   value={stats.no_show}   color="#F59E0B" icon={UserX}          isLoading={!allData} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 sm:px-8 py-3 flex flex-col sm:flex-row gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search landlord or address..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Assignee filter */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] self-start">
          <Users className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
          <select value={agentFilter} onChange={(e) => setAgent(e.target.value)} className="bg-transparent text-[#111111] dark:text-white text-sm outline-none cursor-pointer">
            <option value="">Everyone</option>
            {assignees.map((a) => <option key={a._id} value={a._id}>{a.firstName} {a.lastName} — {ROLE_LABEL[a.role] ?? a.role}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] self-start">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-[#111111] dark:text-white text-sm outline-none cursor-pointer">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Failed to load appointments.
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-28"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
        ) : appointments.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onAdd={() => setPanel({ mode: 'create' })} />
        ) : (
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    {['Lead / Property', 'Assigned To', 'Date & Time', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                  {appointments.map((a) => (
                    <ApptRow
                      key={a._id}
                      appt={a}
                      onView={() => setPanel({ mode: 'view', appt: a })}
                      onEdit={() => setPanel({ mode: 'edit', appt: a })}
                      onStatusChange={handleStatusChange}
                      isChanging={changing === a._id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages} — {total} results</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                  {pageNums(page, totalPages).map((p, i) =>
                    p === '...' ? <span key={`e${i}`} className="w-8 text-center text-xs text-[#6B7280]">…</span> : (
                      <button key={p} onClick={() => setPage(p)} className={['w-8 h-8 rounded-lg text-xs font-semibold', p === page ? 'bg-[#F95C4B] text-white' : 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818]'].join(' ')}>{p}</button>
                    )
                  )}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panels */}
      {panel?.mode === 'create' && <CreateDrawer onClose={() => setPanel(null)} onSaved={() => setPanel(null)} />}
      {panel?.mode === 'edit'   && panel.appt && <EditDrawer appt={panel.appt} onClose={() => setPanel(null)} onSaved={() => setPanel(null)} />}
      {panel?.mode === 'view'   && panel.appt && <ViewPanel appt={panel.appt} onClose={() => setPanel(null)} onEdit={() => setPanel({ mode: 'edit', appt: panel.appt })} />}
    </div>
  )
}
