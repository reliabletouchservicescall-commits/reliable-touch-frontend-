import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNowStrict, isToday } from 'date-fns'
import { Phone, SkipForward, AlarmClock, MapPin, ArrowRight, Inbox, PhoneOutgoing } from 'lucide-react'
import { useCallMode } from '../../lib/useCallMode'
import { useCallFlow, telHref } from '../../lib/useCallFlow'
import CallOutcomeSheet from '../contacts/CallOutcomeSheet'
import CreateLeadDrawer from '../leads/CreateLeadDrawer'

// Call straight from Home: the next owner to phone (a due callback first, then the next new
// contact), one big Call button, and the same "how did it go?" sheet as Call mode — it opens
// with the call, so it's waiting when the phone app closes. Skip moves on to the next one.

const when = (d) => {
  const t = new Date(d)
  return t < new Date() ? `${formatDistanceToNowStrict(t)} overdue` : isToday(t) ? `today at ${format(t, 'HH:mm')}` : format(t, 'EEE d MMM, HH:mm')
}

export default function CallNowCard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const all = useCallMode({ mode: 'all' })
  const cbs = useCallMode({ mode: 'callbacks' })
  const callFlow = useCallFlow([['call-mode'], ['my-contacts'], ['call-logs'], ['caller-board'], ['my-overview']])
  const [skipped, setSkipped] = useState(() => new Set())
  const [leadDrawer, setLeadDrawer] = useState(null)

  // A callback that's due now, late, or has no time yet comes first — they asked for it
  const next = useMemo(() => {
    const due = (cbs.data?.queue ?? []).find((c) => !skipped.has(c._id) && (!c.callbackAt || new Date(c.callbackAt) <= new Date(Date.now() + 15 * 60e3)))
    if (due) return { ...due, kind: 'callback' }
    return (all.data?.queue ?? []).find((c) => !skipped.has(c._id)) ?? null
  }, [all.data, cbs.data, skipped])
  const phone = next ? (next.preferredPhone === 'alt' && next.altPhone ? next.altPhone : next.phone) : null
  const toCall = all.data?.counts?.toCall ?? 0
  const due = cbs.data?.counts?.dueSoon ?? 0
  const loading = all.isLoading

  function saved(meta, logId, { callbackAt } = {}) {
    const contact = callFlow.activeCall?.contact ?? next
    callFlow.finish()
    if (meta?.requiresLead) setLeadDrawer({ contact, logId })
    else toast.success(meta?.value === 'callback_requested' && callbackAt ? `Callback set for ${when(callbackAt)}` : 'Saved — on to the next one')
    if (contact) setSkipped((s) => new Set(s).add(contact._id))
    qc.invalidateQueries({ queryKey: ['call-mode'] })
  }

  return (
    <section className="mac-in relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-5 dark:border-[#2A2A2A] dark:bg-[#181818]">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#10B981]/12 text-[#10B981]"><PhoneOutgoing className="h-4 w-4" /></span>
        <p className="flex-1 text-[15px] font-bold text-[#111111] dark:text-white">Call now</p>
        <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{toCall.toLocaleString()} to call{due ? ` · ${due} callback${due === 1 ? '' : 's'} due` : ''}</span>
      </div>

      {loading ? <div className="shimmer h-[120px] rounded-xl" /> : !next ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#FAFAF9] p-4 dark:bg-[#141414]">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#10B981]/12 text-[#10B981]"><Inbox className="h-5 w-5" /></span>
          <p className="flex-1 text-sm text-[#3F3F46] dark:text-[#D4D4D8]">Nobody left to call right now. Ask for more contacts, or check your callbacks later.</p>
          <button type="button" onClick={() => navigate('/cold-caller/calls?tab=contacts')} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#111111] dark:border-[#2A2A2A] dark:text-white">My contacts</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-[#F95C4B]/10 text-lg font-bold text-[#F95C4B]">
            {next.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {next.kind === 'callback' && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#F59E0B]/12 px-2 py-0.5 text-[11px] font-bold text-[#B45309] dark:text-[#FBBF24]">
                <AlarmClock className="h-3 w-3" /> Asked you to call back · {next.callbackAt ? when(next.callbackAt) : 'no time set'}
              </span>
            )}
            <p className="truncate text-xl font-bold text-[#111111] dark:text-white">{next.name}</p>
            <p className="flex items-center gap-1.5 truncate text-sm text-[#6B7280] dark:text-[#A1A1AA]">
              <MapPin className="h-3.5 w-3.5 flex-none" />
              {[next.area, next.unitNumber ? `Unit ${next.unitNumber}` : null, next.sectionalScheme].filter(Boolean).join(' · ') || next.address || 'No address yet'}
            </p>
            {next.callCount > 0 && <p className="mt-0.5 text-xs text-[#9CA3AF]">Called {next.callCount} time{next.callCount === 1 ? '' : 's'} before</p>}
          </div>
          <div className="flex flex-none gap-2">
            <button type="button" onClick={() => setSkipped((s) => new Set(s).add(next._id))} title="Skip — call someone else"
              className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:bg-[#202020]">
              <SkipForward className="h-4 w-4" /> Skip
            </button>
            {phone ? (
              // A real tel: link — phones only open the dialler from a real tap (see useCallFlow)
              <a href={telHref(phone)} onClick={() => callFlow.startCall(next, phone)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-6 py-3 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9)] hover:bg-[#059669] sm:flex-none">
                <Phone className="h-5 w-5" /> Call
              </a>
            ) : <span className="rounded-xl bg-[#F5F5F4] px-4 py-3 text-sm text-[#9CA3AF] dark:bg-[#202020]">No number</span>}
          </div>
        </div>
      )}

      <button type="button" onClick={() => navigate('/cold-caller/calls')} className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline">
        Open Call mode for a full session <ArrowRight className="h-3.5 w-3.5" />
      </button>

      {/* Opens with the call, so it's waiting when you come back from the phone app */}
      {callFlow.activeCall && (
        <CallOutcomeSheet key={callFlow.activeCall.startedAt} contact={callFlow.activeCall.contact}
          onSubmit={callFlow.saveOutcome} onClose={callFlow.skip} onSaved={saved} requireCallbackTime />
      )}
      {leadDrawer && (
        <CreateLeadDrawer contact={leadDrawer.contact} callLog={leadDrawer.logId ? { _id: leadDrawer.logId, outcome: 'interested' } : undefined} defaultStatus=""
          onClose={() => setLeadDrawer(null)} onCreated={() => { setLeadDrawer(null); toast.success('Lead created — nice work') }} />
      )}
    </section>
  )
}
