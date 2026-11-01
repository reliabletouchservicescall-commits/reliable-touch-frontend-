import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, PhoneCall, PhoneMissed, Voicemail, Clock, ThumbsDown, AlertCircle, PhoneOff, Sparkles } from 'lucide-react'
import SidePanel from '../common/SidePanel'

// "How did the call go?" — opens the moment a call starts (from the Call link, see
// useCallFlow), so it's waiting when the person comes back from the phone app. Used on
// Contacts and in Call mode. `onSubmit` comes from useCallFlow.saveOutcome.

export const OUTCOMES = [
  { value: 'no_answer',          label: 'No Answer',          icon: PhoneMissed,  color: '#6B7280' },
  { value: 'voicemail',          label: 'Voicemail',          icon: Voicemail,    color: '#6B7280' },
  { value: 'callback_requested', label: 'Callback Requested', icon: Clock,        color: '#F59E0B' },
  { value: 'interested',         label: 'Interested',         icon: CheckCircle2, color: '#10B981', requiresLead: true },
  { value: 'not_interested',     label: 'Not Interested',     icon: ThumbsDown,   color: '#F97316' },
  { value: 'wrong_number',       label: 'Wrong Number',       icon: AlertCircle,  color: '#8B5CF6' },
  { value: 'remove_me',          label: 'Remove Me (DNC)',    icon: PhoneOff,     color: '#EF4444' },
]

// Quick call-back times
function callbackChoices() {
  const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d }
  const inHour = new Date(Date.now() + 60 * 60 * 1000)
  return [
    ['In 1 hour', inHour],
    ['This evening', at(0, 18)],
    ['Tomorrow 9:00', at(1, 9)],
    ['In 3 days', at(3, 10)],
    ['Next week', at(7, 10)],
  ].filter(([, d]) => d > new Date())
}
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

// askCallbackTime: show the "when should you call back?" picker for Callback Requested
// (requireCallbackTime makes it compulsory — Call mode files callbacks by time)
export default function CallOutcomeSheet({ contact, onSubmit, onClose, onSaved, askCallbackTime = true, requireCallbackTime = false }) {
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [cbAt, setCbAt] = useState(null)
  const [cbCustom, setCbCustom] = useState('')
  const selectedMeta = OUTCOMES.find((o) => o.value === selected)
  const isCallback = selected === 'callback_requested'
  const callbackAt = isCallback ? (cbCustom ? new Date(cbCustom) : cbAt) : null

  const mut = useMutation({
    mutationFn: () => onSubmit({ outcome: selected, notes, callbackAt: callbackAt ? callbackAt.toISOString() : undefined }),
    onSuccess: (logId) => {
      toast.success('Call outcome saved')
      onSaved(selectedMeta, logId, { callbackAt: callbackAt ? callbackAt.toISOString() : null, notes })
    },
    onError: () => toast.error('Could not save the outcome — check your connection and tap Save again'),
  })

  const blocked = !selected || (isCallback && requireCallbackTime && !callbackAt)

  return (
    <SidePanel
      onClose={onClose} icon={PhoneCall} iconColor="#10B981" title={contact.name} subtitle={contact.phone}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Skip for now
          </button>
          <button onClick={() => mut.mutate()} disabled={blocked || mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50 flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} {selectedMeta?.requiresLead ? 'Save & Create Lead' : 'Save Outcome'}
          </button>
        </>
      }
    >
      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">What was the call outcome?</p>
        <div className="space-y-2">
          {OUTCOMES.map((o) => {
            const Icon = o.icon
            const active = selected === o.value
            return (
              <button key={o.value} onClick={() => setSelected(o.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  active ? '' : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] bg-white dark:bg-[#202020]'
                }`}
                style={active ? { backgroundColor: `${o.color}10`, borderColor: o.color } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: o.color }} strokeWidth={1.75} />
                <span className="text-sm font-medium text-[#111111] dark:text-white flex-1">{o.label}</span>
                {o.requiresLead && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide"
                    style={active ? { backgroundColor: `${o.color}20`, color: o.color } : { backgroundColor: '#10B98118', color: '#10B981' }}>
                    <Sparkles className="w-2.5 h-2.5" /> Lead
                  </span>
                )}
                {active && !o.requiresLead && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: o.color }} strokeWidth={2} />}
              </button>
            )
          })}
        </div>
        {selectedMeta?.requiresLead && (
          <div className="flex items-start gap-2.5 mt-3 p-3 rounded-xl bg-[#10B981]/8 border border-[#10B981]/20">
            <Sparkles className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-[#10B981] leading-relaxed">You'll be taken straight to a lead form so this doesn't get lost.</p>
          </div>
        )}
        {isCallback && askCallbackTime && (
          <div className="mt-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-3">
            <p className="mb-2 text-xs font-semibold text-[#111111] dark:text-white">When should you call them back?{requireCallbackTime ? '' : <span className="font-normal text-[#9CA3AF]"> (optional)</span>}</p>
            <div className="flex flex-wrap gap-1.5">
              {callbackChoices().map(([label, d]) => {
                const on = !cbCustom && cbAt && Math.abs(cbAt - d) < 60000
                return (
                  <button key={label} type="button" onClick={() => { setCbAt(d); setCbCustom('') }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${on ? 'bg-[#F59E0B] text-white' : 'bg-white text-[#111111] ring-1 ring-[#E5E7EB] hover:ring-[#F59E0B]/60 dark:bg-[#202020] dark:text-white dark:ring-[#2A2A2A]'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
            <input type="datetime-local" value={cbCustom} min={localInput(new Date())} onChange={(e) => setCbCustom(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#F59E0B] dark:border-[#2A2A2A] dark:bg-[#181818] dark:text-white" />
          </div>
        )}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={3}
          className="mt-4 w-full px-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none resize-none" />
      </div>
    </SidePanel>
  )
}
