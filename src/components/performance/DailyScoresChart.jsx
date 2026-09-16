import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, RotateCcw } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import axiosClient from '../../lib/axios'

// Distinct, high-contrast colors for up to a dozen-plus callers — the current viewer's
// own line always overrides to brand orange regardless of index, so "which one is me"
// never depends on remembering a palette slot.
const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4',
  '#84CC16', '#EF4444', '#14B8A6', '#6366F1', '#D946EF', '#F97316',
]

const GRANULARITIES = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  const sorted = [...payload].filter((p) => p.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  if (!sorted.length) return null
  const label = point?.weekEnd
    ? `${format(new Date(point.date), 'd MMM')} – ${format(new Date(point.weekEnd), 'd MMM')}`
    : point?.date ? format(new Date(point.date), 'EEE, d MMM') : ''
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl px-3 py-2 shadow-lg text-xs max-h-64 overflow-y-auto min-w-[170px]">
      <p className="font-semibold text-[#111111] dark:text-white mb-1.5">{label}</p>
      {sorted.map((p) => (
        <p key={p.dataKey} className="font-medium flex items-center gap-1.5 whitespace-nowrap py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span style={{ color: p.color }}>{p.name}</span>:
          <span className="font-bold text-[#111111] dark:text-white">{p.value ?? 0}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * One line per active cold caller, score for the last N days — visible to both admin
 * (full leaderboard names) and cold callers (their own leaderboard page), backed by the
 * same GET /performance/daily-scores endpoint. Pass `currentUserId` to have the
 * viewer's own line drawn thick and in brand orange, with everyone else's dimmed —
 * "how am I trending against the team" at a glance, without hiding who's who.
 *
 * Defaults to daily granularity; a Weekly toggle re-buckets the same 30-day payload
 * into ~7-day sums client-side (no extra request) for a smoother trend when the daily
 * view gets spiky.
 */
export default function DailyScoresChart({ days = 30, currentUserId, height = 320 }) {
  const [hidden, setHidden] = useState(() => new Set())
  const [granularity, setGranularity] = useState('day')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['performance', 'daily-scores', days],
    queryFn: () => axiosClient.get('/performance/daily-scores', { params: { days } }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const callers = data?.callers ?? []

  const dayRows = useMemo(() => (data?.series ?? []).map((day) => {
    const row = { date: day.date }
    day.callers.forEach((c) => { row[c.userId] = c.score })
    return row
  }), [data])

  // Chunked from the most recent day backward, so the newest week is always a full
  // 7-day window and any remainder (30 isn't divisible by 7) lands as a shorter,
  // oldest bucket instead of cutting off the most recent trend.
  const weekRows = useMemo(() => {
    const series = data?.series ?? []
    const callerList = data?.callers ?? []
    if (!series.length) return []
    const chunks = []
    let end = series.length
    while (end > 0) {
      const start = Math.max(0, end - 7)
      chunks.unshift(series.slice(start, end))
      end = start
    }
    return chunks.map((weekDays) => {
      const row = { date: weekDays[0].date, weekEnd: weekDays[weekDays.length - 1].date }
      callerList.forEach((c) => {
        row[c.userId] = weekDays.reduce((sum, day) => {
          const entry = day.callers.find((x) => x.userId === c.userId)
          return sum + (entry?.score ?? 0)
        }, 0)
      })
      return row
    })
  }, [data])

  const chartData = granularity === 'week' ? weekRows : dayRows

  function toggle(userId) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const granularityToggle = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] flex-shrink-0">
      {GRANULARITIES.map((g) => (
        <button
          key={g.key}
          type="button"
          onClick={() => setGranularity(g.key)}
          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
            granularity === g.key
              ? 'bg-white dark:bg-[#111111] text-[#F95C4B] shadow-sm'
              : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" />
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ height: Math.min(height, 180) }} className="flex flex-col items-center justify-center gap-2.5 text-sm text-[#6B7280] dark:text-[#A1A1AA]">
        <span>Couldn't load daily performance.</span>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#F95C4B] hover:underline disabled:opacity-50"
        >
          <RotateCcw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} /> {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  if (!callers.length) {
    return (
      <div style={{ height: Math.min(height, 180) }} className="flex items-center justify-center text-sm text-[#6B7280] dark:text-[#A1A1AA]">
        No cold callers to show yet.
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">{granularityToggle}</div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => format(new Date(d), 'd MMM')}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {callers.map((c, idx) => {
            const isMe = c.userId === currentUserId
            const color = isMe ? '#F95C4B' : PALETTE[idx % PALETTE.length]
            const isHidden = hidden.has(c.userId)
            return (
              <Line
                key={c.userId}
                type="monotone"
                dataKey={c.userId}
                name={isMe ? `${c.name} (You)` : c.name}
                stroke={color}
                strokeWidth={isMe ? 3 : 1.5}
                strokeOpacity={isHidden ? 0 : (currentUserId && !isMe ? 0.6 : 1)}
                dot={false}
                activeDot={isHidden ? false : { r: 4 }}
                isAnimationActive
                animationDuration={700}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 px-1 max-h-24 overflow-y-auto">
        {callers.map((c, idx) => {
          const isMe = c.userId === currentUserId
          const color = isMe ? '#F95C4B' : PALETTE[idx % PALETTE.length]
          const isHidden = hidden.has(c.userId)
          return (
            <button
              key={c.userId}
              type="button"
              onClick={() => toggle(c.userId)}
              className={`flex items-center gap-1.5 text-[11px] font-medium transition-opacity ${isHidden ? 'opacity-35' : 'opacity-100'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className={isMe ? 'font-bold text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}>
                {isMe ? `${c.name} (You)` : c.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
