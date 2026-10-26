import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns'
import {
  Check, Eye, Star, Search, X, Heart, Trophy, ExternalLink, Sparkles, Flame,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { getSocket } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'

// My progress (cold caller) — the day / week / month wrapped, where they stand on this month's
// leaderboard and what it takes to move up, milestones, the thanks they've had, how leads earn
// points, and — per lead they found — the journey to a deal with the points at each step, who
// is looking at it right now and everyone who opened or worked on it.
// Data: GET /reports/my-progress?period=… and /reports/my-progress/leads/:id; new activity on
// their leads arrives over the socket (`activity:mine`) and refreshes both.

const PERIODS = [['day', 'Today'], ['week', 'This week'], ['month', 'This month']]
const WRAP = { day: 'Your day, so far', week: 'Your week, wrapped', month: 'Your month, wrapped' }
const WHEN = { day: 'today', week: 'this week', month: 'this month' }
const AVATAR = ['#C4B5FD', '#FCD34D', '#FDA4AF', '#93C5FD', '#6EE7B7', '#F9A8D4']
const tone = (s = '') => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length] }
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const when = (d) => (!d ? '' : isToday(new Date(d)) ? `Today ${format(new Date(d), 'HH:mm')}` : isYesterday(new Date(d)) ? `Yesterday ${format(new Date(d), 'HH:mm')}` : format(new Date(d), 'd MMM HH:mm'))
const dayText = (d) => (!d ? '' : isToday(new Date(d)) ? 'Today' : format(new Date(d), 'd MMM'))
const STATUS_COLOR = { cold: '#60A5FA', warm: '#F59E0B', hot: '#F43F5E', still_negotiating: '#FB923C', listed: '#A78BFA', rented_out: '#10B981', sold: '#10B981', lost: '#9CA3AF' }

const card = 'rounded-3xl border border-[#E5E7EB] dark:border-[#262626] bg-white dark:bg-[#151515]'

function useLive(qc) {
  useEffect(() => {
    const on = () => { qc.invalidateQueries({ queryKey: ['my-progress'] }); qc.invalidateQueries({ queryKey: ['my-progress-lead'] }) }
    let s = getSocket()
    const t = s ? null : setInterval(() => { s = getSocket(); if (s) { clearInterval(t); s.on('activity:mine', on) } }, 500)
    s?.on('activity:mine', on)
    return () => { clearInterval(t); s?.off('activity:mine', on) }
  }, [qc])
}

/* ─── Wrapped ───────────────────────────────────────────────────────────── */

