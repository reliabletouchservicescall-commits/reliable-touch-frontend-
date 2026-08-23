import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarCheck, MapPin, Phone, Clock, Search, ChevronRight,
  User, Home, Tag, CheckCircle2, XCircle, AlertTriangle,
  FileText, DollarSign, CalendarClock, ArrowRight, Loader2,
  Building2, ClipboardList, X,
} from 'lucide-react'
import { format } from 'date-fns'
import { appointmentsApi } from '../../services/appointmentsApi'
import { agentsApi } from '../../services/agentsApi'
import SidePanel from '../../components/common/SidePanel'

/* ─── Constants ─────────────────────────────────────────────────────────── */

const STATUS_META = {
  scheduled: { label: 'Scheduled',  color: '#3B82F6', bg: '#EFF6FF', darkBg: '#1E3A5F' },
  confirmed: { label: 'Confirmed',  color: '#16A34A', bg: '#F0FDF4', darkBg: '#14532D' },
  completed: { label: 'Completed',  color: '#6B7280', bg: '#F9FAFB', darkBg: '#374151' },
  cancelled: { label: 'Cancelled',  color: '#DC2626', bg: '#FEF2F2', darkBg: '#7F1D1D' },
  no_show:   { label: 'No Show',    color: '#F59E0B', bg: '#FFFBEB', darkBg: '#78350F' },
}

const OUTCOME_OPTIONS = [
  { value: 'appointment_completed',    label: 'Appointment Completed — No Deal' },
  { value: 'listing_signed',           label: 'Listing Signed' },
  { value: 'still_negotiating',        label: 'Still Negotiating' },
  { value: 'follow_up_required',       label: 'Follow-Up Required' },
  { value: 'property_still_available', label: 'Property Still Available' },
  { value: 'rented_out',               label: 'Rented Out' },
  { value: 'sold',                     label: 'Sold' },
]

const DISPOSITION_OPTIONS = [
  { value: 'rented_by_me',            label: 'Rented / Sold by My Agency' },
  { value: 'rented_by_another_agent', label: 'Rented by Another Agent' },
  { value: 'rented_by_another_agency',label: 'Rented by Another Agency' },
  { value: 'owner_rented_privately',  label: 'Landlord Rented Privately' },
  { value: 'listing_cancelled',       label: 'Listing Cancelled' },
]

const LEASE_PERIOD_OPTIONS = [
  { value: '6_months',  label: '6 Months' },
  { value: '12_months', label: '12 Months' },
  { value: 'other',     label: 'Other' },
]

const DEAL_STATUS_ACTIONS = {
  scheduled: [
    { status: 'confirmed', label: 'Confirm Appointment', color: '#16A34A' },
    { status: 'cancelled', label: 'Cancel',              color: '#DC2626' },
  ],
  confirmed: [
    { status: 'completed', label: 'Mark Completed',      color: '#6B7280' },
    { status: 'no_show',   label: 'No Show',             color: '#F59E0B' },
    { status: 'cancelled', label: 'Cancel',              color: '#DC2626' },
  ],
  completed: [],
  cancelled: [],
  no_show:   [],
}

const OUTCOMES_NEED_DISPOSITION = ['rented_out', 'sold']
const DISPOSITION_NEEDS_FINANCIALS = ['rented_by_me']

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#6B7280' }
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide"
      style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
    >
      {meta.label}
    </span>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[#111111] dark:text-white break-words">{value}</p>
      </div>
    </div>
  )
}

function inputCls(hasError) {
  return `w-full px-4 py-2.5 text-sm rounded-xl border ${
    hasError
      ? 'border-[#DC2626] focus:ring-[#DC2626]/30'
      : 'border-[#E5E7EB] dark:border-[#2A2A2A] focus:ring-[#F95C4B]/30'
  } bg-white dark:bg-[#181818] text-[#111111] dark:text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 transition-shadow`
}

/* ─── Appointment Card ──────────────────────────────────────────────────── */

