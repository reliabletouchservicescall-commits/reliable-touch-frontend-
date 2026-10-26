import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceStrict, isToday, isYesterday } from 'date-fns'
import {
  Repeat, PencilLine, UserCheck, PhoneCall, MessageSquare, Sparkles, Bot, ArrowRight, Loader2, AlertTriangle, History,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { onLeadEvent } from '../../lib/livePresence'
import LiquidTabs from '../common/LiquidTabs'
import { LeadStatusBadge, LEAD_STATUS_META, COMMENT_AUTHOR_META } from './leadShared'

// A lead's full audit trail (GET /leads/:id/history): the temperature journey at the top,
// then everything that happened, newest first, grouped by day — who changed the status
// from what to what (and why), field edits with the old and new value, assignments,
// calls and comments. Refreshes live when anyone touches the lead.

const TYPE_META = {
  status:   { icon: Repeat,        color: '#F95C4B', label: 'Status' },
  updated:  { icon: PencilLine,    color: '#3B82F6', label: 'Edit' },
  assigned: { icon: UserCheck,     color: '#10B981', label: 'Assigned' },
  call:     { icon: PhoneCall,     color: '#111111', label: 'Call' },
  comment:  { icon: MessageSquare, color: '#8B5CF6', label: 'Comment' },
  created:  { icon: Sparkles,      color: '#F59E0B', label: 'Created' },
}
const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'status', label: 'Status', icon: Repeat },
  { key: 'edits', label: 'Edits', icon: PencilLine },
  { key: 'calls', label: 'Calls', icon: PhoneCall },
  { key: 'comments', label: 'Comments', icon: MessageSquare },
]
const MATCH = {
  all: () => true,
  status: (i) => i.type === 'status',
  edits: (i) => i.type === 'updated' || i.type === 'assigned' || i.type === 'created',
  calls: (i) => i.type === 'call',
  comments: (i) => i.type === 'comment',
}
const CALL_OUTCOME = {
  no_answer: ['No answer', '#9CA3AF'], voicemail: ['Voicemail', '#9CA3AF'], callback_requested: ['Callback', '#F59E0B'],
  interested: ['Interested', '#10B981'], not_interested: ['Not interested', '#EF4444'], wrong_number: ['Wrong number', '#EF4444'],
  remove_me: ['Remove me', '#EF4444'],
}

function dayLabel(d) {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMM yyyy')
}

function Who({ item }) {
  if (item.system || (!item.actor && item.type === 'status')) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-[#3B82F6]">
        <Bot className="w-3.5 h-3.5" /> System
      </span>
    )
  }
  const meta = COMMENT_AUTHOR_META[item.actor?.role]
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <b className="font-semibold text-[#111111] dark:text-white">{item.actor?.name ?? 'Someone'}</b>
      {meta && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>{meta.label}</span>
      )}
    </span>
  )
}

