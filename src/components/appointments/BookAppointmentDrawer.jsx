import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarPlus, Loader2, MapPin, BellRing } from 'lucide-react'
import { appointmentsApi } from '../../services/appointmentsApi'
import SidePanel from '../common/SidePanel'
import { Field, inputCls } from '../leads/leadShared'

const ROLE_LABEL = { admin: 'Admin', agency: 'Agency', cold_caller: 'Cold Caller' }

/**
 * Books an Appointment record against a specific lead. Reused from the lead detail views
 * (admin + cold caller) so every appointment is created already linked to its lead.
 */
export default function BookAppointmentDrawer({ lead, onClose, onBooked }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({ agentId: '', scheduledDate: '', scheduledTime: '', notes: '' })

  const { data: assigneesData, isLoading: loadingAssignees } = useQuery({
    queryKey: ['appointment-assignees'],
    queryFn: () => appointmentsApi.assignees().then((r) => r.data.data?.users ?? []),
    staleTime: 60_000,
  })
  const assignees = assigneesData ?? []

  const mut = useMutation({
    mutationFn: (payload) => appointmentsApi.create(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['lead-appointments', lead._id] })
      toast.success('Appointment scheduled')
      onBooked?.(res.data?.data?.appointment)
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to schedule appointment'),
  })

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.agentId) errs.agentId = 'Choose who this appointment is for'
    if (!form.scheduledDate) errs.scheduledDate = 'Date is required'
    if (!form.scheduledTime) errs.scheduledTime = 'Time is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate({
      leadId: lead._id,
      agentId: form.agentId,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={CalendarPlus}
      iconColor="#3B82F6"
      title="Schedule Appointment"
      subtitle={lead.landlordName}
      widthClass="sm:max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="book-appointment-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Schedule
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">{lead.landlordName}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{lead.propertyAddress}</p>
          </div>
        </div>

        <form id="book-appointment-form" onSubmit={handleSubmit} className="space-y-5">
          <Field label="Assign To" required error={errors.agentId}>
            <select
              value={form.agentId}
              onChange={(e) => setField('agentId', e.target.value)}
              disabled={loadingAssignees}
              className={inputCls(errors.agentId)}
            >
              <option value="">{loadingAssignees ? 'Loading…' : '-- Select a person --'}</option>
              {assignees.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.firstName} {a.lastName} — {ROLE_LABEL[a.role] ?? a.role}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required error={errors.scheduledDate}>
              <input type="date" value={form.scheduledDate} onChange={(e) => setField('scheduledDate', e.target.value)} className={inputCls(errors.scheduledDate)} />
            </Field>
            <Field label="Time" required error={errors.scheduledTime}>
              <input type="time" value={form.scheduledTime} onChange={(e) => setField('scheduledTime', e.target.value)} className={inputCls(errors.scheduledTime)} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Special instructions or landlord preferences…"
              rows={3}
              className={`${inputCls(false)} resize-none`}
            />
          </Field>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#3B82F6]/8 border border-[#3B82F6]/20">
            <BellRing className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-[#3B82F6] leading-relaxed">
              Whoever this is assigned to gets an email and in-app reminder 30 minutes before.
            </p>
          </div>
        </form>
      </div>
    </SidePanel>
  )
}
