import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isToday, isTomorrow } from 'date-fns'
import {
  CalendarClock, CalendarCheck, CheckCircle2, Ban, UserX, Plus,
  Loader2, AlertTriangle, MapPin, Phone, ChevronRight, User, Calendar, Pencil,
} from 'lucide-react'
import { appointmentsApi } from '../../services/appointmentsApi'
import { leadsApi } from '../../services/leadsApi'
import { useAuthStore } from '../../store/authStore'
import SidePanel from '../../components/common/SidePanel'
import BookAppointmentDrawer from '../../components/appointments/BookAppointmentDrawer'
import { Field, inputCls } from '../../components/leads/leadShared'

/* ─── Constants ──────────────────────────────────────────────────────────── */

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: '#3B82F6', Icon: CalendarClock },
  confirmed: { label: 'Confirmed', color: '#10B981', Icon: CalendarCheck },
  completed: { label: 'Completed', color: '#6B7280', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#EF4444', Icon: Ban },
  no_show:   { label: 'No Show',   color: '#F59E0B', Icon: UserX },
}

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show',   label: 'No Show' },
]

function resolveUser(obj) {
  return obj && typeof obj === 'object' && obj.firstName ? obj : null
}
function resolveLead(obj) {
  return obj && typeof obj === 'object' && obj.landlordName ? obj : null
}

function dayLabel(date) {
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'd MMM yyyy')
}

/* ─── Lead Picker (step 1 of "New Appointment") ─────────────────────────── */

function LeadPickerPanel({ onClose, onPick }) {
  const { data, isLoading } = useQuery({
    queryKey: ['leads-for-appointment'],
    queryFn: () => leadsApi.list({ limit: 100 }).then((r) => r.data.data?.leads ?? []),
    staleTime: 15_000,
  })
  const leads = data ?? []

  return (
    <SidePanel onClose={onClose} icon={Calendar} iconColor="#3B82F6" title="New Appointment" subtitle="Which lead is this for?">
      <div className="px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-10">
            You don't have any leads yet — create one first.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {leads.map((l) => (
              <li key={l._id}>
                <button
                  onClick={() => onPick(l)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/5 text-left transition-all"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{l.propertyAddress}</p>
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

/* ─── Reschedule Panel (lead-owner, not the assignee) ───────────────────── */

function ReschedulePanel({ appt, onClose, onSaved }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    scheduledDate: appt.scheduledDate ? appt.scheduledDate.slice(0, 10) : '',
    scheduledTime: appt.scheduledTime ?? '',
  })
  const lead = resolveLead(appt.leadId)

  const mut = useMutation({
    mutationFn: (payload) => appointmentsApi.update(appt._id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment rescheduled')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to reschedule'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.scheduledDate) errs.scheduledDate = 'Date is required'
    if (!form.scheduledTime) errs.scheduledTime = 'Time is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate(form)
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={Pencil}
      iconColor="#3B82F6"
      title="Reschedule Appointment"
      subtitle={lead?.landlordName}
      widthClass="sm:max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="reschedule-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </>
      }
    >
      <form id="reschedule-form" onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required error={errors.scheduledDate}>
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))} className={inputCls(errors.scheduledDate)} />
          </Field>
          <Field label="Time" required error={errors.scheduledTime}>
            <input type="time" value={form.scheduledTime} onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))} className={inputCls(errors.scheduledTime)} />
          </Field>
        </div>
      </form>
    </SidePanel>
  )
}

/* ─── Appointment Card ───────────────────────────────────────────────────── */

function AppointmentCard({ appt, selfId, onChangeStatus, onReschedule, isChanging }) {
  const lead = resolveLead(appt.leadId)
  const assignee = resolveUser(appt.agentId)
  const meta = STATUS_META[appt.status] ?? STATUS_META.scheduled
  const Icon = meta.Icon
  const isAssignee = assignee?._id === selfId

  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{lead?.landlordName ?? 'Appointment'}</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 truncate">{lead?.propertyAddress}</p>
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
          <Icon className="w-3 h-3" strokeWidth={2} />
          {meta.label}
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-3">
        <span className="flex items-center gap-1 text-xs font-semibold text-[#111111] dark:text-white">
          <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
          {dayLabel(appt.scheduledDate)} · {appt.scheduledTime}
        </span>
        {lead?.phone && (
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
            <Phone className="w-3 h-3 flex-shrink-0" />
            {lead.phone}
          </span>
        )}
        {assignee && (
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
            <User className="w-3 h-3 flex-shrink-0" />
            {isAssignee ? 'You' : `${assignee.firstName} ${assignee.lastName}`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F5F5F4] dark:border-[#202020]">
        {isAssignee && appt.status === 'scheduled' && (
          <button
            disabled={isChanging}
            onClick={() => onChangeStatus(appt._id, 'confirmed')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50"
          >
            {isChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Confirm
          </button>
        )}
        {isAssignee && ['scheduled', 'confirmed'].includes(appt.status) && (
          <>
            <button
              disabled={isChanging}
              onClick={() => onChangeStatus(appt._id, 'completed')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#6B7280]/20 disabled:opacity-50"
            >
              Complete
            </button>
            <button
              disabled={isChanging}
              onClick={() => onChangeStatus(appt._id, 'cancelled')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
        {!isAssignee && ['scheduled', 'confirmed'].includes(appt.status) && (
          <button
            onClick={() => onReschedule(appt)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20"
          >
            <Pencil className="w-3.5 h-3.5" />
            Reschedule
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center mb-4">
        <Calendar className="w-8 h-8 text-[#3B82F6]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No appointments found' : 'No appointments yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try a different status filter.' : 'Appointments booked for you, or for leads you created, will show up here.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function ColdCallerAppointmentsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [picking, setPicking] = useState(false)
  const [bookingLead, setBookingLead] = useState(null)
  const [rescheduling, setRescheduling] = useState(null)
  const [changing, setChanging] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['appointments', { mine: true, status: statusFilter }],
    queryFn: () => appointmentsApi.list({ status: statusFilter || undefined, limit: 100 }).then((r) => r.data.data),
    staleTime: 15_000,
  })
  const appointments = data?.appointments ?? []
  const total = appointments.length

  async function handleStatusChange(id, status) {
    setChanging(id)
    try {
      await appointmentsApi.update(id, { status })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success(`Marked as ${status.replace('_', ' ')}`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update')
    } finally {
      setChanging(null)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
              Appointments
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : `${total} appointment${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setPicking(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md active:scale-[0.98] transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>

        <div className="flex gap-0.5 overflow-x-auto pb-px">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap',
                'border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/5'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.key && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_META[tab.key]?.color }} />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 bg-[#FAFAF9] dark:bg-[#0B0B0B]">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load appointments.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState hasFilters={Boolean(statusFilter)} onAdd={() => setPicking(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {appointments.map((appt) => (
              <AppointmentCard
                key={appt._id}
                appt={appt}
                selfId={user?._id}
                onChangeStatus={handleStatusChange}
                onReschedule={setRescheduling}
                isChanging={changing === appt._id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panels */}
      {picking && (
        <LeadPickerPanel
          onClose={() => setPicking(false)}
          onPick={(lead) => { setBookingLead(lead); setPicking(false) }}
        />
      )}
      {bookingLead && (
        <BookAppointmentDrawer
          lead={bookingLead}
          onClose={() => setBookingLead(null)}
          onBooked={() => setBookingLead(null)}
        />
      )}
      {rescheduling && (
        <ReschedulePanel
          appt={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => setRescheduling(null)}
        />
      )}
    </div>
  )
}
