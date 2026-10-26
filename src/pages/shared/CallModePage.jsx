import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns'
import {
  Phone, PhoneCall, Check, Flag, Loader2, SkipForward, Inbox, Trophy, Sparkles, Keyboard, X, AlarmClock, CalendarClock,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { callLogsApi } from '../../services/callLogsApi'
import { leadsApi } from '../../services/leadsApi'
import { useCallFlow, telHref } from '../../lib/useCallFlow'
import { useCallMode } from '../../lib/useCallMode'
import { useAuthStore } from '../../store/authStore'
import CreateLeadDrawer from '../../components/leads/CreateLeadDrawer'
import { getApiErrorMessage } from '../../components/leads/leadShared'

// Call mode — one owner at a time. The next person to call (callbacks they asked for first),
// a big Call button, then "How did it go?" in one tap. Interested owners become a lead right
// here: when they want to move sets the follow-up date, and the lead's temperature follows
// from that. Up top: this session's calls and leads, today's points and — the point of it —
// how many calls stand between you and #1 today. Keys: C call · 1–7 outcome · Enter save · S skip.
// mode="callbacks" is the same screen for only the owners who asked to be called back: the
// time they asked for, live ("in 12 min" / "40 min overdue"), the list grouped by when, and
// the time can be moved without calling (PATCH /reports/callbacks/:id).

const OUTCOMES = [
  { value: 'interested', label: 'Interested', color: '#10B981' },
  { value: 'callback_requested', label: 'Callback requested', color: '#F59E0B' },
  { value: 'no_answer', label: 'No answer', color: '#9CA3AF' },
  { value: 'voicemail', label: 'Voicemail', color: '#9CA3AF' },
  { value: 'not_interested', label: 'Not interested', color: '#9CA3AF' },
  { value: 'wrong_number', label: 'Wrong number', color: '#9CA3AF' },
  { value: 'remove_me', label: 'Remove me', color: '#F43F5E' },
]
const OUTCOME_TEXT = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label]))

// When the owner wants to move → follow-up date → temperature (Lead.model.js computeStatus)
const MOVE = [
  { key: 'this', label: 'This month', days: 7, temp: 'hot' },
  { key: 'next', label: 'Next month', days: 40, temp: 'warm' },
  { key: 'two', label: 'In 2–3 months', days: 75, temp: 'cold' },
  { key: 'later', label: 'Later than 3 months', days: 120, temp: 'cold' },
]
const TEMP = { hot: ['HOT', '#F43F5E'], warm: ['WARM', '#F59E0B'], cold: ['COLD', '#60A5FA'] }

function callbackChoices() {
  const now = new Date()
  const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x }
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const list = [
    { key: '30m', label: 'In 30 min', at: new Date(now.getTime() + 1800000) },
    { key: '1h', label: 'In 1 hour', at: new Date(now.getTime() + 3600000) },
    { key: '2h', label: 'In 2 hours', at: new Date(now.getTime() + 7200000) },
  ]
  if (now.getHours() < 16) list.push({ key: 'today', label: 'Today 17:00', at: at(now, 17) })
  list.push({ key: 'tm', label: 'Tomorrow 09:00', at: at(tomorrow, 9) }, { key: 'tma', label: 'Tomorrow 14:00', at: at(tomorrow, 14) })
  return list
}

const AVATAR = ['#7F1D1D', '#1E3A8A', '#14532D', '#713F12', '#581C87', '#134E4A']
const tone = (s = '') => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length] }
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const whenText = (d) => (!d ? null : isToday(new Date(d)) ? `today ${format(new Date(d), 'HH:mm')}` : isTomorrow(new Date(d)) ? `tomorrow ${format(new Date(d), 'HH:mm')}` : format(new Date(d), 'EEE d MMM HH:mm'))