function Wrapped({ data, period, setPeriod, onLead }) {
  const w = data?.wrapped
  const headline = !w ? '' : w.busy > 1 ? `You kept ${w.busy} people busy ${WHEN[period]}.`
    : w.calls ? `You made ${w.calls} call${w.calls === 1 ? '' : 's'} ${WHEN[period]}.`
      : w.moved ? `${w.moved} of your leads moved forward ${WHEN[period]}.` : `A fresh ${period === 'day' ? 'day' : period} — every call counts.`
  const tiles = w ? [
    [w.calls, 'calls made', '#111111', 'dark:text-white', 'bg-[#F5F5F4] dark:bg-[#1E1E1E]'],
    [w.leads, 'new leads created', '#F43F5E', '', 'bg-[#FFF1F2] dark:bg-[#2A1418]'],
    [w.opened, 'times your leads were opened by others', '#3B82F6', '', 'bg-[#EFF6FF] dark:bg-[#121C2B]'],
    [w.moved, 'of your leads moved forward', '#F59E0B', '', 'bg-[#FFFBEB] dark:bg-[#271F0E]'],
    [w.thanks, `thank-you${w.thanks === 1 ? '' : 's'} from the team`, '#10B981', '', 'bg-[#ECFDF5] dark:bg-[#0F2219]'],
  ] : []
  return (
    <section className={`glass-in ${card} p-6 sm:p-8`}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F43F5E]">{WRAP[period]}</p>
          {w ? <h1 key={headline} className="mac-in mt-1.5 text-2xl sm:text-[34px] font-bold tracking-tight text-[#111111] dark:text-white leading-tight">{headline}</h1>
            : <div className="shimmer mt-2 h-9 w-96 max-w-full rounded-xl" />}
        </div>
        <div className="flex p-1 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111]">
          {PERIODS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${period === k ? 'bg-[#F43F5E] text-white shadow-[0_8px_20px_-10px_rgba(244,63,94,0.9)]' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {!w ? Array.from({ length: 5 }, (_, i) => <div key={i} className="shimmer h-[120px] rounded-2xl" />) : tiles.map(([v, label, color, dark, bg], i) => (
          <div key={label} className={`mac-pop rounded-2xl px-5 py-5 ${bg}`} style={{ '--d': `${i * 60}ms` }}>
            <p key={v} className={`mac-pop text-4xl font-bold tabular-nums ${dark}`} style={{ color: dark ? undefined : color }}>{v}</p>
            <p className="mt-2 text-[15px] text-[#4B5563] dark:text-[#D4D4D8] leading-snug">{label}</p>
          </div>
        ))}
      </div>
      {w?.best && (
        <button type="button" onClick={() => onLead(w.best.leadId)}
          className="mac-in mt-4 w-full text-left rounded-2xl px-5 py-4 border border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#0F2219] text-[15px] text-[#111111] dark:text-white hover:border-[#10B981] transition-colors">
          <b>Best moment:</b> {w.best.name.toUpperCase()} {w.best.to === 'still_negotiating' ? 'went into negotiation' : ['warm', 'hot'].includes(w.best.to) ? `turned ${w.best.toText}` : `was ${w.best.toText.toLowerCase()}`}{w.best.by ? ` by ${w.best.by.split(' ')[0]}` : ''} — a lead you found on {format(new Date(w.best.foundAt), 'd MMM')}.
          {w.best.points > 0 && <> That&apos;s <b className="text-[#059669] dark:text-[#34D399]">+{w.best.points} points</b> and {w.best.nextText}.</>}
        </button>
      )}
    </section>
  )
}

/* ─── Rank + numbers ────────────────────────────────────────────────────── */

function NextPlace({ race }) {
  if (!race) return <div className={`shimmer h-[360px] ${card}`} />
  const max = Math.max(...race.around.map((r) => r.score), 1)
  return (
    <section className={`glass-in ${card} p-6`} style={{ '--d': '80ms' }}>
      <p className="text-lg font-bold text-[#111111] dark:text-white">Your next place</p>
      <div className="mt-4 space-y-3">
        {race.around.length === 0 && <p className="text-sm text-[#9CA3AF]">Make a call to get on this month&apos;s board.</p>}
        {race.around.map((r, i) => (
          <div key={r.rank} className={`mac-slide-in flex items-center gap-4 rounded-2xl px-5 py-4 border ${r.me ? 'border-[#F43F5E]/50 bg-[#FFF1F2] dark:bg-[#2A1418]' : 'border-[#E5E7EB] dark:border-[#262626] bg-[#FAFAF9] dark:bg-[#1A1A1A]'}`} style={{ '--d': `${i * 70}ms` }}>
            <span className={`text-lg font-bold tabular-nums w-10 ${r.me ? 'text-[#F43F5E]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>#{r.rank}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#111111] dark:text-white">{r.label}</p>
              <div className="mt-1.5 h-2 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] overflow-hidden">
                <div className="mac-grow-x h-full rounded-full" style={{ width: `${(r.score / max) * 100}%`, backgroundColor: r.me ? '#F43F5E' : '#9CA3AF' }} />
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums text-[#111111] dark:text-white">{r.score}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-[#FAFAF9] dark:bg-[#1A1A1A] px-5 py-4 text-[15px] text-[#4B5563] dark:text-[#D4D4D8]">
        {race.rank === 1 ? 'You lead the month — keep the calls coming to stay there.'
          : race.hotMovesUp ? `One hot lead (+10) moves you up a place.`
            : race.pointsToNext ? `${race.pointsToNext} points to move up a place — about ${race.callsToNext} calls, or one hot lead and ${Math.max(0, Math.ceil((race.pointsToNext - 10) / 0.5))} calls.` : 'Make a call to get on the board.'}
        {race.todayRank ? ` Today you're #${race.todayRank} of ${race.todayTotal} — a fresh start every morning.` : ''}
      </p>
    </section>
  )
}

function Numbers({ data }) {
  const s = data?.stats, r = data?.race
  const tiles = s ? [
    ['Points this month', r?.score ?? 0, r?.rank ? `Rank #${r.rank} of ${r.total}` : 'Not ranked yet', '#F59E0B'],
    ['Leads you created', s.leadsAll, `All time · ${s.leadsMonth} this month`, null],
    ['Still hot', s.hot, 'Being worked by the team', '#F43F5E'],
    ['Deals you started', s.deals, `${s.won} closed from your calls`, '#10B981'],
    ['Call → lead rate', `${s.rate}%`, s.perLead ? `1 lead in every ${s.perLead} calls` : 'This month', null],
    ['Calls logged', s.callsAll, 'Every one counts', null],
  ] : []
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 content-start">
      {!s ? Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer h-[118px] rounded-2xl" />) : tiles.map(([label, v, sub, color], i) => (
        <div key={label} className={`glass-in ${card} !rounded-2xl px-5 py-4`} style={{ '--d': `${100 + i * 40}ms` }}>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${color ? '' : 'text-[#111111] dark:text-white'}`} style={color ? { color } : undefined}>{typeof v === 'number' ? v.toLocaleString() : v}</p>
          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A1A1AA]">{sub}</p>
        </div>
      ))}
    </div>
  )
}

function Milestones({ list }) {
  return (
    <section className={`glass-in ${card} p-6`}>
      <p className="text-lg font-bold text-[#111111] dark:text-white">Milestones</p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {(list ?? []).map((m, i) => {
          const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100))
          return (
            <div key={m.key} className={`mac-pop rounded-2xl px-5 py-4 border ${m.done ? 'border-[#10B981]/50 bg-[#ECFDF5]/60 dark:bg-[#0F2219]' : 'border-[#E5E7EB] dark:border-[#262626] bg-[#FAFAF9] dark:bg-[#1A1A1A]'}`} style={{ '--d': `${i * 50}ms` }}>
              <p className="flex items-center gap-1.5 font-bold text-[#111111] dark:text-white">{m.done && <Check className="w-4 h-4 text-[#10B981]" />}{m.title}</p>
              <div className="mt-3 h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] overflow-hidden">
                <div className="mac-grow-x h-full rounded-full" style={{ width: `${m.done ? 100 : pct}%`, backgroundColor: m.done ? '#10B981' : '#F43F5E' }} />
              </div>
              <p className={`mt-2 text-sm ${m.done ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{m.text}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Leads: journey + who opened ───────────────────────────────────────── */

const STEP_COLOR = { done: '#10B981', current: '#60A5FA' }

function Journey({ id, onClose }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['my-progress-lead', id],
    queryFn: () => axiosClient.get(`/reports/my-progress/leads/${id}`).then((r) => r.data.data),
    refetchInterval: 20_000, // keeps "looking at it now" fresh
    enabled: Boolean(id),
  })
  if (isLoading || !data) return <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4"><div className="shimmer h-[300px] rounded-3xl" /><div className="shimmer h-[300px] rounded-3xl" /></div>
  const { lead, journey, points, watching, timeline, workers, opens } = data
  const won = ['rented_out', 'sold'].includes(lead.status)
  const closeWord = lead.listingType === 'sale' ? 'sells' : 'rents out'
  return (
    <div key={id} className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      <section className={`glass-in ${card} p-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#059669] dark:text-[#34D399]">You found this lead · {format(new Date(lead.createdAt), 'd MMM, HH:mm')}</p>
            <h2 className="mt-1 text-2xl sm:text-[28px] font-bold uppercase tracking-tight text-[#111111] dark:text-white">{lead.name}</h2>
            <p className="mt-1 text-[15px] text-[#6B7280] dark:text-[#A1A1AA]">{[lead.place, lead.listingType === 'sale' ? 'For sale' : lead.listingType ? 'For rental' : null].filter(Boolean).join(' · ')}</p>
          </div>
          {watching.length > 0 ? watching.slice(0, 2).map((w) => (
            <div key={w.id} className="mac-pop flex items-center gap-3 rounded-2xl px-4 py-3 border border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#0F2219]">
              <span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-[#10B981]" /></span>
              <span>
                <span className="block text-sm font-bold text-[#111111] dark:text-white">{w.name.split(' ')[0]} is looking at it now</span>
                <span className="block text-xs text-[#6B7280] dark:text-[#A1A1AA]">{[w.role, w.company, w.since ? `opened ${formatDistanceToNowStrict(new Date(w.since))} ago` : null].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          )) : (
            <span className="flex items-center gap-2 text-xs text-[#9CA3AF]"><Eye className="w-3.5 h-3.5" /> Nobody has it open right now</span>
          )}
        </div>

        {/* Stepper */}
        <ol className="mt-7 grid gap-y-5" style={{ gridTemplateColumns: `repeat(${journey.length}, minmax(0,1fr))` }}>
          {journey.map((s, i) => {
            const c = s.key === 'lost' ? '#9CA3AF' : STEP_COLOR[s.state]
            const nextDone = journey[i + 1]?.state === 'done'
            return (
              <li key={s.key} className="mac-slide-in relative pr-3" style={{ '--d': `${i * 80}ms` }}>
                <div className="flex items-center">
                  <span className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${s.state === 'done' ? 'bg-[#10B981] border-[#10B981] text-white' : s.state === 'current' ? 'border-[#60A5FA] text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#121C2B]' : 'border-[#D4D4D8] dark:border-[#3F3F46]'}`}>
                    {s.state === 'done' ? <Check className="w-4 h-4" /> : s.state === 'current' ? <Eye className="w-4 h-4" /> : null}
                  </span>
                  {i < journey.length - 1 && <span className="flex-1 h-0.5 mx-2 rounded-full" style={{ backgroundColor: nextDone || s.state === 'done' && journey[i + 1]?.state !== 'todo' ? '#10B981' : 'rgb(156 163 175 / 0.3)' }} />}
                </div>
                <p className="mt-3 font-bold" style={{ color: s.state === 'todo' ? '#9CA3AF' : s.state === 'current' ? c : undefined }}>
                  <span className={s.state === 'done' ? 'text-[#111111] dark:text-white' : ''}>{s.label}</span>
                </p>
                <p className="mt-0.5 text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                  {s.state === 'done'
                    ? [s.at ? dayText(s.at) : null, s.detail].filter(Boolean).join(' · ') || 'Done'
                    : s.points != null ? <>{s.state === 'current' ? 'Next step' : s.key === 'closed' ? 'Your deal' : 'Then'} · <b className="text-[#059669] dark:text-[#34D399]">+{s.points} points</b></> : s.detail}
                </p>
              </li>
            )
          })}
        </ol>

        <div className="mt-6 flex items-start gap-3 rounded-2xl px-5 py-4 border border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#0F2219] text-[15px] text-[#111111] dark:text-white">
          <Star className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <p>
            {won ? <>This lead became <b>a deal you started</b> — <b>{points.now} points</b> for you.</>
              : lead.status === 'lost' ? <>This lead was lost — it earned you {points.now} point{points.now === 1 ? '' : 's'}.</>
                : <>If this {closeWord}, it counts as <b>a deal you started</b> and earns you <b className="text-[#059669] dark:text-[#34D399]">+{points.ifClosed - points.now} points</b> ({points.ifClosed} in all).</>}
            {workers > 0 ? ` ${workers} ${workers === 1 ? 'person has' : 'people have'} worked on it since your call.` : ''}
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => navigate(`/cold-caller/leads/${lead.id}`)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F43F5E]">
            Open the lead <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Close</button>
        </div>
      </section>

      <section className={`glass-in ${card} p-5`} style={{ '--d': '80ms' }}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-[#111111] dark:text-white">Who opened your lead</p>
          <span className="text-sm font-semibold text-[#3B82F6]">{opens} time{opens === 1 ? '' : 's'}</span>
        </div>
        <ul className="mt-3 thin-scroll max-h-[460px] overflow-y-auto divide-y divide-[#F1EFEC] dark:divide-[#232323]">
          {watching.map((w) => (
            <li key={`live-${w.id}`} className="mac-in flex gap-3 py-3">
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: tone(w.id) }}>{initials(w.name)}</span>
              <span className="min-w-0"><span className="block text-[15px] text-[#111111] dark:text-white"><b>{w.name}</b> <span className="text-[#10B981]">is viewing it now</span></span>
                <span className="block text-xs text-[#9CA3AF]">{when(new Date())}</span></span>
            </li>
          ))}
          {timeline.length === 0 && watching.length === 0 && <li className="py-8 text-center text-sm text-[#9CA3AF]">Nobody has opened it yet — it&apos;s waiting for a follow-up manager.</li>}
          {timeline.map((t, i) => (
            <li key={t.id} className="mac-slide-in flex gap-3 py-3" style={{ '--d': `${Math.min(i, 10) * 30}ms` }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: t.who.name === 'System' ? '#E5E7EB' : tone(t.who.id ?? t.who.name) }}>{t.who.name === 'System' ? <Sparkles className="w-4 h-4" /> : initials(t.who.name)}</span>
              <span className="min-w-0">
                <span className="block text-[15px] text-[#111111] dark:text-white"><b>{t.who.name}</b> <span className="text-[#6B7280] dark:text-[#A1A1AA]">{t.text}</span></span>
                {t.note && <span className="block mt-0.5 text-sm text-[#6B7280] dark:text-[#A1A1AA] italic line-clamp-2">“{t.note}”</span>}
                <span className="block text-xs text-[#9CA3AF]">{[when(t.at), t.who.role, t.who.company].filter(Boolean).join(' · ')}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function YourLeads({ leads, open, setOpen }) {
  const [q, setQ] = useState('')
  const [show, setShow] = useState('moving')
  const [limit, setLimit] = useState(24)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (leads ?? []).filter((l) => (!s || l.name.toLowerCase().includes(s) || l.place.toLowerCase().includes(s))
      && (show === 'all' || (show === 'deals' ? ['still_negotiating', 'listed', 'rented_out', 'sold'].includes(l.status) : show === 'hot' ? l.status === 'hot' : l.opens > 0 || l.stepIndex > 1)))
  }, [leads, q, show])
  return (
    <section className={`glass-in ${card} p-6`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-[#111111] dark:text-white">Your leads — what&apos;s happening</p>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Pick a lead to see where it is, who has it open and the points it can still earn you.</p>
        </div>
        <div className="flex gap-1.5">
          {[['moving', 'Being worked'], ['deals', 'Deals'], ['hot', 'Hot'], ['all', 'All']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setShow(k); setLimit(24) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${show === k ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-[#111111] dark:border-white' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA]'}`}>{l}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a lead…"
            className="w-56 pl-9 pr-8 py-2 rounded-xl text-sm bg-[#FAFAF9] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#F43F5E]" />
          {q && <button type="button" onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {!leads && Array.from({ length: 8 }, (_, i) => <div key={i} className="shimmer h-[78px] rounded-2xl" />)}
        {list.slice(0, limit).map((l, i) => (
          <button key={l.id} type="button" onClick={() => setOpen(l.id === open ? false : l.id)}
            className={`mac-pop text-left rounded-2xl px-4 py-3 border transition-all ${l.id === open ? 'border-[#F43F5E] bg-[#FFF1F2] dark:bg-[#2A1418]' : 'border-[#E5E7EB] dark:border-[#262626] bg-[#FAFAF9] dark:bg-[#1A1A1A] hover:-translate-y-0.5 hover:border-[#9CA3AF]'}`} style={{ '--d': `${Math.min(i, 12) * 25}ms` }}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[l.status] }} />
              <span className="flex-1 min-w-0 font-bold text-[#111111] dark:text-white uppercase tracking-tight truncate">{l.name}</span>
              <span className="text-xs font-bold tabular-nums text-[#F59E0B]">{l.points.now} pts</span>
            </span>
            <span className="block mt-1 text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{l.statusText} · {l.place || 'No address'}</span>
            <span className="flex items-center gap-3 mt-1.5 text-[11px] text-[#9CA3AF]">
              {/* five dots = the five steps */}
              <span className="flex gap-1">{Array.from({ length: 5 }, (_, s) => <span key={s} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s < l.stepIndex ? '#10B981' : 'rgb(156 163 175 / 0.35)' }} />)}</span>
              {l.opens > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{l.opens}</span>}
              {l.points.ifClosed > l.points.now && <span className="text-[#059669] dark:text-[#34D399] font-semibold">+{l.points.ifClosed - l.points.now} if it closes</span>}
            </span>
          </button>
        ))}
      </div>
      {leads && list.length === 0 && <p className="py-8 text-center text-sm text-[#9CA3AF]">{show === 'moving' ? 'None of your leads are being worked right now.' : 'No leads here.'}</p>}
      {list.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + 48)} className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#1C1C1C]">
          Show more · {list.length - limit} left
        </button>
      )}
    </section>
  )
}

/* ─── Thanks + points ───────────────────────────────────────────────────── */

function Thanks({ list }) {
  return (
    <section className={`glass-in ${card} overflow-hidden`}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1EFEC] dark:border-[#232323]">
        <p className="text-lg font-bold text-[#111111] dark:text-white">Thanks you received</p>
        <span className="text-sm text-[#9CA3AF]">Kept forever</span>
      </div>
      <ul className="divide-y divide-[#F1EFEC] dark:divide-[#232323] max-h-[420px] overflow-y-auto thin-scroll">
        {(list ?? []).length === 0 && (
          <li className="px-6 py-10 text-center">
            <Heart className="mx-auto w-6 h-6 text-[#F43F5E]/50" />
            <p className="mt-2 text-sm text-[#9CA3AF]">No thanks yet — when a follow-up manager or agent thanks you for a lead, it stays here.</p>
          </li>
        )}
        {(list ?? []).map((t, i) => (
          <li key={t.id} className="mac-slide-in flex gap-4 px-6 py-4" style={{ '--d': `${i * 40}ms` }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: tone(t.from) }}>{initials(t.from)}</span>
            <span className="min-w-0">
              <span className="block text-[15px] text-[#111111] dark:text-white">“{t.text}”</span>
              <span className="block text-sm text-[#9CA3AF]">{t.from} · {dayText(t.at)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const WEIGHT_COLOR = { cold: '#60A5FA', warm: '#F59E0B', hot: '#F43F5E', listed: '#A78BFA', rented_out: '#10B981', sold: '#10B981', call: '#9CA3AF' }

function Points({ list, stats }) {
  return (
    <section className={`glass-in ${card} p-6`}>
      <p className="text-lg font-bold text-[#111111] dark:text-white">How your leads earn points</p>
      <ul className="mt-3 divide-y divide-[#F1EFEC] dark:divide-[#232323]">
        {(list ?? []).map((w) => (
          <li key={w.key} className="flex items-center gap-3 py-2.5" title={w.note}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WEIGHT_COLOR[w.key] }} />
            <span className="flex-1 text-[15px] text-[#111111] dark:text-white">{w.label}{w.note && <span className="block text-[11px] text-[#9CA3AF]">{w.note}</span>}</span>
            <span className="font-bold tabular-nums text-[#059669] dark:text-[#34D399]">+{w.points}</span>
          </li>
        ))}
      </ul>
      {stats && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFFBEB] dark:bg-[#271F0E] px-4 py-3 text-sm text-[#111111] dark:text-white">
          <Flame className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          A listed lead that rents out or sells earns you another +20 on top of the listing. Your leads hold {stats.pointsInLeads.toLocaleString()} points right now.
        </p>
      )}
    </section>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function MyProgressPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?._id)
  const [period, setPeriodState] = useState(() => { try { return localStorage.getItem('rt-progress-period') || 'week' } catch { return 'week' } })
  const setPeriod = (p) => { setPeriodState(p); try { localStorage.setItem('rt-progress-period', p) } catch { /* private */ } }
  const [open, setOpen] = useState(null) // null: the latest worked lead · false: none
  useLive(qc)

  const { data } = useQuery({
    queryKey: ['my-progress', userId, period],
    queryFn: () => axiosClient.get('/reports/my-progress', { params: { period } }).then((r) => r.data.data),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  })

  // Open the most recently worked lead by default, so the journey is there straight away
  const fallback = useMemo(() => {
    const l = data?.leads ?? []
    return ([...l].sort((a, b) => b.opens - a.opens)[0]?.opens ? [...l].sort((a, b) => b.opens - a.opens)[0]
      : l.find((x) => ['listed', 'still_negotiating'].includes(x.status)) ?? l.find((x) => x.stepIndex > 1))?.id ?? null
  }, [data])
  const shown = open === false ? null : open ?? fallback
  const pickLead = (id) => { setOpen(id); if (id) setTimeout(() => document.getElementById('lead-journey')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }

  return (
    <div className="h-full overflow-y-auto thin-scroll bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      <div className="p-4 sm:p-6 xl:p-8 space-y-5">
        <Wrapped data={data} period={period} setPeriod={setPeriod} onLead={pickLead} />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,500px)_minmax(0,1fr)] gap-5 items-start">
          <NextPlace race={data?.race} />
          <Numbers data={data} />
        </div>

        <Milestones list={data?.milestones} />

        <div id="lead-journey" className="space-y-4 scroll-mt-4">
          {shown && <Journey id={shown} onClose={() => setOpen(false)} />}
          <YourLeads leads={data?.leads} open={shown} setOpen={pickLead} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
          <Thanks list={data?.thanks} />
          <Points list={data?.weights} stats={data?.stats} />
        </div>

        {data?.race?.rank === 1 && (
          <p className="flex items-center justify-center gap-2 text-sm text-[#9CA3AF]"><Trophy className="w-4 h-4 text-[#F59E0B]" /> You&apos;re top of the board this month.</p>
        )}
      </div>
    </div>
  )
}
