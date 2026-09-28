/**
 * "Working Hours" — infers how many hours a cold caller actually worked on a given day
 * from the spread between their first and last logged call (there's no clock-in/out
 * anywhere in this app). Used both by admin viewing a caller's detail page
 * (endpoint=/performance/working-hours/:id) and by the caller viewing their own
 * dashboard (endpoint=/performance/working-hours/me) — same component, same shape.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Timer, Sunrise, Sunset, BarChart3, Loader2, AlertTriangle, PhoneCall,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts'
import axiosClient from '../../lib/axios'
import { DateField } from '../common/DateTimeFields'

const BRAND = '#F95C4B'

const OUTCOME_COLORS = {
  interested: '#10B981', no_answer: '#F59E0B', callback_requested: '#3B82F6',
  wrong_number: '#8B5CF6', remove_me: '#EF4444', voicemail: '#6B7280', not_interested: '#F97316',
}
const OUTCOME_LABEL = {
  interested: 'Interested', no_answer: 'No Answer', callback_requested: 'Callback Requested',
  wrong_number: 'Wrong Number', remove_me: 'Remove Me', voicemail: 'Voicemail', not_interested: 'Not Interested',
}

const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

function timeOfDayPct(iso) {
  const d = new Date(iso)
  return ((d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / 24) * 100
}

function fmtHours(h) {
  if (!h) return '0h'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`
}

/* ─── Small building blocks (kept local — only this section uses them) ──────── */

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">{value}</p>
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function TimelineDot({ call }) {
  const color = OUTCOME_COLORS[call.outcome] ?? '#6B7280'
  return (
    <div
      className="group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-[#181818] shadow-sm cursor-pointer hover:scale-125 transition-transform z-10"
      style={{ left: `${timeOfDayPct(call.calledAt)}%`, backgroundColor: color }}
    >
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] px-3 py-2 rounded-xl bg-[#111111] dark:bg-[#2A2A2A] text-white text-[11px] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="font-semibold">{format(new Date(call.calledAt), 'HH:mm')}</p>
        <p className="truncate">{call.contactName}</p>
        <p style={{ color }} className="font-medium">{OUTCOME_LABEL[call.outcome] ?? call.outcome}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#111111] dark:bg-[#2A2A2A] rotate-45 -mt-1" />
      </div>
    </div>
  )
}