// Where a callback sits in time — drives the list groups and the clock on the card
const GROUPS = [
  { key: 'overdue', label: 'Overdue', color: '#F43F5E' },
  { key: 'now', label: 'Due now', color: '#F59E0B' },
  { key: 'none', label: 'No time set', color: '#9CA3AF' },
  { key: 'today', label: 'Later today', color: '#10B981' },
  { key: 'tomorrow', label: 'Tomorrow', color: '#60A5FA' },
  { key: 'later', label: 'Later', color: '#A78BFA' },
]
function cbGroup(c, now = Date.now()) {
  if (!c.callbackAt) return 'none'
  const t = new Date(c.callbackAt).getTime()
  if (t < now - 5 * 60000) return 'overdue'
  if (t <= now + 30 * 60000) return 'now'
  if (isToday(new Date(t))) return 'today'
  if (isTomorrow(new Date(t))) return 'tomorrow'
  return 'later'
}
const byTime = (a, b) => (a.callbackAt ? new Date(a.callbackAt).getTime() : Infinity) - (b.callbackAt ? new Date(b.callbackAt).getTime() : Infinity)
function mins(ms) {
  const m = Math.round(Math.abs(ms) / 60000)
  if (m < 60) return `${m} min`
  if (m < 1440) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
  const d = Math.round(m / 1440)
  return `${d} day${d === 1 ? '' : 's'}`
}

function useNow(every = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t) }, [every])
  return now
}

// Pick a callback time: quick chips + any date/time
function TimeChoices({ value, onPick }) {
  const [custom, setCustom] = useState('')
  return (
    <div className="flex flex-wrap gap-2">
      {callbackChoices().map((x) => (
        <button key={x.key} type="button" onClick={() => { setCustom(''); onPick(x) }}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${value?.key === x.key ? 'bg-[#F59E0B] text-white border-[#F59E0B]' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F59E0B]/60'}`}>
          {x.label}
        </button>
      ))}
      <input type="datetime-local" value={custom} min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
        onChange={(e) => { setCustom(e.target.value); if (e.target.value) onPick({ key: 'custom', label: e.target.value, at: new Date(e.target.value) }) }}
        className={`px-3 py-2.5 rounded-xl text-sm border bg-transparent text-[#111111] dark:text-white ${value?.key === 'custom' ? 'border-[#F59E0B]' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'}`} />
    </div>
  )
}