function AppointmentCard({ appointment, onClick }) {
  const lead = appointment.leadId
  const meta = STATUS_META[appointment.status] ?? STATUS_META.scheduled

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#F95C4B]/40 hover:shadow-md dark:hover:shadow-black/30 transition-all duration-200 overflow-hidden"
    >
      {/* Top color strip keyed to status */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />

      <div className="p-5">
        {/* Date block + landlord header */}
        <div className="flex items-start gap-4">
          {/* Date pill */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl border"
            style={{ backgroundColor: `${meta.color}10`, borderColor: `${meta.color}25` }}
          >
            <span className="text-lg font-bold leading-none" style={{ color: meta.color }}>
              {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'd') : '--'}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: meta.color }}>
              {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'MMM') : ''}
            </span>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-base font-bold text-[#111111] dark:text-white leading-tight truncate">
                {lead?.landlordName ?? 'Landlord'}
              </p>
              <StatusBadge status={appointment.status} />
            </div>
            <p className="flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#A1A1AA] truncate">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#F95C4B]" strokeWidth={1.75} />
              {lead?.propertyAddress ?? 'Address TBD'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A]" />

        {/* Details row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
          <span className="flex items-center gap-1.5 font-semibold text-[#111111] dark:text-white">
            <Clock className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
            {appointment.scheduledTime ?? '—'}
          </span>
          {lead?.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
              {lead.phone}
            </span>
          )}
          {lead?.area?.name && (
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" strokeWidth={1.75} />
              {lead.area.name}
              {lead.area.region && `, ${lead.area.region}`}
            </span>
          )}
        </div>

        {appointment.notes && (
          <p className="mt-3 text-xs text-[#6B7280] dark:text-[#A1A1AA] italic border-l-2 border-[#F95C4B]/30 pl-3 line-clamp-2">
            {appointment.notes}
          </p>
        )}

        {/* Footer CTA */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'EEEE, d MMMM yyyy') : '—'}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] group-hover:gap-2 transition-all">
            View details <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </button>
  )
}

/* ─── Detail Side Panel ─────────────────────────────────────────────────── */

