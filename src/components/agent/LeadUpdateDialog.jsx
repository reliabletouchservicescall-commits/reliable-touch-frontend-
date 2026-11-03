import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import { Loader2, PencilLine, Check, KeyRound, FileText, ArrowRight, PartyPopper } from 'lucide-react'
import SidePanel from '../common/SidePanel'
import { DateField } from '../common/DateTimeFields'
import { leadsApi } from '../../services/leadsApi'
import { LEAD_STATUS_META, inputCls, getApiErrorMessage } from '../leads/leadShared'
import { QUICK_REPLIES } from '../leads/LeadLive'

// One step for the update agents give most: what happened, when they'll follow up next and
// (only if it moved) the new status. Saving posts the note to the lead's follow-up thread —
// which restarts the 48-hour landlord promise — then the status, then the date. A property
// that just got listed offers its tenant link; one that just rented offers its paperwork.

const FOLLOW = [['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7], ['In 2 weeks', 14]]
const STATUSES = ['still_negotiating', 'listed', 'rented_out', 'sold'] // what an agent may set
const CLOSED = ['rented_out', 'sold']
const day = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd')

export default function LeadUpdateDialog({ leadId, lead: given, onClose, onSaved, onTenantLink, onOpenLead }) {
  const qc = useQueryClient()
  const { data: fetched, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadsApi.getById(leadId).then((r) => r.data.data.lead),
    enabled: !given && Boolean(leadId),
  })
  const lead = given ?? fetched
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [saved, setSaved] = useState(null) // the lead after saving, for the next-step prompt

  const closing = CLOSED.includes(status)
  const needsDate = !closing
  const ready = note.trim().length >= 3 && (!needsDate || date)

  const mut = useMutation({
    mutationFn: async () => {
      const text = note.trim()
      let out = (await leadsApi.addComment(lead._id, text)).data.data.lead
      if (status && status !== lead.status) {
        const payload = { status, reason: text }
        if (status === 'listed' && listingUrl.trim()) payload.listingUrl = listingUrl.trim()
        out = (await leadsApi.updateStatus(lead._id, payload)).data.data.lead ?? out
      }
      if (needsDate && date) out = (await leadsApi.update(lead._id, { followUpDate: date })).data.data.lead ?? out
      return out
    },
    onSuccess: (out) => {
      for (const k of [['agent-home'], ['agent-diary'], ['agent-leads'], ['lead', lead._id], ['lead-activity', lead._id], ['leads-my-counts']]) qc.invalidateQueries({ queryKey: k })
      onSaved?.(out)
      const listedRental = status === 'listed' && lead.listingType === 'rental'
      if (listedRental || closing) { setSaved(out ?? lead); return }
      toast.success(`${lead.landlordName} updated`)
      onClose()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save the update')),
  })

  // After saving: the obvious next step, offered once
  if (saved) {
    const listed = status === 'listed'
    return (
      <SidePanel onClose={onClose} icon={PartyPopper} iconColor="#10B981" title={listed ? 'Listed — nice work' : 'Deal closed — well done'} subtitle={lead.propertyAddress}>
        <div className="space-y-4 p-5">
          <p className="text-sm text-[#3F3F46] dark:text-[#D4D4D8]">
            {listed ? 'Someone interested in renting it? Send them their private application link now — you’ll see when they open it, fill it in and submit.'
              : 'Add the lease and the other deal documents while they’re in front of you.'}
          </p>
          <button type="button" onClick={() => { onClose(); listed ? onTenantLink?.(saved) : onOpenLead?.(saved) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-3 text-sm font-semibold text-white hover:bg-[#E84B3A]">
            {listed ? <><KeyRound className="h-4 w-4" /> Send a tenant link</> : <><FileText className="h-4 w-4" /> Add the deal documents</>} <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:bg-[#202020]">Later</button>
        </div>
      </SidePanel>
    )
  }

  const chip = (on) => `rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'bg-[#F95C4B] text-white' : 'bg-white text-[#111111] ring-1 ring-[#E5E7EB] hover:ring-[#F95C4B]/50 dark:bg-[#202020] dark:text-white dark:ring-[#2A2A2A]'}`
  const label = 'mb-2 block text-xs font-semibold text-[#111111] dark:text-white'

  return (
    <SidePanel onClose={onClose} icon={PencilLine} title={lead ? `Update ${lead.landlordName}` : 'Update'}
      subtitle={lead ? (lead.source !== 'agency_self_sourced' ? 'Keeps the 48-hour promise to the landlord' : lead.propertyAddress) : ' '}
      footer={lead && (
        <button type="button" onClick={() => mut.mutate()} disabled={!ready || mut.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-3 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-50">
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save update
        </button>
      )}>
      {!lead ? (
        <div className="flex justify-center py-16">{isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#F95C4B]" /> : <p className="text-sm text-[#6B7280]">Could not load this lead.</p>}</div>
      ) : (
        <div className="space-y-5 p-5">
          <div>
            <span className={label}>What happened?</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_REPLIES.agency.map((q) => <button key={q} type="button" onClick={() => setNote(q)} className={chip(note === q)}>{q}</button>)}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
              placeholder="e.g. Spoke to the landlord, viewing on Saturday…"
              className={`${inputCls(false)} resize-none`} />
          </div>

          <div>
            <span className={label}>Status <span className="font-normal text-[#9CA3AF]">· now {LEAD_STATUS_META[lead.status]?.label ?? lead.status}</span></span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setStatus('')} className={chip(!status)}>No change</button>
              {STATUSES.filter((s) => s !== lead.status).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={chip(status === s)}>{LEAD_STATUS_META[s]?.label ?? s}</button>
              ))}
            </div>
            {status === 'listed' && (
              <input value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="Listing link (optional) — Property24, Private Property…" className={`${inputCls(false)} mt-2`} />
            )}
          </div>

          {needsDate && (
            <div>
              <span className={label}>Next follow-up</span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {FOLLOW.map(([l, n]) => <button key={l} type="button" onClick={() => setDate(day(n))} className={chip(date === day(n))}>{l}</button>)}
              </div>
              <DateField value={date} onChange={setDate} className={inputCls(false)} />
            </div>
          )}
          {!ready && <p className="text-[11px] text-[#9CA3AF]">{note.trim().length < 3 ? 'Write what happened' : 'Pick when you’ll follow up next'} to save.</p>}
        </div>
      )}
    </SidePanel>
  )
}