function CallTimeline({ timeline, firstCallAt, lastCallAt }) {
  if (!timeline.length) {
    return (
      <div className="h-28 flex flex-col items-center justify-center gap-2 text-center">
        <PhoneCall className="w-6 h-6 text-[#6B7280]/20 dark:text-[#A1A1AA]/20" strokeWidth={1.5} />
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No calls logged on this day</p>
      </div>
    )
  }

  const spanStart = firstCallAt ? timeOfDayPct(firstCallAt) : 0
  const spanEnd   = lastCallAt  ? timeOfDayPct(lastCallAt)  : 0

  return (
    <div className="pt-8 pb-2">
      <div className="relative h-8">
        {/* hour gridlines */}
        {HOUR_MARKS.map((h) => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-[#E5E7EB] dark:border-[#2A2A2A]" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {/* working span */}
        {timeline.length > 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full"
            style={{ left: `${spanStart}%`, width: `${Math.max(spanEnd - spanStart, 0.5)}%`, backgroundColor: `${BRAND}30` }}
          />
        )}
        {/* base track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        {/* call dots */}
        {timeline.map((c, i) => <TimelineDot key={i} call={c} />)}
      </div>
      <div className="relative h-4 mt-1">
        {HOUR_MARKS.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 text-[10px] text-[#9CA3AF]"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  )
}

function HoursTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl px-3 py-2 shadow-lg text-xs min-w-[150px]">
      <p className="font-semibold text-[#111111] dark:text-white mb-1">{format(parseISO(d.date), 'EEE, d MMM')}</p>
      {d.callCount > 0 ? (
        <>
          <p className="font-medium" style={{ color: BRAND }}>Worked: <span className="font-bold">{fmtHours(d.hoursWorked)}</span></p>
          <p className="text-[#6B7280] dark:text-[#A1A1AA]">{d.callCount} call{d.callCount !== 1 ? 's' : ''}</p>
          {d.firstCallAt && d.lastCallAt && (
            <p className="text-[#6B7280] dark:text-[#A1A1AA]">{format(new Date(d.firstCallAt), 'HH:mm')} – {format(new Date(d.lastCallAt), 'HH:mm')}</p>
          )}
        </>
      ) : (
        <p className="text-[#6B7280] dark:text-[#A1A1AA]">No calls logged</p>
      )}
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

export default function WorkingHoursSection({ endpoint, days = 14 }) {
  const [date, setDate] = useState('')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['performance', 'working-hours', endpoint, date, days],
    queryFn: () => axiosClient.get(endpoint, { params: { date: date || undefined, days } }).then((r) => r.data.data),
    staleTime: 30_000,
  })

  // Once the backend resolves a default date (most recent day with calls), reflect it in
  // the picker — but only the first time, so it never fights a date the viewer picked.
  useEffect(() => {
    if (data?.date && !date) setDate(data.date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.date])

  const series = data?.series ?? []
  const chartData = series.map((d) => ({ ...d, isSelected: d.date === (data?.date ?? date) }))

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
          Working Hours
        </h2>
        <DateField value={date} onChange={setDate} allowPast placeholder="Select a day" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Couldn't load working hours.
          <button onClick={() => refetch()} className="ml-auto text-xs font-semibold underline">{isFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Sunrise} label="First Call" color="#F59E0B"
              value={data.firstCallAt ? format(new Date(data.firstCallAt), 'HH:mm') : '—'}
            />
            <StatCard
              icon={Sunset} label="Last Call" color="#8B5CF6"
              value={data.lastCallAt ? format(new Date(data.lastCallAt), 'HH:mm') : '—'}
            />
            <StatCard
              icon={Timer} label="Hours Worked" color={BRAND}
              value={fmtHours(data.hoursWorked)}
              sub={`${data.callCount} call${data.callCount !== 1 ? 's' : ''} on ${format(parseISO(data.date), 'd MMM')}`}
            />
            <StatCard
              icon={BarChart3} label="Average / Day" color="#3B82F6"
              value={fmtHours(data.averageHoursWorked)}
              sub={`${data.daysActive} of ${data.days} days worked`}
            />
          </div>

          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND}15` }}>
                <PhoneCall className="w-4 h-4" style={{ color: BRAND }} strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white">
                Call Timeline — {format(parseISO(data.date), 'EEEE, d MMM yyyy')}
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] ml-9">
              Each dot is one logged call. The shaded band is the span between the first and last call that day.
            </p>
            <CallTimeline timeline={data.timeline} firstCallAt={data.firstCallAt} lastCallAt={data.lastCallAt} />
          </div>

          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3B82F615' }}>
                <BarChart3 className="w-4 h-4" style={{ color: '#3B82F6' }} strokeWidth={1.75} />
              </div>
              <span className="text-sm font-bold text-[#111111] dark:text-white">Hours Worked — Last {data.days} Days</span>
            </div>
            {series.every((d) => d.hoursWorked === 0) ? (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No multi-call days in this range yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} onClick={(e) => e?.activePayload?.[0] && setDate(e.activePayload[0].payload.date)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), 'd MMM')} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip content={<HoursTooltip />} cursor={{ fill: '#F5F5F4' }} />
                  {data.averageHoursWorked > 0 && (
                    <ReferenceLine y={data.averageHoursWorked} stroke="#3B82F6" strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: `avg ${fmtHours(data.averageHoursWorked)}`, position: 'insideTopLeft', fontSize: 10, fill: '#3B82F6' }} />
                  )}
                  <Bar dataKey="hoursWorked" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} cursor="pointer">
                    {chartData.map((d) => (
                      <Cell key={d.date} fill={d.isSelected ? BRAND : d.callCount > 0 ? `${BRAND}55` : '#E5E7EB'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-[10px] text-[#9CA3AF] mt-2">Click a bar to view that day's call timeline above.</p>
          </div>
        </div>
      )}
    </section>
  )
}