function DetailPanel({ appointment, onClose, onStatusUpdate, onRecordOutcome, isUpdating }) {
  const lead = appointment.leadId
  const actions = DEAL_STATUS_ACTIONS[appointment.status] ?? []

  return (
    <SidePanel
      onClose={onClose}
      icon={CalendarCheck}
      iconColor="#F95C4B"
      title="Appointment Details"
      subtitle={lead?.landlordName ?? 'Appointment'}
      widthClass="sm:max-w-lg"
      footer={
        <div className="flex flex-col gap-2 w-full">
          {/* Status action buttons */}
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => onStatusUpdate(appointment._id, action.status)}
              disabled={isUpdating}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 border"
              style={{
                color: action.color,
                borderColor: `${action.color}30`,
                backgroundColor: `${action.color}10`,
              }}
            >
              {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
              {action.label}
            </button>
          ))}

          {/* Record outcome (completed only) */}
          {appointment.status === 'completed' && (
            <button
              onClick={onRecordOutcome}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Record Deal Outcome
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] border border-[#E5E7EB] dark:border-[#2A2A2A] transition-colors"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="px-5 py-5 space-y-6">
        {/* Status banner */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            backgroundColor: `${STATUS_META[appointment.status]?.color ?? '#6B7280'}10`,
            borderColor: `${STATUS_META[appointment.status]?.color ?? '#6B7280'}25`,
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_META[appointment.status]?.color ?? '#6B7280' }}
          />
          <div>
            <p className="text-xs font-bold" style={{ color: STATUS_META[appointment.status]?.color }}>
              {STATUS_META[appointment.status]?.label ?? appointment.status}
            </p>
            {appointment.confirmedAt && (
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                Confirmed {format(new Date(appointment.confirmedAt), 'd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">
            Schedule
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 text-center">
              <CalendarClock className="w-5 h-5 text-[#F95C4B] mx-auto mb-2" strokeWidth={1.75} />
              <p className="text-base font-bold text-[#111111] dark:text-white">
                {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'd MMM') : '—'}
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'yyyy') : ''}
              </p>
            </div>
            <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 text-[#F95C4B] mx-auto mb-2" strokeWidth={1.75} />
              <p className="text-base font-bold text-[#111111] dark:text-white">
                {appointment.scheduledTime ?? '—'}
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'EEEE') : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Lead / Property info */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">
            Property & Landlord
          </p>
          <div className="space-y-3">
            <InfoRow icon={User}     label="Landlord"         value={lead?.landlordName} />
            <InfoRow icon={Home}     label="Property Address" value={lead?.propertyAddress} />
            <InfoRow icon={Phone}    label="Phone"            value={lead?.phone} />
            <InfoRow icon={MapPin}   label="Area"
              value={lead?.area
                ? `${lead.area.name}${lead.area.region ? `, ${lead.area.region}` : ''}`
                : lead?.area
              }
            />
            <InfoRow icon={Tag}      label="Lead Status"
              value={lead?.status ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1) : undefined}
            />
          </div>
        </div>

        {/* Appointment notes */}
        {appointment.notes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2">
              Notes
            </p>
            <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 border-l-3 border-[#F95C4B]">
              <p className="text-sm text-[#111111] dark:text-white leading-relaxed">{appointment.notes}</p>
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

/* ─── Record Outcome Panel ──────────────────────────────────────────────── */

function RecordOutcomePanel({ appointment, onClose, onSuccess }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    outcome: '',
    disposition: '',
    leasePeriod: '',
    rentalAmount: '',
    commissionAmount: '',
    expectedRenewalDate: '',
    paymentDueDate: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})

  const needsDisposition = OUTCOMES_NEED_DISPOSITION.includes(form.outcome)
  const needsFinancials  = DISPOSITION_NEEDS_FINANCIALS.includes(form.disposition)

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const e = {}
    if (!form.outcome) e.outcome = 'Select a visit outcome'
    if (needsDisposition && !form.disposition) e.disposition = 'Select a disposition'
    if (needsFinancials) {
      if (!form.rentalAmount) e.rentalAmount = 'Enter the deal amount'
      if (!form.commissionAmount) e.commissionAmount = 'Enter the commission amount'
      if (!form.leasePeriod) e.leasePeriod = 'Select lease period'
      if (!form.expectedRenewalDate) e.expectedRenewalDate = 'Enter expected renewal date'
      if (!form.paymentDueDate) e.paymentDueDate = 'Enter payment due date'
    }
    return e
  }

  const mut = useMutation({
    mutationFn: (payload) => agentsApi.createVisit(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-appointments'] })
      toast.success('Deal outcome recorded successfully')
      onSuccess()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to record outcome'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const payload = {
      leadId:        appointment.leadId?._id ?? appointment.leadId,
      appointmentId: appointment._id,
      outcome:       form.outcome,
      notes:         form.notes.trim() || null,
    }
    if (needsDisposition) payload.disposition = form.disposition
    if (needsFinancials) {
      payload.leasePeriod          = form.leasePeriod
      payload.rentalAmount         = parseFloat(form.rentalAmount)
      payload.commissionAmount     = parseFloat(form.commissionAmount)
      payload.expectedRenewalDate  = form.expectedRenewalDate
      payload.paymentDueDate       = form.paymentDueDate
    }

    mut.mutate(payload)
  }

  const lead = appointment.leadId

  return (
    <SidePanel
      onClose={onClose}
      icon={ClipboardList}
      iconColor="#F95C4B"
      title="Record Deal Outcome"
      subtitle={lead?.landlordName ?? 'Appointment'}
      widthClass="sm:max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="outcome-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Outcome
          </button>
        </>
      }
    >
      <form id="outcome-form" onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        {/* Property context */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4.5 h-4.5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{lead?.landlordName}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{lead?.propertyAddress}</p>
          </div>
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-xs font-bold text-[#111111] dark:text-white uppercase tracking-wide mb-1.5">
            How did the visit go? <span className="text-[#DC2626]">*</span>
          </label>
          <select value={form.outcome} onChange={(e) => set('outcome', e.target.value)} className={inputCls(errors.outcome)}>
            <option value="">Select an outcome…</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errors.outcome && <p className="mt-1 text-xs text-[#DC2626]">{errors.outcome}</p>}
        </div>

        {/* Disposition */}
        {needsDisposition && (
          <div>
            <label className="block text-xs font-bold text-[#111111] dark:text-white uppercase tracking-wide mb-1.5">
              Who closed the deal? <span className="text-[#DC2626]">*</span>
            </label>
            <select value={form.disposition} onChange={(e) => set('disposition', e.target.value)} className={inputCls(errors.disposition)}>
              <option value="">Select disposition…</option>
              {DISPOSITION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            {errors.disposition && <p className="mt-1 text-xs text-[#DC2626]">{errors.disposition}</p>}
          </div>
        )}

        {/* Financial details (if agency closed the deal) */}
        {needsFinancials && (
          <div className="space-y-4 p-4 rounded-xl bg-[#F95C4B]/5 border border-[#F95C4B]/20">
            <p className="text-xs font-bold text-[#F95C4B] uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Deal Financials
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1">
                  Deal Amount (R) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="number" min="0" placeholder="e.g. 15000"
                  value={form.rentalAmount} onChange={(e) => set('rentalAmount', e.target.value)}
                  className={inputCls(errors.rentalAmount)}
                />
                {errors.rentalAmount && <p className="mt-1 text-[10px] text-[#DC2626]">{errors.rentalAmount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1">
                  Commission (R) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="number" min="0" placeholder="e.g. 1500"
                  value={form.commissionAmount} onChange={(e) => set('commissionAmount', e.target.value)}
                  className={inputCls(errors.commissionAmount)}
                />
                {errors.commissionAmount && <p className="mt-1 text-[10px] text-[#DC2626]">{errors.commissionAmount}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1">
                Lease Period <span className="text-[#DC2626]">*</span>
              </label>
              <select value={form.leasePeriod} onChange={(e) => set('leasePeriod', e.target.value)} className={inputCls(errors.leasePeriod)}>
                <option value="">Select…</option>
                {LEASE_PERIOD_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              {errors.leasePeriod && <p className="mt-1 text-[10px] text-[#DC2626]">{errors.leasePeriod}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1">
                  Expected Renewal <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="date"
                  value={form.expectedRenewalDate} onChange={(e) => set('expectedRenewalDate', e.target.value)}
                  className={inputCls(errors.expectedRenewalDate)}
                />
                {errors.expectedRenewalDate && <p className="mt-1 text-[10px] text-[#DC2626]">{errors.expectedRenewalDate}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1">
                  Payment Due <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="date"
                  value={form.paymentDueDate} onChange={(e) => set('paymentDueDate', e.target.value)}
                  className={inputCls(errors.paymentDueDate)}
                />
                {errors.paymentDueDate && <p className="mt-1 text-[10px] text-[#DC2626]">{errors.paymentDueDate}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-[#111111] dark:text-white uppercase tracking-wide mb-1.5">
            Visit Notes
          </label>
          <textarea
            value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Describe what happened during the visit, landlord feedback, follow-up actions…"
            rows={4}
            className={`${inputCls(false)} resize-none`}
          />
        </div>
      </form>
    </SidePanel>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function AgencyAppointmentsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected]   = useState(null)
  const [showOutcome, setShowOutcome] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['agency-appointments', statusFilter],
    queryFn: () =>
      appointmentsApi
        .list({ limit: 100, ...(statusFilter ? { status: statusFilter } : {}) })
        .then((r) => r.data?.data?.appointments ?? []),
    staleTime: 30_000,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }) => appointmentsApi.update(id, { status }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['agency-appointments'] })
      // Update the selected appointment in place so panel reflects new status
      setSelected((prev) =>
        prev?._id === vars.id ? { ...prev, status: vars.status } : prev
      )
      toast.success('Appointment updated')
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Update failed'),
  })

  const filtered = (data ?? []).filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.leadId?.landlordName?.toLowerCase().includes(q) ||
      a.leadId?.propertyAddress?.toLowerCase().includes(q) ||
      a.leadId?.phone?.toLowerCase().includes(q)
    )
  })

  // Group by status for summary chips
  const counts = (data ?? []).reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  function closePanel() {
    setSelected(null)
    setShowOutcome(false)
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-7">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
              Appointments
            </h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              Property viewings assigned to your agency
            </p>
          </div>

          {/* Summary chips */}
          {!isLoading && data?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) =>
                counts[key] ? (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={{
                      color: meta.color,
                      borderColor: statusFilter === key ? meta.color : `${meta.color}30`,
                      backgroundColor: statusFilter === key ? `${meta.color}15` : 'transparent',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {counts[key]}
                    </span>
                    {meta.label}
                  </button>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search landlord, address or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#111111] dark:text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F95C4B]/30 transition-shadow"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 text-sm rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#111111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F95C4B]/30 min-w-[160px]"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
            {statusFilter && ` · ${STATUS_META[statusFilter]?.label ?? statusFilter}`}
          </p>
        )}

        {/* Appointments grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#F95C4B]/8 border border-[#F95C4B]/15 flex items-center justify-center">
              <CalendarCheck className="w-8 h-8 text-[#F95C4B]/60" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-[#111111] dark:text-white">No appointments found</p>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-1">
                {statusFilter || search
                  ? 'Try adjusting your search or filter'
                  : 'Appointments assigned to your agency will appear here'}
              </p>
            </div>
            {(statusFilter || search) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('') }}
                className="text-xs font-semibold text-[#F95C4B] hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((a) => (
              <AppointmentCard
                key={a._id}
                appointment={a}
                onClick={() => { setSelected(a); setShowOutcome(false) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {selected && !showOutcome && (
        <DetailPanel
          appointment={selected}
          onClose={closePanel}
          onStatusUpdate={(id, status) => updateMut.mutate({ id, status })}
          onRecordOutcome={() => setShowOutcome(true)}
          isUpdating={updateMut.isPending}
        />
      )}

      {/* Record outcome side panel */}
      {selected && showOutcome && (
        <RecordOutcomePanel
          appointment={selected}
          onClose={closePanel}
          onSuccess={closePanel}
        />
      )}
    </div>
  )
}