// The big "when they asked to be called" strip on the card, ticking live
function CallbackClock({ contact, now, onChange }) {
  const g = cbGroup(contact, now)
  const t = contact.callbackAt ? new Date(contact.callbackAt).getTime() : null
  const asked = t ? `They asked for ${isToday(new Date(t)) ? 'today' : isTomorrow(new Date(t)) ? 'tomorrow' : format(new Date(t), 'EEE d MMM')} at` : 'No time set'
  const [color, sub] = {
    overdue: ['#F43F5E', t && `${mins(now - t)} overdue — call them now`],
    now: ['#F59E0B', t && (t > now ? `in ${mins(t - now)} — get ready` : 'right now')],
    today: ['#10B981', t && `in ${mins(t - now)}`],
    tomorrow: ['#60A5FA', t && `in ${mins(t - now)}`],
    later: ['#A78BFA', t && `in ${mins(t - now)}`],
    none: ['#9CA3AF', 'They asked for a callback but no time was saved — call when you can, or set one'],
  }[g]
  return (
    <div className="mac-in mt-5 flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4" style={{ backgroundColor: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33` }}>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${g === 'overdue' || g === 'now' ? 'animate-pulse' : ''}`} style={{ backgroundColor: color }}>
        <AlarmClock className="w-6 h-6 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline flex-wrap gap-x-2 text-lg font-bold text-[#111111] dark:text-white">
          {asked}
          {t && <span key={t} className="mac-pop text-3xl font-bold tabular-nums" style={{ color }}>{format(new Date(t), 'HH:mm')}</span>}
        </p>
        <p className="text-sm font-semibold" style={{ color }}>{sub}</p>
      </div>
      <button type="button" onClick={onChange}
        className="mac-press flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F59E0B]">
        <CalendarClock className="w-4 h-4" /> {t ? 'Change time' : 'Set a time'}
      </button>
    </div>
  )
}

function useSession() {
  const key = `rt-call-session-${new Date().toDateString()}`
  const [s, set] = useState(() => { try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') ?? { calls: 0, leads: 0 } } catch { return { calls: 0, leads: 0 } } })
  const bump = (k) => set((x) => { const n = { ...x, [k]: x[k] + 1 }; try { sessionStorage.setItem(key, JSON.stringify(n)) } catch { /* private */ } return n })
  return [s, bump]
}

/* ─── Top tiles ─────────────────────────────────────────────────────────── */

function Tile({ label, value, sub, color, delay }) {
  return (
    <div className="glass-in rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] px-5 py-4" style={{ '--d': `${delay}ms` }}>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
      <p key={value} className={`mac-pop mt-1 text-3xl font-bold tabular-nums ${color ? '' : 'text-[#111111] dark:text-white'}`} style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A1A1AA]">{sub}</p>
    </div>
  )
}

function RaceBanner({ race }) {
  if (!race?.total) return null
  const lead = race.isFirst
  const nobodyYet = !lead && race.score + race.pointsToFirst === 0 // nobody has scored today
  const pct = lead ? 100 : race.pointsToFirst + race.score > 0 ? Math.round((race.score / (race.score + race.pointsToFirst)) * 100) : 0
  return (
    <div className="glass-in relative overflow-hidden rounded-2xl px-5 py-4 bg-gradient-to-r from-[#F43F5E] to-[#F95C4B] text-white shadow-[0_18px_40px_-20px_rgba(244,63,94,0.9)]" style={{ '--d': '160ms' }}>
      <span aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"><Trophy className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          {lead ? (
            <p className="text-lg font-bold">You&apos;re #1 today among {race.board} — keep dialling to stay there.</p>
          ) : nobodyYet ? (
            <p className="text-lg font-bold">Nobody has scored yet today — your first call puts you #1</p>
          ) : (
            <p className="text-lg font-bold">
              <span key={race.callsToFirst} className="mac-pop inline-block tabular-nums">{race.callsToFirst}</span> call{race.callsToFirst === 1 ? '' : 's'} to become #1 today
              <span className="font-normal text-white/80"> · {race.callsToNext} call{race.callsToNext === 1 ? '' : 's'} to move up a place</span>
            </p>
          )}
          <p className="text-sm text-white/80">
            #{race.rank ?? '—'} of {race.total} {race.board} today{race.leaderName && !nobodyYet ? ` · ${race.leaderName} leads with ${Math.round(race.score + race.pointsToFirst)} pts` : ''} · every call +{race.pointsPerCall}, a hot lead +10
          </p>
        </div>
        <div className="w-full sm:w-56">
          <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%`, transition: 'width 1s var(--ease-mac)' }} />
          </div>
          <p className="mt-1 text-[11px] text-white/80 text-right">{Math.round(race.score)} pts{lead ? '' : ` of ${Math.round(race.score + race.pointsToFirst)}`}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function CallModePage({ mode = 'all' }) {
  const callbacksOnly = mode === 'callbacks'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const base = user?.role === 'agency' ? '/agency' : '/cold-caller'
  const [session, bump] = useSession()
  const goal = (() => { try { return Number(localStorage.getItem('rt-call-goal')) || 60 } catch { return 60 } })()
  const { data, isLoading, refetch } = useCallMode({ mode })
  const now = useNow()
  const [moving, setMoving] = useState(false) // "Change time" panel open
  const [moveTo, setMoveTo] = useState(null)
  const [movingSave, setMovingSave] = useState(false)
  const callFlow = useCallFlow([['call-mode'], ['my-contacts'], ['call-logs'], ['caller-board'], ['my-overview']])
  const [done, setDone] = useState(() => new Set()) // handled this session (removed from the queue)
  const [pickedId, setPickedId] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [move, setMove] = useState('this')
  const [cb, setCb] = useState(null) // { key, at }
  const [cbCustom, setCbCustom] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [leadDrawer, setLeadDrawer] = useState(null)
  const [showKeys, setShowKeys] = useState(false)
  const noteRef = useRef(null)

  const queue = useMemo(() => (data?.queue ?? []).filter((c) => !done.has(c._id)), [data, done])
  // The call in progress wins (e.g. coming back from the phone app), then a picked one, then the next
  const current = useMemo(() => {
    const active = callFlow.activeCall?.contact
    if (active) return queue.find((c) => c._id === active._id) ?? { ...active, kind: 'new', area: null }
    const picked = queue.find((c) => c._id === pickedId)
    if (picked) return picked
    // Callbacks: whoever is overdue / due now, then the ones with no time, then the next booked
    if (callbacksOnly) return queue.find((c) => ['overdue', 'now'].includes(cbGroup(c))) ?? queue.find((c) => !c.callbackAt) ?? queue[0] ?? null
    return queue[0] ?? null
  }, [queue, pickedId, callFlow.activeCall, callbacksOnly])
  const onCall = Boolean(callFlow.activeCall && current && callFlow.activeCall.contact._id === current._id)
  const phone = current ? (current.preferredPhone === 'alt' && current.altPhone ? current.altPhone : current.phone) : null

  useEffect(() => { setOutcome(null); setNote(''); setCb(null); setCbCustom(''); setMove('this'); setMoving(false); setMoveTo(null) }, [current?._id])

  // A callback moved to a new time: re-file it in the list straight away (the refetch confirms)
  const refile = (id, at) => {
    qc.setQueryData(['call-mode', user?._id, mode], (d) => d && {
      ...d, queue: d.queue.map((c) => (c._id === id ? { ...c, callbackAt: at } : c)).sort(byTime),
    })
    qc.invalidateQueries({ queryKey: ['call-mode'] })
  }

  async function saveNewTime() {
    if (!current || !moveTo || movingSave) return
    setMovingSave(true)
    try {
      const at = moveTo.at.toISOString()
      await axiosClient.patch(`/reports/callbacks/${current._id}`, { callbackAt: at })
      toast.success(`${current.name} — callback moved to ${whenText(at)}`)
      setMoving(false); setMoveTo(null); setPickedId(null)
      refile(current._id, at)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Couldn\u2019t move the callback'))
    } finally {
      setMovingSave(false)
    }
  }

  const reset = () => { setOutcome(null); setNote(''); setCb(null); setCbCustom('') }
  const next = (id) => { setDone((d) => new Set(d).add(id)); setPickedId(null); reset() }

  function startCall() {
    if (!current) return
    callFlow.startCall(current, phone)
  }

  async function save() {
    if (!current || !outcome || saving) return
    if (outcome === 'callback_requested' && !cb && !cbCustom) { toast.error('When should you call them back?'); return }
    setSaving(true)
    const callbackAt = outcome === 'callback_requested' ? (cbCustom ? new Date(cbCustom) : cb.at).toISOString() : undefined
    try {
      let logId
      if (onCall) logId = await callFlow.saveOutcome({ outcome, notes: note, callbackAt })
      else {
        const r = await callLogsApi.create({ contactId: current._id, outcome, notes: note || undefined, callbackAt })
        logId = r.data?.data?.callLog?._id
      }
      bump('calls')
      if (outcome === 'interested') {
        const m = MOVE.find((x) => x.key === move)
        const followUp = new Date(Date.now() + m.days * 86400000).toISOString().slice(0, 10)
        try {
          await leadsApi.create({ contactId: current._id, landlordName: current.name, followUpDate: followUp, comments: note || undefined, callLogId: logId || undefined })
          bump('leads')
          toast.success(`Lead created · ${TEMP[m.temp][0]} — it goes to a follow-up manager now`, { icon: <Sparkles className="w-4 h-4 text-[#F43F5E]" /> })
        } catch (e) {
          // Most often the contact has no address / area yet — finish it in the full lead form
          toast.message(getApiErrorMessage(e, 'Finish the lead details'))
          setLeadDrawer({ contact: current, logId })
        }
      } else {
        toast.success(outcome === 'callback_requested' ? `Callback set for ${whenText(callbackAt)}` : `Saved · ${OUTCOME_TEXT[outcome]}`)
      }
      if (onCall) callFlow.finish()
      // On the Callbacks screen a new callback time keeps them in the list, re-filed by time
      if (callbacksOnly && outcome === 'callback_requested') { setPickedId(null); reset(); refile(current._id, callbackAt) }
      else { next(current._id); qc.invalidateQueries({ queryKey: ['call-mode'] }) }
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Couldn’t save — check your connection and try again'))
    } finally {
      setSaving(false)
    }
  }

  function skip() {
    if (!current) return
    if (onCall) { callFlow.skip(); bump('calls') } // the dialled call still counts (as no answer)
    next(current._id)
  }

  // Keyboard: C call · 1–7 outcome · Enter save · S skip · ? keys
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('textarea, input, select') || e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() }
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= OUTCOMES.length) { setOutcome(OUTCOMES[n - 1].value); return }
      if (e.key === 'Enter') { e.preventDefault(); save() }
      else if (e.key.toLowerCase() === 's') skip()
      else if (e.key.toLowerCase() === 'c' && phone) document.getElementById('call-now')?.click()
      else if (e.key === '?') setShowKeys((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const s = data?.stats
  const race = data?.race
  const selected = OUTCOMES.find((o) => o.value === outcome)
  const m = MOVE.find((x) => x.key === move)
  const pts = data?.leadPoints?.[m.temp] ?? { hot: 10, warm: 2, cold: 1 }[m.temp]

  return (
    <div className="h-full overflow-y-auto thin-scroll bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      <div className="p-4 sm:p-6 xl:p-8 space-y-5">
        {/* Tiles */}
        {callbacksOnly ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Tile label="Overdue" value={data?.counts.overdue ?? '–'} sub="They're waiting — call these first" color="#F43F5E" delay={0} />
            <Tile label="Due now" value={data?.counts.dueSoon ?? '–'} sub={data ? `${data.counts.noTime} of them with no time set` : ' '} color="#F59E0B" delay={50} />
            <Tile label="Later today" value={data?.counts.laterToday ?? '–'} sub={data ? `${data.counts.callbacks} callbacks in all` : ' '} color="#10B981" delay={100} />
            <Tile label="Calls this session" value={session.calls} sub={`${s?.callsToday ?? 0} today · ${session.leads} lead${session.leads === 1 ? '' : 's'} this session`} delay={150} />
          </div>
        ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Tile label="Calls this session" value={session.calls} sub={`Goal today: ${goal} · ${s?.callsToday ?? 0} so far`} delay={0} />
          <Tile label="Leads this session" value={session.leads} sub={s ? `Month: ${s.leadsMonth} of ${s.leadTarget}` : ' '} color="#F43F5E" delay={50} />
          <Tile label="Points today" value={race ? Math.round(race.score * 10) / 10 : '–'} sub={race ? (race.isFirst ? 'You’re #1 today' : `${Math.max(0.5, race.pointsToNext)} more to move up a place`) : ' '} color="#F59E0B" delay={100} />
          <Tile label="Calls this week" value={s?.callsWeek ?? '–'} sub={s ? `Your call → lead rate: ${s.leadRate}%` : ' '} delay={150} />
        </div>
        )}

        <RaceBanner race={race} />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
          {/* The person to call */}
          {isLoading ? <div className="shimmer h-[520px] rounded-3xl" /> : !current ? (
            <div className="glass-in rounded-3xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-12 text-center">
              <span className="mx-auto w-14 h-14 rounded-2xl bg-[#10B981]/15 flex items-center justify-center mac-pop"><Inbox className="w-7 h-7 text-[#10B981]" /></span>
              <h2 className="mt-4 text-xl font-bold text-[#111111] dark:text-white">{callbacksOnly ? 'No callbacks waiting' : 'Nobody left to call right now'}</h2>
              <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A1A1AA]">{callbacksOnly ? 'When an owner asks you to call back, they\u2019ll show here at the time they asked for.' : 'You\u2019ve worked through your list. Ask for more contacts, or come back when a callback is due.'}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => refetch()} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white">Check again</button>
                <button type="button" onClick={() => navigate(callbacksOnly ? `${base}/call-mode` : `${base}/contacts`)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F43F5E]">{callbacksOnly ? 'Go to Call mode' : 'Go to my contacts'}</button>
              </div>
            </div>
          ) : (
            <div key={current._id} className="glass-in rounded-3xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-6 sm:p-7">
              {/* Who */}
              <div className="flex flex-wrap items-start gap-5">
                <span className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ backgroundColor: tone(current._id) }}>{initials(current.name)}</span>
                <div className="min-w-0 flex-1">
                  {current.kind === 'callback' ? (
                    <p className="text-xs font-bold uppercase tracking-wider text-[#D97706] dark:text-[#FBBF24]">Callback they asked for{current.callbackAt ? ` · ${whenText(current.callbackAt)}` : ''}</p>
                  ) : (
                    <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{current.callCount ? `Called ${current.callCount} time${current.callCount === 1 ? '' : 's'} before` : 'New contact'}</p>
                  )}
                  <h2 className="mt-1 text-2xl sm:text-[28px] font-bold text-[#111111] dark:text-white uppercase tracking-tight leading-tight">{current.name}</h2>
                  <p className="mt-1 text-[15px] text-[#6B7280] dark:text-[#A1A1AA]">
                    {[current.area, current.unitNumber ? `Unit ${current.unitNumber}` : null, current.sectionalScheme].filter(Boolean).join(' · ') || current.address || 'No address yet'}
                    {current.lastCalledAt && ` · last call ${format(new Date(current.lastCalledAt), 'd MMM HH:mm')}${current.lastCallOutcome ? ` · ${OUTCOME_TEXT[current.lastCallOutcome] ?? current.lastCallOutcome}` : ''}`}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#059669] dark:text-[#34D399]"><Check className="w-4 h-4" /> Not on the Do Not Call list</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto">
                  <a id="call-now" href={phone ? telHref(phone) : undefined} onClick={(e) => { if (!phone) { e.preventDefault(); return } startCall() }}
                    className={`mac-press flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-lg font-bold text-white transition-all ${onCall ? 'bg-[#10B981] shadow-[0_14px_34px_-14px_rgba(16,185,129,0.9)]' : 'bg-[#E11D48] hover:bg-[#BE123C] shadow-[0_14px_34px_-14px_rgba(225,29,72,0.9)]'} ${phone ? '' : 'opacity-50 pointer-events-none'}`}>
                    {onCall ? <><PhoneCall className="w-5 h-5 animate-pulse" /> On the call</> : <><Phone className="w-5 h-5" /> Call now</>}
                  </a>
                  <p className="text-center text-sm font-mono text-[#6B7280] dark:text-[#A1A1AA]">{phone ?? 'No number'}</p>
                  {current.altPhone && current.altPhone !== phone && (
                    <a href={telHref(current.altPhone)} onClick={() => callFlow.startCall(current, current.altPhone)} className="text-center text-xs font-semibold text-[#F43F5E] hover:underline">Or call {current.altPhone}</a>
                  )}
                </div>
              </div>

              {current.kind === 'callback' && <CallbackClock contact={current} now={now} onChange={() => setMoving((v) => !v)} />}
              {moving && (
                <div className="files-collapse mt-3 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
                  <p className="text-[15px] font-bold text-[#111111] dark:text-white">Move the callback to</p>
                  <p className="text-xs text-[#9CA3AF]">No call is logged — use this when the owner sent a new time.</p>
                  <div className="mt-3"><TimeChoices value={moveTo} onPick={setMoveTo} /></div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={saveNewTime} disabled={!moveTo || movingSave}
                      className="mac-press flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#F59E0B] disabled:opacity-40">
                      {movingSave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {moveTo ? `Save · ${whenText(moveTo.at)}` : 'Pick a time'}
                    </button>
                    <button type="button" onClick={() => { setMoving(false); setMoveTo(null) }} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Cancel</button>
                  </div>
                </div>
              )}

              {/* How did it go */}
              <p className="mt-7 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">How did it go?</p>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {OUTCOMES.map((o, i) => {
                  const on = outcome === o.value
                  return (
                    <button key={o.value} type="button" onClick={() => setOutcome(o.value)}
                      className={`relative flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl border text-[15px] font-semibold transition-all duration-200 ${on ? 'scale-[1.02]' : 'hover:-translate-y-0.5'}`}
                      style={on ? { borderColor: o.color, color: o.color, backgroundColor: `${o.color}14`, boxShadow: `0 0 0 3px ${o.color}22` }
                        : { borderColor: 'rgb(156 163 175 / 0.3)' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
                      <span className={on ? '' : 'text-[#111111] dark:text-white'}>{o.label}</span>
                      <kbd className="absolute top-1 right-1.5 text-[9px] text-[#9CA3AF] font-sans">{i + 1}</kbd>
                    </button>
                  )
                })}
              </div>

              {/* Interested → becomes a lead */}
              {outcome === 'interested' && (
                <div className="files-collapse mt-5 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
                  <p className="text-[15px] font-bold text-[#111111] dark:text-white">When does the owner want to move?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MOVE.map((x) => (
                      <button key={x.key} type="button" onClick={() => setMove(x.key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${move === x.key ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#9CA3AF]'}`}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                  <div key={m.temp} className="mac-in mt-4 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: `${TEMP[m.temp][1]}14` }}>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: TEMP[m.temp][1] }}>{TEMP[m.temp][0]} · +{pts}</span>
                    <span className="text-sm text-[#111111] dark:text-white">
                      {m.temp === 'hot' ? 'Goes to a follow-up manager today. You’ll see the moment they open it.'
                        : m.temp === 'warm' ? 'Follow-up booked for next month — it turns Hot on its own as the date gets close.'
                          : 'Follow-up booked later — it warms up on its own as the date gets close.'}
                    </span>
                  </div>
                  <label className="block mt-4 text-sm font-semibold text-[#111111] dark:text-white">Your note for the follow-up manager and agent</label>
                  <textarea ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Tenant leaves end of November. Prefers WhatsApp. Best after 17:00."
                    className="mt-1.5 w-full px-4 py-3 rounded-xl text-sm bg-[#FAFAF9] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F43F5E] resize-none" />
                </div>
              )}

              {/* Callback → when */}
              {outcome === 'callback_requested' && (
                <div className="files-collapse mt-5 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
                  <p className="text-[15px] font-bold text-[#111111] dark:text-white">When should you call back?</p>
                  <div className="mt-3"><TimeChoices value={cb} onPick={(x) => { setCb(x); setCbCustom('') }} /></div>
                  <p className="mt-2 text-xs text-[#9CA3AF]">They&apos;ll be first in your list when it&apos;s time.</p>
                </div>
              )}

              {outcome && outcome !== 'interested' && (
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={outcome === 'remove_me' ? 'Why they asked not to be called (goes to admin for the Do Not Call list)' : 'Note (optional)'}
                  className="files-collapse mt-4 w-full px-4 py-3 rounded-xl text-sm bg-[#FAFAF9] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F43F5E] resize-none" />
              )}

              {/* Save / skip */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={save} disabled={!outcome || saving}
                  className="mac-press flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-bold text-white bg-[#111111] dark:bg-white dark:text-[#111111] disabled:opacity-40 transition-opacity">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selected?.value === 'remove_me' ? <Flag className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  {!outcome ? 'Pick how it went' : outcome === 'interested' ? `Save lead · ${TEMP[m.temp][0]} +${pts}` : outcome === 'callback_requested' ? 'Save callback & next' : 'Save & next'}
                  <kbd className="ml-1 text-[10px] opacity-60 font-sans">Enter</kbd>
                </button>
                <button type="button" onClick={skip} className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl text-sm font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                  <SkipForward className="w-4 h-4" /> Skip <kbd className="text-[10px] opacity-60 font-sans">S</kbd>
                </button>
                <button type="button" onClick={() => setShowKeys((v) => !v)} title="Keyboard shortcuts" className="w-10 h-10 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"><Keyboard className="w-4 h-4" /></button>
              </div>
              {showKeys && (
                <div className="files-collapse mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  {[['C', 'call'], ['1–7', 'how it went'], ['Enter', 'save'], ['S', 'skip'], ['Ctrl+Enter', 'save from a note']].map(([k, l]) => (
                    <span key={k}><kbd className="px-1.5 py-0.5 rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] font-sans">{k}</kbd> {l}</span>
                  ))}
                  <button type="button" onClick={() => setShowKeys(false)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          )}

          {/* Up next */}
          <div className="glass-in rounded-3xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden" style={{ '--d': '120ms' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1EFEC] dark:border-[#232323]">
              <p className="text-lg font-bold text-[#111111] dark:text-white">{callbacksOnly ? 'Callbacks' : 'Up next'}</p>
              <p className="text-sm text-[#9CA3AF]">{data ? (callbacksOnly ? `${data.counts.callbacks} waiting · ${data.counts.dueSoon} due now` : `${data.counts.toCall.toLocaleString()} to call · ${data.counts.assigned.toLocaleString()} assigned`) : ''}</p>
            </div>
            <ul className="thin-scroll max-h-[620px] overflow-y-auto divide-y divide-[#F5F5F4] dark:divide-[#202020]">
              {isLoading && Array.from({ length: 8 }, (_, i) => <li key={i} className="px-5 py-3"><div className="shimmer h-10 rounded-xl" /></li>)}
              {callbacksOnly && GROUPS.map((g) => {
                const rows = queue.filter((c) => cbGroup(c, now) === g.key)
                if (!rows.length) return null
                return [
                  <li key={g.key} className="sticky top-0 z-10 flex items-center gap-2 px-5 py-2 bg-[#FAFAF9]/90 dark:bg-[#141414]/90 backdrop-blur text-[11px] font-bold uppercase tracking-widest" style={{ color: g.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} /> {g.label} <span className="text-[#9CA3AF]">· {rows.length}</span>
                  </li>,
                  ...rows.map((c, i) => {
                    const t = c.callbackAt ? new Date(c.callbackAt).getTime() : null
                    const isCur = c._id === current?._id
                    return (
                      <li key={c._id}>
                        <button type="button" onClick={() => { if (!onCall) setPickedId(c._id) }} disabled={onCall && !isCur}
                          className={`mac-slide-in w-full flex items-center gap-3 px-5 py-3 text-left transition-colors disabled:opacity-60 ${isCur ? 'bg-[#F59E0B]/10' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C]'}`} style={{ '--d': `${Math.min(i, 12) * 25}ms` }}>
                          <span className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: tone(c._id) }}>{initials(c.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold text-[#111111] dark:text-white uppercase tracking-tight truncate">{c.name}</span>
                            <span className="block text-sm text-[#9CA3AF] truncate">{[c.area, c.lastCalledAt ? `asked ${formatDistanceToNowStrict(new Date(c.lastCalledAt), { addSuffix: true })}` : null].filter(Boolean).join(' · ')}</span>
                          </span>
                          {t ? (
                            <span className="text-right flex-shrink-0">
                              <span className="block text-lg font-bold tabular-nums leading-tight" style={{ color: g.color }}>{format(new Date(t), 'HH:mm')}</span>
                              <span className="block text-[11px] text-[#9CA3AF]">{g.key === 'overdue' ? `${mins(now - t)} late` : g.key === 'later' ? format(new Date(t), 'EEE d MMM') : t > now ? `in ${mins(t - now)}` : 'now'}</span>
                            </span>
                          ) : <span className="text-xs font-semibold text-[#9CA3AF] flex-shrink-0">Any time</span>}
                        </button>
                      </li>
                    )
                  }),
                ]
              })}
              {!callbacksOnly && queue.filter((c) => c._id !== current?._id).slice(0, 30).map((c, i) => (
                <li key={c._id}>
                  <button type="button" onClick={() => { if (!onCall) setPickedId(c._id) }} disabled={onCall}
                    className="mac-slide-in w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] disabled:opacity-60 transition-colors" style={{ '--d': `${Math.min(i, 12) * 25}ms` }}>
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: c.kind === 'callback' ? '#92400E' : tone(c._id) }}>{initials(c.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-[#111111] dark:text-white uppercase tracking-tight truncate">{c.name}</span>
                      <span className={`block text-sm truncate ${c.kind === 'callback' ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-[#9CA3AF]'}`}>
                        {c.kind === 'callback' ? `Callback ${c.callbackAt ? whenText(c.callbackAt) : 'requested'}` : c.callCount ? `Called ${formatDistanceToNowStrict(new Date(c.lastCalledAt), { addSuffix: true })}` : 'New contact'}{c.area ? ` · ${c.area}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!isLoading && !callbacksOnly && queue.length <= 1 && <li className="py-10 text-center text-sm text-[#9CA3AF]">That&apos;s everyone for now.</li>}
            </ul>
          </div>
        </div>
      </div>

      {leadDrawer && (
        <CreateLeadDrawer
          contact={leadDrawer.contact}
          callLog={leadDrawer.logId ? { _id: leadDrawer.logId, outcome: 'interested' } : undefined}
          defaultStatus=""
          onClose={() => setLeadDrawer(null)}
          onCreated={() => { setLeadDrawer(null); bump('leads') }}
        />
      )}
    </div>
  )
}
