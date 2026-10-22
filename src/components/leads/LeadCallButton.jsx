import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Phone, PhoneCall, Loader2, X } from 'lucide-react'
import { useCallFlow, telHref } from '../../lib/useCallFlow'
import { CALL_OUTCOME_META } from '../../constants/callOutcomes'

// "Call" on a lead: dials the landlord (a real tel: tap — see useCallFlow for why) and, on
// coming back, asks how it went. The call is logged against the lead's contact AND the
// lead itself, so it shows on the lead's Call Logs for everyone who can see the lead
// (the company manager included), and the manager is told the outcome.

const OUTCOME_ORDER = ['interested', 'callback_requested', 'no_answer', 'voicemail', 'not_interested', 'wrong_number', 'remove_me']

function OutcomeSheet({ call, landlordName, onSubmit, onSkip, onSaved, notifyManager }) {
  const [outcome, setOutcome] = useState(null)
  const [notes, setNotes] = useState('')
  const mut = useMutation({
    mutationFn: () => onSubmit({ outcome, notes: notes.trim() }),
    onSuccess: () => {
      toast.success(notifyManager ? 'Call logged — your manager can see it on the lead' : 'Call logged on this lead')
      onSaved()
    },
    onError: () => toast.error('Could not save the outcome — check your connection and try again'),
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !mut.isPending) onSkip() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip, mut.isPending])

  return createPortal(
    <>
      <div data-lead-dialog className="fixed inset-0 z-[60] bg-black/35 backdrop-blur-[2px] lead-backdrop-in" onClick={!mut.isPending ? onSkip : undefined} />
      <div className="fixed inset-x-0 top-0 z-[61] flex justify-center px-4 pt-[10vh] pointer-events-none">
        <div role="dialog" aria-label="Call outcome" className="files-sheet-in pointer-events-auto w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">
          <div className="flex items-start gap-3 px-5 pt-5 pb-4 bg-gradient-to-b from-[#10B981]/[0.08] to-transparent">
            <span className="w-11 h-11 rounded-2xl bg-[#10B981]/12 flex items-center justify-center flex-shrink-0 mac-pop">
              <PhoneCall className="w-5 h-5 text-[#10B981]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[#111111] dark:text-white truncate">How did the call go?</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{landlordName} · {call.contact.dialedPhone ?? call.contact.phone}</p>
            </div>
            <button type="button" onClick={onSkip} disabled={mut.isPending} title="Skip for now (Esc)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 grid grid-cols-2 gap-2">
            {OUTCOME_ORDER.map((key, i) => {
              const meta = CALL_OUTCOME_META[key]
              const active = outcome === key
              return (
                <button key={key} type="button" onClick={() => setOutcome(key)}
                  className={`mac-in flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all active:scale-[0.97] ${
                    active ? 'shadow-sm' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#D4D4D8] dark:hover:border-[#3A3A3A]'
                  } ${key === 'remove_me' ? 'col-span-2' : ''}`}
                  style={{ '--d': `${i * 25}ms`, ...(active ? { borderColor: meta.color, backgroundColor: `${meta.color}12`, color: meta.color } : {}) }}>
                  <meta.icon className="w-4 h-4 flex-shrink-0" style={{ color: meta.color }} strokeWidth={1.8} />
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="px-5 pt-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes for the lead's call log (optional)…"
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none resize-none" />
          </div>

          <div className="flex gap-2.5 px-5 pt-3 pb-5">
            <button type="button" onClick={onSkip} disabled={mut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
              Skip for now
            </button>
            <button type="button" onClick={() => mut.mutate()} disabled={!outcome || mut.isPending}
              className="mac-press flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 disabled:opacity-50 flex items-center justify-center gap-2">
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save outcome
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

/**
 * `lead` — the lead being worked. `notifyManager` — the caller is a company agent, so the
 * toast can say their manager sees it. `size` — 'sm' for the side panel toolbar.
 */
export default function LeadCallButton({ lead, notifyManager = false, size = 'md' }) {
  const contactObj = (lead.contactId && typeof lead.contactId === 'object') ? lead.contactId : null
  const contactId = contactObj?._id ?? lead.contactId
  const phone = contactObj?.phone ?? lead.phone
  const flow = useCallFlow([['call-history', contactId], ['lead', lead._id], ['agent-leads'], ['call-logs']])

  if (!phone || !contactId) return null
  const contact = { ...(contactObj ?? {}), _id: contactId, name: contactObj?.name ?? lead.landlordName, phone }
  // Only this lead's own call gets its sheet here (a call started from the contacts page
  // finishes there)
  const mine = flow.activeCall && flow.activeCall.leadId === lead._id

  return (
    <>
      <a
        href={telHref(phone)}
        onClick={() => flow.startCall(contact, phone, { leadId: lead._id })}
        title={`Call ${lead.landlordName} — the call is logged on this lead`}
        className={size === 'sm'
          ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] active:scale-[0.97] transition-all'
          : 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] shadow-sm shadow-[#10B981]/30 active:scale-[0.97] transition-all'}
      >
        <Phone className="w-3.5 h-3.5" /> Call
      </a>
      {mine && (
        <OutcomeSheet
          key={flow.activeCall.startedAt}
          call={flow.activeCall}
          landlordName={lead.landlordName}
          notifyManager={notifyManager}
          onSubmit={flow.saveOutcome}
          onSkip={flow.skip}
          onSaved={flow.finish}
        />
      )}
    </>
  )
}
