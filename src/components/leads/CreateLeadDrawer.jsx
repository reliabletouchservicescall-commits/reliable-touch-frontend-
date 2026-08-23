import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, Loader2, PhoneCall, User } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { areasApi } from '../../services/areasApi'
import SidePanel from '../common/SidePanel'
import LeadFormFields from './LeadFormFields'
import { LeadTemperaturePicker } from './leadShared'

const OUTCOME_LABEL = {
  interested: 'Interested',
  callback_requested: 'Callback Requested',
  voicemail: 'Voicemail',
}

/**
 * Side-panel form for a cold caller to turn a contact (and optionally the call
 * that was just logged against it) into a lead. Used both from the post-call
 * outcome flow and from the standalone Leads page.
 */
export default function CreateLeadDrawer({ contact, callLog, defaultStatus = '', onClose, onCreated }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(defaultStatus)
  const [form, setForm] = useState({
    landlordName: contact.name ?? '',
    propertyAddress: '',
    area: (contact.area && typeof contact.area === 'object') ? contact.area._id : (contact.area ?? ''),
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    comments: '',
    availability: '',
    bestCallTime: '',
    followUpDate: '',
    appointmentDate: '',
    appointmentTime: '',
  })

  const { data: areasData } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const areas = areasData?.areas ?? areasData ?? []

  const mut = useMutation({
    mutationFn: (payload) => leadsApi.create(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['my-contacts'] })
      toast.success('Lead created — nice work!')
      onCreated?.(res.data?.data?.lead)
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to create lead'),
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
    const payload = { contactId: contact._id }
    if (callLog?._id) payload.callLogId = callLog._id
    if (status) payload.status = status
    Object.entries(form).forEach(([k, v]) => { payload[k] = v === '' ? null : v })
    mut.mutate(payload)
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={FileText}
      iconColor="#F95C4B"
      title="New Lead"
      subtitle={contact.name}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="create-lead-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Lead
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">
        {/* Source context */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
            <User className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">{contact.name}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">{contact.phone}</p>
          </div>
          {callLog?.outcome && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#10B981]">
              <PhoneCall className="w-3 h-3" />
              {OUTCOME_LABEL[callLog.outcome] ?? callLog.outcome}
            </span>
          )}
        </div>

        <LeadTemperaturePicker value={status} onChange={setStatus} />

        <form id="create-lead-form" onSubmit={handleSubmit}>
          <LeadFormFields form={form} setField={setField} errors={errors} areas={areas} />
        </form>
      </div>
    </SidePanel>
  )
}
