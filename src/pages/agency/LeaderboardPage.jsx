import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Trophy, Crown, Phone, CalendarCheck, Key, Banknote,
  Flame, BarChart3, TrendingUp, Sun, ChevronRight, LineChart as LineChartIcon,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import DailyScoresChart from '../../components/performance/DailyScoresChart'
import AgencyLeadsTable from '../../components/performance/AgencyLeadsTable'

const BRAND = '#F95C4B'
const DAILY_ENDPOINT = '/performance/agency/daily-scores'
const SERIES_DAYS = 30

const PERIODS = [
  { key: 'day',   label: 'Today',      noun: 'today' },
  { key: 'week',  label: 'This Week',  noun: 'this week' },
  { key: 'month', label: 'This Month', noun: 'this month' },
  { key: 'year',  label: 'This Year',  noun: 'this year' },
]

// Calls → appointments → rented out / sold. Colors stay inside the brand palette:
// neutral gray for raw volume, amber and green for progress, coral for the final win.
const STAGES = [
  { key: 'calls',        label: 'Calls',        icon: Phone,         color: '#6B7280' },
  { key: 'appointments', label: 'Appointments', icon: CalendarCheck, color: '#F59E0B' },
  { key: 'rentedOut',    label: 'Rented Out',   icon: Key,           color: '#16A34A' },
  { key: 'sold',         label: 'Sold',         icon: Banknote,      color: BRAND },
]

const TREND_RANGES = [
  { key: 'week',  label: 'Week',  days: 7 },
  { key: 'month', label: 'Month', days: 30 },
]

const SCOPES = [
  { key: 'me',   label: 'You' },
  { key: 'team', label: 'Company' },
]

function initials(name = '') {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/* ─── Small building blocks ───────────────────────────────────────── */

function Card({ className = '', children }) {
  return (
    <div className={`bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm font-bold text-[#111111] dark:text-white">{title}</p>
          {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex items-center bg-[#F5F5F4] dark:bg-[#202020] rounded-lg p-1 gap-1 flex-shrink-0">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
            value === o.key
              ? 'bg-white dark:bg-[#111111] text-[#F95C4B] shadow-sm'
              : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Skeleton({ className = '' }) {
  return <div className={`rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse ${className}`} />
}

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl px-3 py-2 shadow-lg text-xs min-w-[150px]">
      {label != null && (
        <p className="font-semibold text-[#111111] dark:text-white mb-1.5">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 py-0.5 font-medium whitespace-nowrap">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color ?? p.payload?.fill }} />
          <span className="text-[#6B7280] dark:text-[#A1A1AA]">{p.name}</span>
          <span className="ml-auto pl-3 font-bold text-[#111111] dark:text-white">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

/* ─── Position hero ───────────────────────────────────────────────── */

function PositionHero({ me, myRank, total, board, user }) {
  const above = myRank > 1 ? board[myRank - 2] : null
  const gap = above ? Math.max(0, above.score - me.score) : 0
  const topPct = total > 0 ? Math.max(1, Math.round((myRank / total) * 100)) : 0
  const leader = board[0]
  const toLeader = leader && leader.score > 0 ? Math.min(100, pct(me.score, leader.score)) : 0

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#111111] text-white p-6 h-full flex flex-col justify-between gap-6">
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#F95C4B]/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-16 w-56 h-56 rounded-full bg-[#F95C4B]/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#F95C4B] flex items-center justify-center text-xl font-black shadow-lg shadow-[#F95C4B]/30 flex-shrink-0">
          {myRank === 1
            ? <Crown className="w-8 h-8" strokeWidth={2} />
            : initials(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`)}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#F95C4B]">Your position</p>
          <p className="text-4xl font-black leading-none mt-1">
            #{myRank}
            <span className="text-sm font-medium text-white/60 ml-2">of {total} agents</span>
          </p>
        </div>
        <div className="ml-auto text-right flex-shrink-0">
          <p className="text-4xl font-black leading-none text-[#F95C4B]">{fmt(me.score)}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1.5">points</p>
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white/80">Top {topPct}% of your company</span>
          <span className="text-white/50">
            {myRank === 1
              ? 'You are leading — keep it up'
              : <>{fmt(gap)} pts to pass <span className="text-white font-semibold">{above?.name}</span></>}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${myRank === 1 ? 100 : toLeader}%`, background: 'linear-gradient(90deg, #F95C4B, #FF8C7A)' }}
          />
        </div>
        <p className="text-[10px] text-white/40">
          {myRank === 1 ? 'Score relative to leader' : `${toLeader}% of the leader's score (${leader?.name})`}
        </p>
      </div>
    </div>
  )
}

