import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addDays, addHours, format, isToday, nextMonday, startOfHour } from 'date-fns'
import { BellRing, Check, Loader2, Trash2, X } from 'lucide-react'
import SidePanel from '../common/SidePanel'
import { DateField, TimeField } from '../common/DateTimeFields'
import { inputCls, getApiErrorMessage } from '../leads/leadShared'
import { remindersApi } from '../../services/remindersApi'

// A reminder to yourself: what, when (a time or all day) and, if it helps, a number to call
// or the lead it's about. It shows in the Diary and the bell rings when it's due. Opened
// with `reminder` it edits that one (and can mark it done or delete it).

const WHAT = ['Call the tenant', 'Call the landlord', 'Send the documents', 'Check the payment', 'Follow up on the lease']
const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x }
const WHEN = [
  ['In about an hour', () => startOfHour(addHours(new Date(), 2))],
  ['Tomorrow 9:00', () => at(addDays(new Date(), 1), 9)],
  ['Monday 9:00', () => at(nextMonday(new Date()), 9)],
]

export default function ReminderDialog({ reminder, lead, date: day, onClose }) {
  const qc = useQueryClient()
  const start = reminder ? new Date(reminder.rawAt ?? reminder.due ?? reminder.at) : null
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [date, setDate] = useState(format(start ?? day ?? new Date(), 'yyyy-MM-dd'))
  // A new one: 09:00 on another day; today, the next whole hour
  const [time, setTime] = useState(start && !reminder.allDay ? format(start, 'HH:mm') : reminder ? '' : !day || isToday(day) ? format(startOfHour(addHours(new Date(), 1)), 'HH:mm') : '09:00')
  const [allDay, setAllDay] = useState(Boolean(reminder?.allDay))
  const [phone, setPhone] = useState(reminder?.phone ?? lead?.phone ?? lead?.contactId?.phone ?? '')
  const [note, setNote] = useState(reminder?.note ?? '')
  const [about, setAbout] = useState(reminder?.leadId ? { _id: reminder.leadId, landlordName: reminder.who } : lead ?? null)

  const when = () => (allDay ? at(`${date}T00:00`, 0) : new Date(`${date}T${time}`))
  const ready = title.trim().length >= 2 && date && (allDay || time)
  const refresh = () => ['agent-diary', 'agent-home'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), at: when().toISOString(), allDay, phone: phone.trim() || null, note: note.trim() || null, leadId: about?._id ?? null }
      return reminder ? remindersApi.update(reminder.reminderId, body) : remindersApi.create(body)
    },
    onSuccess: () => { refresh(); toast.success(reminder ? 'Reminder saved' : `Reminder set for ${format(when(), allDay ? 'EEE d MMM' : 'EEE d MMM, HH:mm')}`); onClose() },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save the reminder')),
  })
  const finish = useMutation({
    mutationFn: (kind) => (kind === 'done' ? remindersApi.update(reminder.reminderId, { done: true }) : remindersApi.remove(reminder.reminderId)),
    onSuccess: (_, kind) => { refresh(); toast.success(kind === 'done' ? 'Done — nice' : 'Reminder deleted'); onClose() },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not change the reminder')),
  })

  const chip = (on) => `rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'bg-[#F95C4B] text-white' : 'bg-white text-[#111111] ring-1 ring-[#E5E7EB] hover:ring-[#F95C4B]/50 dark:bg-[#202020] dark:text-white dark:ring-[#2A2A2A]'}`
  const label = 'mb-2 block text-xs font-semibold text-[#111111] dark:text-white'
  const pickWhen = (d) => { setAllDay(false); setDate(format(d, 'yyyy-MM-dd')); setTime(format(d, 'HH:mm')) }

  return (
    <SidePanel onClose={onClose} icon={BellRing} title={reminder ? 'Your reminder' : 'Remind me'} subtitle="It shows in your Diary and the bell rings when it’s time"
      footer={(
        <div className="w-full space-y-2">
          <button type="button" onClick={() => save.mutate()} disabled={!ready || save.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-3 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} {reminder ? 'Save' : 'Set reminder'}
          </button>
          {reminder && (
            <div className="flex gap-2">
              <button type="button" onClick={() => finish.mutate('done')} disabled={finish.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#10B981]/40 py-2.5 text-sm font-semibold text-[#059669] hover:bg-[#10B981]/10 dark:text-[#34D399]">
                <Check className="h-4 w-4" /> Mark done
              </button>
              <button type="button" onClick={() => finish.mutate('delete')} disabled={finish.isPending} aria-label="Delete reminder" title="Delete"
                className="grid w-11 place-items-center rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:border-[#EF4444]/50 hover:text-[#EF4444] dark:border-[#2A2A2A]">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}>
      <div className="space-y-5 p-5">
        <div>
          <span className={label}>What should we remind you?</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {WHAT.map((w) => <button key={w} type="button" onClick={() => setTitle(w)} className={chip(title === w)}>{w}</button>)}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} autoFocus={!reminder}
            placeholder="e.g. Call Thabo about the deposit" className={inputCls(false)} />
        </div>

        <div>
          <span className={label}>When?</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {WHEN.map(([l, f]) => <button key={l} type="button" onClick={() => pickWhen(f())} className={chip(false)}>{l}</button>)}
            <button type="button" onClick={() => setAllDay((v) => !v)} className={chip(allDay)}>All day</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DateField value={date} onChange={setDate} className={inputCls(false)} />
            {!allDay && <TimeField value={time} onChange={setTime} className={inputCls(false)} />}
          </div>
          {allDay && <p className="mt-1.5 text-[11px] text-[#9CA3AF]">The bell rings at 08:00 that day.</p>}
        </div>

        <div>
          <span className={label}>Number to call <span className="font-normal text-[#9CA3AF]">· optional</span></span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={40} placeholder="e.g. 082 123 4567" className={inputCls(false)} />
        </div>

        {about && (
          <div className="flex items-center gap-2 rounded-xl bg-[#FAFAF9] px-3 py-2.5 text-sm dark:bg-[#141414]">
            <span className="min-w-0 flex-1 truncate text-[#3F3F46] dark:text-[#D4D4D8]">About <b className="text-[#111111] dark:text-white">{about.landlordName || 'this lead'}</b></span>
            <button type="button" onClick={() => setAbout(null)} aria-label="Not about this lead" className="text-[#9CA3AF] hover:text-[#111111] dark:hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div>
          <span className={label}>Note <span className="font-normal text-[#9CA3AF]">· optional</span></span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Anything you’ll want to know then" className={`${inputCls(false)} resize-none`} />
        </div>
      </div>
    </SidePanel>
  )
}
