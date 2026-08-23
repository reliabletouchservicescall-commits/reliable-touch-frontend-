import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Eye, Loader2, User, PhoneCall, History } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { areasApi } from '../../services/areasApi'
import SidePanel from '../common/SidePanel'
import LeadFormFields from './LeadFormFields'
import { LeadStatusBadge } from './leadShared'
import LeadAppointments from '../appointments/LeadAppointments'

const OUTCOME_LABEL = {
  no_answer: 'No Answer', voicemail: 'Voicemail', callback_requested: 'Callback Requested',
  interested: 'Interested', not_interested: 'Not Interested', wrong_number: 'Wrong Number', remove_me: 'Remove Me',
}

function fieldsFromLead(lead) {
  return {
    landlordName: lead.landlordName ?? '',
    propertyAddress: lead.propertyAddress ?? '',
    area: (lead.area && typeof lead.area === 'object') ? lead.area._id : (lead.area ?? ''),
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    comments: lead.comments ?? '',
    availability: lead.availability ?? '',
    bestCallTime: lead.bestCallTime ?? '',
    followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : '',
    appointmentDate: lead.appointmentDate ? lead.appointmentDate.slice(0, 10) : '',
    appointmentTime: lead.appointmentTime ?? '',
  }
}

/** Read/edit side panel for a lead a cold caller created — scoped to the fields they own. */
export default function LeadDetailDrawer({ lead, onClose, onUpdated }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(() => fieldsFromLead(lead))

  const { data: areasData } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const areas = areasData?.areas ?? areasData ?? []

  const assignedAgent = (lead.assignedAgent && typeof lead.assignedAgent === 'object') ? lead.assignedAgent : null
  const sourceCall = (lead.callLogId && typeof lead.callLogId === 'object') ? lead.callLogId : null

  const mut = useMutation({
    mutationFn: (payload) => leadsApi.update(lead._id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead updated')
      onUpdated?.()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to update lead'),
  })

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.landlordName.trim()) errs.landlordName = 'Landlord name is required'
    if (!form.propertyAddress.trim()) errs.propertyAddress = 'Property address is required'
    if (!form.area) errs.area = 'Area is required'
    if (!form.phone.trim()) errs.phone = 'Phone is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    const payload = {}
    Object.entries(form).forEach(([k, v]) => { payload[k] = v === '' ? null : v })
    mut.mutate(payload)
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={Eye}
      iconColor="#3B82F6"
      title={lead.landlordName}
      subtitle={lead.propertyAddress}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Close
          </button>
          <button
            type="submit"
            form="edit-lead-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">
        {/* Status strip */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <LeadStatusBadge status={lead.status} size="lg" />
          <span className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
            Added {format(new Date(lead.createdAt), 'd MMM yyyy')}
          </span>
        </div>

        {/* Assigned agent */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
            <User className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Assigned Agent</p>
            <p className="text-sm text-[#111111] dark:text-white truncate">
              {assignedAgent ? `${assignedAgent.firstName} ${assignedAgent.lastName}` : 'Not yet assigned'}
            </p>
          </div>
        </div>

        <LeadAppointments lead={lead} />

        {/* Source call */}
        {sourceCall && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#10B981]/8 border border-[#10B981]/20">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <PhoneCall className="w-4 h-4 text-[#10B981]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#10B981]">Sourced From Call</p>
              <p className="text-sm text-[#111111] dark:text-white truncate">
                {OUTCOME_LABEL[sourceCall.outcome] ?? sourceCall.outcome}
                {sourceCall.calledAt && ` · ${format(new Date(sourceCall.calledAt), 'd MMM, HH:mm')}`}
              </p>
            </div>
          </div>
        )}

        {/* Status history */}
        {lead.statusHistory?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Status History
            </p>
            <ul className="space-y-2">
              {[...lead.statusHistory].reverse().map((h, i) => {
                const changer = (h.changedBy && typeof h.changedBy === 'object') ? h.changedBy : null
                return (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                    <div className="flex-shrink-0 mt-0.5">
                      <LeadStatusBadge status={h.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {h.reason && <p className="text-sm text-[#111111] dark:text-white leading-relaxed">"{h.reason}"</p>}
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

        <div className="h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />

        <form id="edit-lead-form" onSubmit={handleSubmit}>
          <LeadFormFields form={form} setField={setField} errors={errors} areas={areas} />
        </form>
      </div>
    </SidePanel>
  )
}