/* ─── Pipeline funnel for the selected period ─────────────────────── */

function PipelineFunnel({ me, periodNoun }) {
  const values = {
    calls: me.totalCalls ?? 0,
    appointments: me.appointmentsAttended ?? 0,
    rentedOut: me.rentedOutCount ?? 0,
    sold: me.soldCount ?? 0,
  }
  const deals = values.rentedOut + values.sold
  const max = Math.max(1, ...Object.values(values))
  const conversions = {
    appointments: { value: pct(values.appointments, values.calls), label: 'of calls' },
    rentedOut:    { value: pct(values.rentedOut, values.appointments), label: 'of appts' },
    sold:         { value: pct(values.sold, values.appointments), label: 'of appts' },
  }

  return (
    <Card className="p-6 h-full">
      <CardHeader
        icon={TrendingUp}
        title="Your pipeline"
        subtitle={`From first call to a closed deal, ${periodNoun}`}
        right={
          <div className="text-right">
            <p className="text-2xl font-black text-[#111111] dark:text-white leading-none">{fmt(deals)}</p>
            <p className="text-[10px] uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mt-1">deals closed</p>
          </div>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGES.map((s, i) => {
          const v = values[s.key]
          const conv = conversions[s.key]
          return (
            <div key={s.key} className="relative rounded-xl bg-[#FAFAF9] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
              {i > 0 && i < 2 && (
                <ChevronRight className="hidden lg:block absolute -left-[13px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#D4D4D8] dark:text-[#3F3F46] bg-white dark:bg-[#181818] rounded-full" />
              )}
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}18` }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} strokeWidth={1.75} />
                </div>
                {conv && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ color: s.color, backgroundColor: `${s.color}15` }}
                  >
                    {conv.value}% {conv.label}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-[#111111] dark:text-white mt-3">{fmt(v)}</p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{s.label}</p>
              <div className="h-1.5 mt-3 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${v > 0 ? Math.max(4, (v / max) * 100) : 0}%`, backgroundColor: s.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ─── Today: you vs. company average, per stage ───────────────────── */

function TodayComparison({ today, agentCount, isLoading }) {
  const rows = STAGES.map((s) => {
    const mine = today?.me?.[s.key] ?? 0
    const teamTotal = today?.team?.[s.key] ?? 0
    const avg = agentCount > 0 ? Math.round((teamTotal / agentCount) * 10) / 10 : 0
    return { ...s, mine, avg, teamTotal }
  })

  return (
    <Card className="p-6 h-full">
      <CardHeader
        icon={Sun}
        title="Today's performance"
        subtitle={`You against the company average · ${format(new Date(), 'EEEE, d MMMM')}`}
        right={
          <div className="flex items-center gap-3 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#F95C4B]" /> You</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#D4D4D8] dark:bg-[#3F3F46]" /> Company avg</span>
          </div>
        }
      />
      {isLoading ? (
        <div className="space-y-4">{STAGES.map((s) => <Skeleton key={s.key} className="h-12" />)}</div>
      ) : (
        <div className="space-y-5">
          {rows.map((r) => {
            // Each stage gets its own scale — calls would otherwise flatten every other bar.
            const scale = Math.max(1, r.mine, r.avg)
            const ahead = r.mine > r.avg
            return (
              <div key={r.key} className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr_5rem] items-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <r.icon className="w-4 h-4 flex-shrink-0" style={{ color: r.color }} strokeWidth={1.75} />
                  <span className="text-xs font-semibold text-[#111111] dark:text-white truncate">{r.label}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                      <div className="h-full rounded-full bg-[#F95C4B] transition-all duration-700" style={{ width: `${(r.mine / scale) * 100}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs font-black text-[#111111] dark:text-white">{fmt(r.mine)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                      <div className="h-full rounded-full bg-[#D4D4D8] dark:bg-[#3F3F46] transition-all duration-700" style={{ width: `${(r.avg / scale) * 100}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{fmt(r.avg)}</span>
                  </div>
                </div>
                <div className="hidden sm:block text-right">
                  {r.mine === 0 && r.avg === 0 ? (
                    <span className="text-[10px] text-[#9CA3AF]">No activity</span>
                  ) : (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ahead ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]'
                      }`}
                    >
                      {ahead ? 'Ahead' : r.mine === r.avg ? 'On par' : 'Behind'}
                    </span>
                  )}
                  <p className="text-[10px] text-[#9CA3AF] mt-1">{fmt(r.teamTotal)} company</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ─── Today: ranked score bars ────────────────────────────────────── */

function TodayRanking({ today, userId, isLoading }) {
  const data = useMemo(() => (today?.agents ?? [])
    .map((a) => ({ ...a, label: a.userId === userId ? 'You' : a.name }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8), [today, userId])
  const anyScore = data.some((d) => d.score > 0)

  return (
    <Card className="p-6 h-full flex flex-col">
      <CardHeader icon={BarChart3} title="Today's ranking" subtitle="Points scored since midnight" />
      {isLoading ? (
        <Skeleton className="flex-1 min-h-[220px]" />
      ) : !anyScore ? (
        <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-2 text-center">
          <BarChart3 className="w-9 h-9 text-[#6B7280]/20" strokeWidth={1.5} />
          <p className="text-sm font-medium text-[#111111] dark:text-white">No points on the board yet today</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Make the first call to take the lead</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={110} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F95C4B0D' }} />
            <Bar dataKey="score" name="Points" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 10, fill: '#6B7280' }}>
              {data.map((d) => (
                <Cell key={d.userId} fill={d.userId === userId ? BRAND : '#D4D4D8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

/* ─── Week / month pipeline trend ─────────────────────────────────── */

function PipelineTrend({ series, isLoading }) {
  const [range, setRange] = useState('week')
  const [scope, setScope] = useState('me')
  const [hidden, setHidden] = useState(() => new Set())

  const days = TREND_RANGES.find((r) => r.key === range).days
  const rows = useMemo(() => (series ?? []).slice(-days).map((d) => ({ date: d.date, ...(d[scope] ?? {}) })), [series, days, scope])
  const totals = STAGES.reduce((acc, s) => ({ ...acc, [s.key]: rows.reduce((sum, r) => sum + (r[s.key] ?? 0), 0) }), {})

  function toggle(key) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const tickFormat = (d) => format(new Date(d), range === 'week' ? 'EEE d' : 'd MMM')

  return (
    <Card className="p-6 h-full">
      <CardHeader
        icon={LineChartIcon}
        title="Pipeline trend"
        subtitle={`Calls, appointments and closed deals per day · last ${days} days`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={SCOPES} value={scope} onChange={setScope} />
            <Segmented options={TREND_RANGES} value={range} onChange={setRange} />
          </div>
        }
      />

      {/* Totals double as the legend — click to hide/show a line */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {STAGES.map((s) => {
          const off = hidden.has(s.key)
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                off
                  ? 'border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] opacity-40'
                  : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#F95C4B]/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA]">{s.label}</span>
              </div>
              <p className="text-lg font-black text-[#111111] dark:text-white mt-0.5">
                {isLoading ? '—' : fmt(totals[s.key])}
              </p>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormat}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              minTickGap={range === 'week' ? 4 : 24}
            />
            {/* Calls run an order of magnitude above outcomes — own axis so outcomes stay readable */}
            <YAxis yAxisId="calls" allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="outcomes" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip labelFormatter={(d) => format(new Date(d), 'EEEE, d MMM')} />} />
            {STAGES.map((s) => (
              <Line
                key={s.key}
                yAxisId={s.key === 'calls' ? 'calls' : 'outcomes'}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.key === 'calls' ? 2 : 2.5}
                strokeDasharray={s.key === 'calls' ? '5 4' : undefined}
                hide={hidden.has(s.key)}
                dot={range === 'week' ? { r: 3, strokeWidth: 0, fill: s.color } : false}
                activeDot={{ r: 5 }}
                animationDuration={600}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="text-[10px] text-[#9CA3AF] mt-2">Dashed line (calls) reads on the left axis; appointments, rented out and sold read on the right.</p>
    </Card>
  )
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function AgencyLeaderboardPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState('week')

  const { data: boardData, isLoading } = useQuery({
    queryKey: ['agency-leaderboard', period],
    queryFn: () =>
      axiosClient.get(`/performance/agency/leaderboard?period=${period}`).then((r) => r.data.data.leaderboard),
    staleTime: 60_000,
  })

  // Same key DailyScoresChart builds for this endpoint, so the score-trend chart below
  // reuses this response instead of fetching it a second time.
  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['performance', 'daily-scores', DAILY_ENDPOINT, SERIES_DAYS],
    queryFn: () => axiosClient.get(DAILY_ENDPOINT, { params: { days: SERIES_DAYS } }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const board = boardData ?? []
  const me = board.find((r) => r.isSelf)
  const myRank = me?.rank ?? null
  const periodNoun = PERIODS.find((p) => p.key === period).noun
  const series = daily?.series ?? []
  const today = series[series.length - 1]
  const agentCount = daily?.agents?.length ?? 0

  return (
    <div className="p-4 sm:p-6 xl:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Leaderboard</h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">See how you rank against your company</p>
          </div>
        </div>

        <div className="flex items-center bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-1 gap-1 self-start sm:self-auto">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === key
                  ? 'bg-white dark:bg-[#2A2A2A] text-[#F95C4B] shadow-sm'
                  : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Position + pipeline for the selected period */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5">
          {isLoading ? (
            <Skeleton className="h-full min-h-[220px]" />
          ) : me && myRank ? (
            <PositionHero me={me} myRank={myRank} total={board.length} board={board} user={user} />
          ) : (
            <Card className="p-6 h-full flex items-center justify-center text-sm text-[#6B7280] dark:text-[#A1A1AA]">
              You're not on this board yet.
            </Card>
          )}
        </div>
        <div className="xl:col-span-7">
          {isLoading ? <Skeleton className="h-full min-h-[220px]" /> : me && <PipelineFunnel me={me} periodNoun={periodNoun} />}
        </div>
      </div>

      {/* Today */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7">
          <TodayComparison today={today} agentCount={agentCount} isLoading={dailyLoading} />
        </div>
        <div className="xl:col-span-5">
          <TodayRanking today={today} userId={user?._id} isLoading={dailyLoading} />
        </div>
      </div>

      {/* Week / month trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PipelineTrend series={series} isLoading={dailyLoading} />
        <Card className="p-6">
          <CardHeader
            icon={TrendingUp}
            title="Score trend by agent — last 30 days"
            subtitle="Your line is highlighted in coral. Click a name below the chart to hide or show it."
          />
          <DailyScoresChart
            days={SERIES_DAYS}
            endpoint={DAILY_ENDPOINT}
            currentUserId={user?._id}
            emptyMessage="No agents to show yet."
          />
        </Card>
      </div>

      {/* Full company table — calls, assigned / own leads by status, appointments */}
      <AgencyLeadsTable
        period={period}
        canOpenRow={(r) => Boolean(r.userId && (user?.isAgencyManager || r.isSelf))}
      />

      {/* Scoring info */}
      <Card className="p-5">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-3">
          How scoring works
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Call Made',                pts: 0.5, color: '#6B7280' },
            { label: 'Cold Lead',                pts: 1,   color: '#6B7280' },
            { label: 'Warm Lead',                pts: 2,   color: '#F59E0B' },
            { label: 'Hot Lead',                 pts: 10,  color: '#EF4444', icon: Flame },
            { label: 'Appointment Attended',     pts: 10,  color: '#F59E0B' },
            { label: 'Lead Closed (flat bonus)', pts: 10,  color: '#8B5CF6' },
            { label: 'Listed',                   pts: 25,  color: '#8B5CF6' },
            { label: 'Rented Out / Sold',        pts: 35,  color: '#16A34A' },
          ].map(({ label, pts, color, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAFAF9] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A]">
              {Icon ? <Icon className="w-3 h-3" style={{ color }} /> : <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
              <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{label}</span>
              <span className="text-xs font-bold" style={{ color }}>+{pts} pt{pts !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#9CA3AF] mt-3">
          Exactly how cold callers are ranked too — same formula, same weights, company-wide.
        </p>
      </Card>
    </div>
  )
}
