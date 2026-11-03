import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarPlus, ChevronLeft, ChevronRight, CalendarCheck, AlarmClock, PencilLine, ShieldCheck, Phone, Inbox } from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAgentActions } from '../../components/agent/AgentActions'

// Diary — everything with a date, in one timeline: viewings, the callbacks owners asked
// for, lead follow-ups and landlord updates due (the 48-hour promise). Overdue things sit on
// today. Each entry has its one action: open the lead, update it, or call back.

export const KIND = {
  viewing: { label: 'Viewing', icon: CalendarCheck, color: '#10B981' },
  callback: { label: 'Callback', icon: AlarmClock, color: '#F59E0B' },
  followup: { label: 'Follow-up', icon: PencilLine, color: 'rgb(var(--brand-rgb))' },
  promise: { label: 'Landlord update', icon: ShieldCheck, color: 'rgb(var(--brand-rgb))' },
}
const VIEWS = [['today', 'Today'], ['week', 'This week'], ['month', 'Month']]

export function useDiary(from, to) {
  return useQuery({
    queryKey: ['agent-diary', from.toISOString(), to.toISOString()],
    queryFn: () => axiosClient.get('/reports/agent-diary', { params: { from: from.toISOString(), to: to.toISOString() } }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}

// One entry with its action — shared with Home's Today list
export function DiaryRow({ item, compact }) {
  const navigate = useNavigate()
  const actions = useAgentActions()
  const k = KIND[item.kind]
  const act = item.kind === 'callback' ? ['Call back', () => navigate('/agency/calls?tab=callbacks')]
    : item.kind === 'viewing' ? ['Open', () => item.leadId && navigate(`/agency/leads/${item.leadId}`)]
      : ['Update', () => actions?.open('update', { leadId: item.leadId })]
  // Overdue: the day it was due; otherwise the time it's on
  const time = item.overdue ? format(new Date(item.due ?? item.at), 'd MMM') : item.allDay ? 'All day' : format(new Date(item.at), 'HH:mm')
  return (
    <li className={`flex items-center gap-3 rounded-xl ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} ${item.overdue ? 'bg-[#F95C4B]/[0.06]' : 'bg-[#FAFAF9] dark:bg-[#141414]'}`}>
      <span className="w-12 flex-none text-xs font-bold tabular-nums text-[#111111] dark:text-white">{time}</span>
      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg" style={{ color: k.color, backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}><k.icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#111111] dark:text-white">{item.title}</span>
        <span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">
          {k.label}{item.promise ? ' · landlord update due' : ''}{item.sub && item.kind !== 'viewing' ? ` · ${item.sub}` : item.kind === 'viewing' && item.who ? ` · ${item.who}` : ''}
          {item.overdue && <b className="text-[#F95C4B]"> · overdue</b>}
        </span>
      </span>
      {item.phone && !compact && <a href={`tel:${String(item.phone).replace(/[^\d+]/g, '')}`} title={item.phone} className="hidden h-8 w-8 flex-none place-items-center rounded-lg text-[#6B7280] hover:bg-white hover:text-[#10B981] dark:hover:bg-[#202020] sm:grid"><Phone className="h-4 w-4" /></a>}
      <button type="button" onClick={act[1]}
        className={`flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${item.overdue ? 'bg-[#F95C4B] text-white hover:bg-[#E84B3A]' : 'border border-[#E5E7EB] bg-white text-[#111111] hover:border-[#F95C4B]/50 dark:border-[#2A2A2A] dark:bg-[#181818] dark:text-white'}`}>
        {act[0]}
      </button>
    </li>
  )
}

function range(view, anchor) {
  if (view === 'today') return [anchor, anchor]
  if (view === 'week') return [startOfWeek(anchor, { weekStartsOn: 1 }), endOfWeek(anchor, { weekStartsOn: 1 })]
  return [startOfMonth(anchor), endOfMonth(anchor)]
}

export default function DiaryPage() {
  const actions = useAgentActions()
  const [view, setView] = useState(() => { try { return localStorage.getItem('rt-diary-view') || 'today' } catch { return 'today' } })
  const [anchor, setAnchor] = useState(() => new Date())
  const [from, to] = range(view, anchor)
  const { data, isLoading } = useDiary(from, to)
  const pickView = (v) => { setView(v); setAnchor(new Date()); try { localStorage.setItem('rt-diary-view', v) } catch { /* private mode */ } }
  const step = (n) => setAnchor((a) => (view === 'today' ? addDays(a, n) : view === 'week' ? addDays(a, 7 * n) : addMonths(a, n)))

  const byDay = useMemo(() => {
    const m = new Map()
    for (const i of data?.items ?? []) { const k = format(new Date(i.at), 'yyyy-MM-dd'); m.set(k, [...(m.get(k) ?? []), i]) }
    return m
  }, [data])
  const days = useMemo(() => {
    const out = []
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
    return out
  }, [from.getTime(), to.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const title = view === 'today' ? (isToday(anchor) ? 'Today' : format(anchor, 'EEEE d MMMM'))
    : view === 'week' ? `${format(from, 'd MMM')} – ${format(to, 'd MMM')}` : format(anchor, 'MMMM yyyy')
  const counts = data?.counts ?? {}

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-6 xl:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111111] dark:text-white">Diary</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Viewings, callbacks, follow-ups and landlord updates — in one place.</p>
        </div>
        <button type="button" onClick={() => actions?.open('viewing')}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#F95C4B] px-5 py-3 text-sm font-semibold text-white shadow-btn hover:bg-[#E84B3A]">
          <CalendarPlus className="h-4 w-4" /> Book a viewing
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-[#E5E7EB] bg-white p-1 dark:border-[#2A2A2A] dark:bg-[#181818]">
          {VIEWS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => pickView(k)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${view === k ? 'bg-[#F95C4B] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <p className="text-base font-bold text-[#111111] dark:text-white">{title}</p>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {Object.entries(KIND).filter(([k]) => counts[k]).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#3F3F46] ring-1 ring-[#E5E7EB] dark:bg-[#181818] dark:text-[#D4D4D8] dark:ring-[#2A2A2A]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} /> {counts[k]} {v.label.toLowerCase()}{counts[k] === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? <div className="shimmer h-[320px] rounded-2xl" /> : view === 'month' ? (
        <MonthGrid anchor={anchor} byDay={byDay} onDay={(d) => { setView('today'); setAnchor(d) }} />
      ) : (
        <div className="space-y-5">
          {days.map((d) => {
            const items = byDay.get(format(d, 'yyyy-MM-dd')) ?? []
            if (view === 'week' && !items.length) return null
            return (
              <section key={d.toISOString()} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2A2A2A] dark:bg-[#181818] sm:p-5">
                {view === 'week' && <p className={`mb-3 text-sm font-bold ${isToday(d) ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>{isToday(d) ? 'Today' : format(d, 'EEEE d MMM')}</p>}
                {items.length ? <ul className="space-y-2">{items.map((i) => <DiaryRow key={i.id} item={i} />)}</ul> : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#10B981]/12 text-[#10B981]"><Inbox className="h-6 w-6" /></span>
                    <p className="text-sm font-semibold text-[#111111] dark:text-white">Nothing booked {isToday(d) ? 'today' : 'this day'}</p>
                    <button type="button" onClick={() => actions?.open('viewing')} className="text-sm font-semibold text-[#F95C4B] hover:underline">Book a viewing</button>
                  </div>
                )}
              </section>
            )
          })}
          {view === 'week' && !(data?.items ?? []).length && (
            <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-10 text-center text-sm text-[#6B7280] dark:border-[#2A2A2A] dark:text-[#A1A1AA]">A clear week. Book a viewing or set follow-ups from your leads.</p>
          )}
        </div>
      )}
    </div>
  )
}

function MonthGrid({ anchor, byDay, onDay }) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  const cells = []
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d)
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#181818]">
      <div className="grid grid-cols-7 border-b border-[#E5E7EB] text-center text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:border-[#2A2A2A]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="py-2">{d}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const items = byDay.get(format(d, 'yyyy-MM-dd')) ?? []
          const kinds = [...new Set(items.map((i) => i.kind))]
          return (
            <button key={d.toISOString()} type="button" onClick={() => onDay(d)}
              className={`flex min-h-[64px] flex-col items-start gap-1 border-b border-r border-[#F1EFEC] p-2 text-left transition-colors hover:bg-[#FAFAF9] dark:border-[#232323] dark:hover:bg-[#1E1E1E] sm:min-h-[88px] ${isSameMonth(d, anchor) ? '' : 'opacity-40'}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday(d) ? 'bg-[#F95C4B] text-white' : 'text-[#111111] dark:text-white'}`}>{format(d, 'd')}</span>
              {items.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  {kinds.map((k) => <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KIND[k].color }} />)}
                  <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{items.length}</span>
                </span>
              )}
              {isSameDay(d, new Date()) && items.some((i) => i.overdue) && <span className="hidden text-[10px] font-bold text-[#F95C4B] sm:block">overdue</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