function Journey({ journey, currentStatus }) {
  if (!journey?.length) return null
  return (
    <div className="mac-in rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Status journey</p>
      <ol className="flex items-start gap-1 overflow-x-auto thin-scroll pb-1">
        {journey.map((j, i) => {
          const meta = LEAD_STATUS_META[j.status] ?? LEAD_STATUS_META.cold
          const last = i === journey.length - 1
          const stay = formatDistanceStrict(new Date(j.until ?? Date.now()), new Date(j.at))
          return (
            <li key={`${j.status}-${j.at}`} className="flex items-start gap-1 flex-shrink-0 mac-pop" style={{ '--d': `${i * 70}ms` }}>
              <div className="flex flex-col items-center text-center w-[112px]">
                <span className={`relative w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${last && j.status === currentStatus ? 'ring-4' : ''}`}
                  style={{ backgroundColor: meta.color, '--tw-ring-color': `${meta.color}33` }}>
                  {i + 1}
                  {last && j.status === currentStatus && <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: meta.color }} />}
                </span>
                <span className="mt-1.5 text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-full">{j.by}</span>
                <span className="text-[10px] text-[#9CA3AF]">{format(new Date(j.at), 'd MMM')} · {last ? `${stay} so far` : stay}</span>
              </div>
              {!last && <ArrowRight className="w-4 h-4 text-[#D4D4D8] dark:text-[#3F3F46] mt-2.5 flex-shrink-0" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Body({ item }) {
  if (item.type === 'status') {
    return (
      <>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {item.from ? <LeadStatusBadge status={item.from} /> : <span className="text-[11px] text-[#9CA3AF]">New lead</span>}
          <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
          <LeadStatusBadge status={item.to} />
        </div>
        {item.reason && (
          <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed border-l-2 border-[#E5E7EB] dark:border-[#2A2A2A] pl-2.5">{item.reason}</p>
        )}
      </>
    )
  }
  if ((item.type === 'updated' || item.type === 'assigned') && item.changes?.length) {
    return (
      <ul className="mt-2 space-y-1.5">
        {item.changes.map((c) => (
          <li key={c.field} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-xs">
            <span className="text-[#9CA3AF] capitalize">{c.label}</span>
            <span className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-[#9CA3AF] line-through decoration-[#EF4444]/50 break-words">{c.from ?? 'empty'}</span>
              <ArrowRight className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />
              <span className="font-semibold text-[#111111] dark:text-white break-words">{c.to ?? 'cleared'}</span>
            </span>
          </li>
        ))}
      </ul>
    )
  }
  if (item.type === 'call') {
    const [label, color] = CALL_OUTCOME[item.outcome] ?? [item.outcome, '#6B7280']
    return (
      <div className="mt-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color, backgroundColor: `${color}18` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />{label}
        </span>
        {item.notes && <p className="mt-1.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">“{item.notes}”</p>}
      </div>
    )
  }
  if (item.type === 'comment') {
    return <p className="mt-1.5 px-3 py-2 rounded-xl rounded-tl-sm bg-[#F5F5F4] dark:bg-[#202020] text-sm text-[#111111] dark:text-white whitespace-pre-wrap break-words">{item.text}</p>
  }
  return null
}

const VERB = {
  status: 'changed the status',
  call: 'logged a call',
  comment: 'commented',
}

export default function LeadHistory({ leadId }) {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const key = ['lead-history', leadId]
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => leadsApi.history(leadId).then((r) => r.data.data),
    staleTime: 10_000,
  })

  // Anyone changes this lead → the trail updates on its own
  useEffect(() => onLeadEvent((event, p) => {
    if (event === 'lead:changed' && p?.leadId === leadId) qc.invalidateQueries({ queryKey: key })
  }), [leadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = data?.items ?? []
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, items.filter(MATCH[f.key]).length])), [items])
  const shown = items.filter(MATCH[filter])
  const groups = useMemo(() => {
    const g = []
    shown.forEach((i) => {
      const label = dayLabel(new Date(i.at))
      if (g[g.length - 1]?.label !== label) g.push({ label, items: [] })
      g[g.length - 1].items.push(i)
    })
    return g
  }, [shown])

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></div>
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <AlertTriangle className="w-7 h-7 text-[#EF4444]/50" />
        <p className="text-sm text-[#6B7280]">Couldn&apos;t load this lead&apos;s history.</p>
        <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-[#F95C4B] hover:underline">Try again</button>
      </div>
    )
  }

  let n = 0
  return (
    <div className="space-y-4">
      <Journey journey={data?.journey} currentStatus={data?.currentStatus} />
      <LiquidTabs tabs={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <History className="w-8 h-8 text-[#9CA3AF]/40" strokeWidth={1.5} />
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Nothing here yet.</p>
        </div>
      ) : groups.map((g) => (
        <section key={g.label}>
          <p className="sticky top-0 z-10 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] bg-[#FAFAF9]/90 dark:bg-[#0B0B0B]/90 backdrop-blur">{g.label}</p>
          <ol className="relative mt-1 space-y-1 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-[#E5E7EB] dark:before:bg-[#2A2A2A]">
            {g.items.map((item) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.updated
              const ink = meta.color === '#111111'
              const d = Math.min(n++, 12) * 35
              return (
                <li key={item.id} className="mac-in relative flex gap-3 p-2 rounded-xl hover:bg-white dark:hover:bg-[#181818] transition-colors" style={{ '--d': `${d}ms` }}>
                  <span className={`relative z-10 w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-[#FAFAF9] dark:ring-[#0B0B0B] ${ink ? 'bg-[#111111]/8 dark:bg-white/10' : ''}`}
                    style={ink ? undefined : { backgroundColor: `${meta.color}18` }}>
                    <meta.icon className={`w-4 h-4 ${ink ? 'text-[#111111] dark:text-white' : ''}`} style={ink ? undefined : { color: meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed min-w-0">
                        <Who item={item} /> <span>{VERB[item.type] ?? item.summary}</span>
                      </p>
                      <time className="text-[10px] text-[#9CA3AF] whitespace-nowrap tabular-nums" title={format(new Date(item.at), 'd MMM yyyy, HH:mm:ss')}>
                        {format(new Date(item.at), 'HH:mm')}
                      </time>
                    </div>
                    <Body item={item} />
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
