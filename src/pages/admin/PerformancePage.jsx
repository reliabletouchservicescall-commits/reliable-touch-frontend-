import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Trophy, Phone, TrendingUp, CheckCircle2, Flame, MessageSquare, Handshake, Users, Building2, Crown,
  ArrowUpRight, ArrowDownRight, Minus, Headphones, UserCheck, Clock, Repeat, Route, Sparkles, Info,
  ChevronRight, Link2, AlertTriangle, LayoutGrid, Target, Activity, Gauge,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts'
import axiosClient from '../../lib/axios'
import { useTheme } from '../../context/ThemeContext'
import LiquidTabs from '../../components/common/LiquidTabs'
import PeriodPicker from '../../components/performance/PeriodPicker'
import DailyScoresChart from '../../components/performance/DailyScoresChart'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import { Card, CardTitle, Skeleton, ChartTooltip, axisTick, CORAL, ErrorBanner } from '../../components/dashboard/DashboardKit'

// One screen for everyone Reliable Touch rates — cold callers, follow-up managers (who
// often also cold call on a second login), company agents and the companies themselves.
// Agents and companies are only judged on leads WE handed them; a company's own
// self-sourced leads never count here. Data: GET /performance/admin-overview.

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'callers', label: 'Cold callers', icon: Headphones },
  { key: 'fum', label: 'Follow-up managers', icon: UserCheck },
  { key: 'agents', label: 'Agents', icon: Handshake },
  { key: 'companies', label: 'Companies', icon: Building2 },
]

const MEDAL = {
  1: { color: '#F59E0B', bg: '#F59E0B1F', label: '1st' },
  2: { color: '#9CA3AF', bg: '#9CA3AF1F', label: '2nd' },
  3: { color: '#B45309', bg: '#B453091F', label: '3rd' },
}
const COMPANY_COLORS = [CORAL, '#0EA5E9', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899']

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }))
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
function fmtHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${fmt(h)} h`
  return `${fmt(h / 24)} days`
}
function delta(now, before) {
  if (!before) return now ? null : 0
  return Math.round(((now - before) / before) * 100)
}

/* ─── Small pieces ───────────────────────────────────────────────────────── */

// Every card on this screen gets the cursor-following light (see .spotlight in index.css)
function SpotCard({ className = '', ...props }) {
  return <Card {...props} className={`spotlight ${className}`} />
}

function Delta({ value }) {
  if (value == null) return <span className="text-[11px] font-semibold text-[#10B981]">new</span>
  if (value === 0) return <span className="inline-flex items-center text-[11px] font-semibold text-[#9CA3AF]"><Minus className="w-3 h-3" />0%</span>
  const up = value > 0
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold ${up ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(value)}%
    </span>
  )
}

function KpiTile({ icon: Icon, label, value, previous, tone, delay, onClick }) {
  return (
    <SpotCard as={onClick ? 'button' : 'div'} type={onClick ? 'button' : undefined} onClick={onClick} delay={delay}
      className={`p-4 text-left ${onClick ? 'mac-lift mac-press group hover:border-[#F95C4B]/40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tone}16` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: tone }} strokeWidth={1.8} />
        </span>
        <Delta value={delta(value, previous)} />
      </div>
      <p className="text-[26px] leading-tight font-bold text-[#111111] dark:text-white tracking-tight mt-3"><AnimatedNumber value={value ?? 0} /></p>
      <p className="text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
      <p className="text-[10px] text-[#9CA3AF] mt-0.5">{fmt(previous)} last period</p>
    </SpotCard>
  )
}

function Avatar({ name, rank, size = 36, tone }) {
  const medal = MEDAL[rank]
  const bg = tone ?? (medal ? medal.color : '#111111')
  return (
    <span className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${!tone && !medal ? 'dark:!bg-white dark:!text-[#111111]' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.34, backgroundColor: bg }}>
      {initials(name)}
    </span>
  )
}

function ScoreBar({ value, max, color = CORAL }) {
  const w = max > 0 ? Math.max(3, (value / max) * 100) : 0
  return (
    <span className="block h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
      <span className="block h-full rounded-full mac-grow-x" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
    </span>
  )
}

function RankBadge({ rank }) {
  const medal = MEDAL[rank]
  return medal
    ? <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black" style={{ backgroundColor: medal.bg, color: medal.color }}>{rank}</span>
    : <span className="w-7 h-7 flex items-center justify-center text-xs font-bold text-[#9CA3AF]">{rank}</span>
}

function Empty({ icon: Icon = Trophy, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
      <Icon className="w-9 h-9 text-[#D4D4D8] dark:text-[#3F3F46]" strokeWidth={1.5} />
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">{text}</p>
    </div>
  )
}

// Top three, 2nd · 1st · 3rd, the winner raised and crowned
function Podium({ entries, unit = 'pts', onOpen }) {
  const [first, second, third] = entries
  const slot = (e, place) => {
    if (!e) return <div className="flex-1" />
    const medal = MEDAL[place]
    const tall = place === 1
    return (
      <button type="button" onClick={() => onOpen?.(e)}
        className={`mac-in mac-press group flex-1 min-w-0 flex flex-col items-center text-center rounded-2xl border px-3 pt-5 transition-all hover:-translate-y-1 ${
          tall ? 'pb-7 border-[#F59E0B]/50 bg-gradient-to-b from-[#F59E0B]/[0.14] to-transparent shadow-[0_24px_50px_-30px_rgba(245,158,11,0.8)]'
            : 'pb-5 border-[#E5E7EB] dark:border-[#2A2A2A] bg-gradient-to-b from-[#F5F5F4] dark:from-[#202020] to-transparent'
        }`}
        style={{ '--d': `${place === 1 ? 0 : place === 2 ? 90 : 160}ms`, marginTop: tall ? 0 : 28 }}>
        {tall ? <Crown className="w-5 h-5 text-[#F59E0B] mac-float mb-1" /> : <span className="h-6" />}
        <span className="relative">
          <Avatar name={e.name} rank={place} size={tall ? 60 : 50} />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[9px] font-black text-white" style={{ backgroundColor: medal.color }}>{medal.label}</span>
        </span>
        <p className="mt-3 text-sm font-bold text-[#111111] dark:text-white truncate max-w-full">{e.name}</p>
        {e.sub && <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-full">{e.sub}</p>}
        <p className="mt-2 text-2xl font-black tracking-tight" style={{ color: medal.color }}><AnimatedNumber value={e.score} format={(n) => fmt(Math.round(n * 10) / 10)} /></p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{unit}</p>
        {e.chips && (
          <div className="flex flex-wrap justify-center gap-1 mt-3">
            {e.chips.map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/70 dark:bg-white/5 text-[#6B7280] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#2A2A2A]">{c}</span>
            ))}
          </div>
        )}
      </button>
    )
  }
  return <div className="flex items-start gap-3">{slot(second, 2)}{slot(first, 1)}{slot(third, 3)}</div>
}

// Generic ranking table — `cols` = [{ key, label, render?, align?, width }]
function RankTable({ rows, cols, maxScore, scoreColor, onOpen, highlight }) {
  const template = ['2.5rem', 'minmax(12rem,1.6fr)', ...cols.map((c) => c.width ?? '4.75rem'), 'minmax(8rem,1fr)'].join(' ')
  return (
    <div className="thin-scroll overflow-x-auto">
      <div style={{ minWidth: 380 + cols.length * 80 }}>
        <div className="grid items-center gap-3 px-5 py-2.5 bg-[#FAFAF9] dark:bg-[#111111] border-y border-[#F1EFEC] dark:border-[#2A2A2A] text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]"
          style={{ gridTemplateColumns: template }}>
          <span>#</span><span>Name</span>
          {cols.map((c) => <span key={c.key} className={c.align === 'left' ? '' : 'text-center'}>{c.label}</span>)}
          <span>Score</span>
        </div>
        <div className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
          {rows.map((r, i) => (
            <div key={r.userId ?? r.agencyId ?? i} onClick={() => onOpen?.(r)}
              className={`mac-in grid items-center gap-3 px-5 py-3 transition-colors ${onOpen ? 'cursor-pointer hover:bg-[#FAFAF9] dark:hover:bg-[#111111]' : ''} ${highlight?.(r) ? 'bg-[#F95C4B]/[0.04]' : ''}`}
              style={{ gridTemplateColumns: template, '--d': `${Math.min(i, 15) * 25}ms` }}>
              <RankBadge rank={r.rank} />
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={r.name} rank={r.rank} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{r.name}</p>
                  {r._sub && <div className="text-[10px] text-[#9CA3AF] truncate">{r._sub}</div>}
                </div>
              </div>
              {cols.map((c) => (
                <div key={c.key} className={`text-sm ${c.align === 'left' ? '' : 'text-center'} text-[#111111] dark:text-white`}>
                  {c.render ? c.render(r) : fmt(r[c.key])}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="flex-1"><ScoreBar value={r.score} max={maxScore} color={scoreColor?.(r)} /></div>
                <span className="w-12 text-right text-sm font-black text-[#111111] dark:text-white tabular-nums">{fmt(r.score)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScoringCard({ items, note }) {
  return (
    <SpotCard className="p-5" delay={200}>
      <p className="flex items-center gap-2 text-xs font-bold text-[#111111] dark:text-white mb-3"><Info className="w-3.5 h-3.5 text-[#F95C4B]" /> How the score works</p>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs">
            <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
            <span className="text-[#6B7280] dark:text-[#A1A1AA]">{s.label}</span>
            <b style={{ color: s.color }}>+{s.pts}</b>
          </span>
        ))}
      </div>
      {note && <p className="text-[11px] text-[#9CA3AF] mt-3">{note}</p>}
    </SpotCard>
  )
}

/* ─── Overview ───────────────────────────────────────────────────────────── */

const TREND_SERIES = [
  { key: 'calls', label: 'Calls', color: '#FDBAAE', type: 'bar' },
  { key: 'leads', label: 'Leads created', color: CORAL, type: 'line' },
  { key: 'followUps', label: 'Follow-ups', color: '#8B5CF6', type: 'line' },
  { key: 'agentWork', label: 'Agent updates', color: '#0EA5E9', type: 'line' },
  { key: 'closed', label: 'Closed', color: '#10B981', type: 'area' },
]

function TrendCard({ trend, isDark }) {
  const [hidden, setHidden] = useState(() => new Set())
  const grid = isDark ? '#2A2A2A' : '#F1EFEC'
  const fmtKey = (k) => (trend.granularity === 'month' ? format(new Date(`${k}-01T00:00:00`), 'MMM yy') : format(new Date(`${k}T00:00:00`), 'd MMM'))
  return (
    <SpotCard className="p-5" delay={120}>
      <CardTitle title="Activity over time" subtitle={`Calls (bars, right axis) against what they turned into · per ${trend.granularity}`} />
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TREND_SERIES.map((s) => {
          const off = hidden.has(s.key)
          return (
            <button key={s.key} type="button" onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${off ? 'opacity-40 border-[#E5E7EB] dark:border-[#2A2A2A]' : 'border-transparent bg-[#F5F5F4] dark:bg-[#202020]'}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[#111111] dark:text-white">{s.label}</span>
            </button>
          )
        })}
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer>
          <ComposedChart data={trend.points} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="perfClosed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="key" tick={axisTick} tickFormatter={fmtKey} axisLine={false} tickLine={false} minTickGap={18} />
            <YAxis yAxisId="left" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip labelFormat={fmtKey} />} cursor={{ fill: isDark ? '#ffffff08' : '#11111106' }} />
            {!hidden.has('calls') && <Bar yAxisId="right" dataKey="calls" name="Calls" fill="#FDBAAE" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={900} />}
            {!hidden.has('closed') && <Area yAxisId="left" type="monotone" dataKey="closed" name="Closed" stroke="#10B981" strokeWidth={2} fill="url(#perfClosed)" animationDuration={900} />}
            {TREND_SERIES.filter((s) => s.type === 'line' && !hidden.has(s.key)).map((s) => (
              <Line key={s.key} yAxisId="left" type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} animationDuration={900} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SpotCard>
  )
}

// Calls → leads → hot → with agents → closed, with the step-to-step conversion
function Funnel({ steps }) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  const tones = ['#FDBAAE', '#FF8C7A', CORAL, '#C93A2B', '#10B981']
  return (
    <SpotCard className="p-5" delay={160}>
      <CardTitle title="Pipeline funnel" subtitle="How this period's work turned into deals" />
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const w = Math.max(10, (Math.log10(s.value + 1) / Math.log10(max + 1)) * 100)
          const prev = steps[i - 1]
          const conv = prev && prev.value ? Math.round((s.value / prev.value) * 1000) / 10 : null
          return (
            <div key={s.key} className="mac-in" style={{ '--d': `${200 + i * 70}ms` }}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-[#111111] dark:text-white">{s.label}</span>
                <span className="flex items-center gap-2">
                  {conv != null && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]">{conv}% of previous</span>}
                  <b className="text-[#111111] dark:text-white tabular-nums">{fmt(s.value)}</b>
                </span>
              </div>
              <div className="h-7 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                <div className="h-full rounded-lg mac-grow-x" style={{ width: `${w}%`, backgroundColor: tones[i] }} />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-[#9CA3AF] mt-3">Bar lengths use a log scale so the smaller steps stay visible next to call volume.</p>
    </SpotCard>
  )
}

function Champion({ icon: Icon, label, who, sub, score, tone, onClick, delay }) {
  return (
    <SpotCard as="button" type="button" onClick={onClick} delay={delay}
      className="mac-lift mac-press group relative overflow-hidden p-4 text-left hover:border-[#F95C4B]/40">
      <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-40" style={{ backgroundColor: tone }} />
      <div className="relative flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: tone }}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      {who ? (
        <div className="relative flex items-center gap-3 mt-3">
          <Avatar name={who} rank={1} size={42} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{who}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{sub}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-[#111111] dark:text-white">{fmt(score)}</p>
            <p className="text-[9px] uppercase tracking-widest text-[#9CA3AF]">pts</p>
          </div>
        </div>
      ) : <p className="relative text-sm text-[#9CA3AF] mt-4">Nobody scored yet</p>}
      <span className="relative flex items-center gap-1 mt-3 text-[11px] font-semibold text-[#F95C4B] opacity-0 group-hover:opacity-100 transition-opacity">See ranking <ChevronRight className="w-3 h-3" /></span>
    </SpotCard>
  )
}

function Overview({ d, isDark, go }) {
  const t = d.totals, p = d.previousTotals
  const topCaller = d.coldCallers[0], topFum = d.followUpManagers[0], topAgent = d.agents[0], topCo = d.companies[0]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile icon={Phone} label="Calls made" value={t.calls} previous={p.calls} tone="#3B82F6" delay={0} onClick={() => go('callers')} />
        <KpiTile icon={TrendingUp} label="Leads created" value={t.leadsCreated} previous={p.leadsCreated} tone={CORAL} delay={40} onClick={() => go('callers')} />
        <KpiTile icon={Flame} label="Turned hot" value={t.hot} previous={p.hot} tone="#EF4444" delay={80} onClick={() => go('fum')} />
        <KpiTile icon={MessageSquare} label="Follow-ups" value={t.followUps} previous={p.followUps} tone="#8B5CF6" delay={120} onClick={() => go('fum')} />
        <KpiTile icon={Handshake} label="Handed to agents" value={t.handedToAgents} previous={p.handedToAgents} tone="#0EA5E9" delay={160} onClick={() => go('agents')} />
        <KpiTile icon={CheckCircle2} label="Closed" value={t.closed} previous={p.closed} tone="#10B981" delay={200} onClick={() => go('companies')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Champion icon={Headphones} label="Top cold caller" who={topCaller?.score ? topCaller.name : null} sub={topCaller ? `${fmt(topCaller.totalCalls)} calls · ${topCaller.leadsCreated} leads` : ''} score={topCaller?.score} tone={CORAL} delay={60} onClick={() => go('callers')} />
        <Champion icon={UserCheck} label="Top follow-up manager" who={topFum?.score ? topFum.name : null} sub={topFum ? `${topFum.followUps} follow-ups · ${topFum.closed} closed` : ''} score={topFum?.score} tone="#8B5CF6" delay={100} onClick={() => go('fum')} />
        <Champion icon={Handshake} label="Top agent" who={topAgent?.score ? topAgent.name : null} sub={topAgent ? `${topAgent.agency} · ${topAgent.closed} closed` : ''} score={topAgent?.score} tone="#0EA5E9" delay={140} onClick={() => go('agents')} />
        <Champion icon={Building2} label="Top company" who={topCo?.score ? topCo.name : null} sub={topCo ? `${fmt(topCo.scorePerAgent)} pts per agent · ${topCo.closeRate}% close rate` : ''} score={topCo?.score} tone="#10B981" delay={180} onClick={() => go('companies')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5 items-start">
        <TrendCard trend={d.trend} isDark={isDark} />
        <Funnel steps={d.funnel} />
      </div>
    </div>
  )
}

/* ─── Cold callers ───────────────────────────────────────────────────────── */

function CallerBreakdownChart({ rows, weights, isDark }) {
  const data = rows.slice(0, 10).map((r) => ({
    name: r.name.split(' ')[0],
    full: r.name,
    Calls: r.totalCalls * weights.call,
    'Lead quality': r.leadScore,
    Closed: r.leadsClosed * weights.closed,
    Appointments: r.appointmentsAttended * weights.appointmentAttended,
  }))
  return (
    <SpotCard className="p-5" delay={120}>
      <CardTitle title="Where the points come from" subtitle="Top 10 — calling effort vs lead quality vs deals" />
      <div className="h-[300px]">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 6, bottom: 0 }} barCategoryGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#F1EFEC'} horizontal={false} />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 11 }} width={70} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? '#ffffff08' : '#11111106' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Calls" stackId="a" fill="#FDBAAE" animationDuration={900} />
            <Bar dataKey="Lead quality" stackId="a" fill={CORAL} animationDuration={900} />
            <Bar dataKey="Closed" stackId="a" fill="#10B981" animationDuration={900} />
            <Bar dataKey="Appointments" stackId="a" fill="#8B5CF6" radius={[0, 6, 6, 0]} animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SpotCard>
  )
}

function ColdCallers({ d, isDark, openUser }) {
  const rows = d.coldCallers
  const w = d.weights.coldCaller
  const max = rows[0]?.score ?? 0
  if (!rows.length) return <SpotCard className="p-5"><Empty text="No active cold callers" /></SpotCard>
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        <SpotCard className="p-5" delay={60}>
          <CardTitle title="Top cold callers" subtitle="Calls, lead quality and deals closed this period" />
          <Podium entries={rows.slice(0, 3).map((r) => ({
            ...r, sub: r.alsoFollowUpManager ? 'Also a follow-up manager' : `${fmt(r.totalCalls)} calls`,
            chips: [`${r.leadsCreated} leads`, `${r.hotCount} hot`, `${r.leadsClosed} closed`],
          }))} onOpen={(e) => openUser(e.userId)} />
        </SpotCard>
        <CallerBreakdownChart rows={rows} weights={w} isDark={isDark} />
      </div>

      <SpotCard className="overflow-hidden" delay={160}>
        <div className="px-5 pt-5"><CardTitle title="Full ranking" subtitle="Click someone to open their profile · conversion = leads per 100 calls" /></div>
        <RankTable
          rows={rows.map((r) => ({
            ...r,
            _sub: r.alsoFollowUpManager
              ? <span className="inline-flex items-center gap-1 text-[#8B5CF6] font-semibold"><Link2 className="w-2.5 h-2.5" /> Also follow-up manager</span>
              : null,
          }))}
          maxScore={max}
          onOpen={(r) => openUser(r.userId)}
          cols={[
            { key: 'totalCalls', label: 'Calls' },
            { key: 'leadsCreated', label: 'Leads' },
            { key: 'conv', label: 'Conv.', render: (r) => <span className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{r.totalCalls ? `${fmt((r.leadsCreated / r.totalCalls) * 100)}` : '—'}</span> },
            { key: 'hotCount', label: 'Hot', render: (r) => <span className={r.hotCount ? 'font-bold text-[#EF4444]' : 'text-[#9CA3AF]'}>{r.hotCount}</span> },
            { key: 'warmCount', label: 'Warm' },
            { key: 'leadsClosed', label: 'Closed', render: (r) => <span className={r.leadsClosed ? 'font-bold text-[#10B981]' : 'text-[#9CA3AF]'}>{r.leadsClosed}</span> },
            { key: 'appointmentsAttended', label: 'Appts' },
          ]}
        />
      </SpotCard>

      <SpotCard className="p-5" delay={200}>
        <CardTitle title="Daily score — last 30 days" subtitle="One line per cold caller. Click a name under the chart to isolate it." />
        <DailyScoresChart days={30} />
      </SpotCard>

      <ScoringCard
        items={[
          { icon: Phone, label: 'Call', pts: w.call, color: '#3B82F6' },
          { icon: Sparkles, label: 'Cold lead', pts: w.leadStatus.cold, color: '#9CA3AF' },
          { icon: Sparkles, label: 'Warm lead', pts: w.leadStatus.warm, color: '#F59E0B' },
          { icon: Flame, label: 'Hot lead', pts: w.leadStatus.hot, color: '#EF4444' },
          { icon: CheckCircle2, label: 'Listed', pts: w.leadStatus.listed, color: '#8B5CF6' },
          { icon: CheckCircle2, label: 'Rented / sold', pts: w.leadStatus.rented_out, color: '#10B981' },
          { icon: Trophy, label: 'Lead closed', pts: w.closed, color: CORAL },
          { icon: Clock, label: 'Appointment attended', pts: w.appointmentAttended, color: '#0EA5E9' },
        ]}
        note="Lead points use each lead's current status. 5 warm or 10 cold leads are worth one hot lead."
      />
    </div>
  )
}

/* ─── Follow-up managers ─────────────────────────────────────────────────── */

function FumCard({ f, max, delay, onOpen }) {
  const followPct = f.score ? (f.followUpScore / f.score) * 100 : 0
  const stat = (icon, label, value, tone) => ({ icon, label, value, tone })
  const follow = [
    stat(MessageSquare, 'Follow-ups', f.followUps, '#8B5CF6'),
    stat(Users, 'Leads worked', f.leadsWorked, '#111111'),
    stat(Repeat, 'Status moves', f.statusMoves, '#F59E0B'),
    stat(CheckCircle2, 'Closed', f.closed, '#10B981'),
    stat(Route, 'Routed', f.routed, '#0EA5E9'),
  ]
  const calling = [
    stat(Phone, 'Calls', f.calls, '#3B82F6'),
    stat(TrendingUp, 'Leads', f.leadsCreated, CORAL),
    stat(Flame, 'Hot', f.hotCreated, '#EF4444'),
  ]
  const Stat = ({ s }) => (
    <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]"><s.icon className={`w-3 h-3 ${s.tone === '#111111' ? 'dark:!text-white' : ''}`} style={{ color: s.tone }} /> {s.label}</p>
      <p className="text-base font-bold text-[#111111] dark:text-white tabular-nums">{fmt(s.value)}</p>
    </div>
  )
  return (
    <SpotCard delay={delay} className="p-5 relative overflow-hidden">
      {f.rank === 1 && <span className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-[#F59E0B]/20 blur-2xl" />}
      <div className="relative flex items-start gap-3">
        <button type="button" onClick={onOpen} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
          <Avatar name={f.name} rank={f.rank} size={46} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#111111] dark:text-white truncate group-hover:text-[#F95C4B] transition-colors">
              {f.rank === 1 && <Crown className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0" />}{f.name}
            </p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">#{f.rank} of the follow-up team</p>
          </div>
        </button>
        <div className="text-right">
          <p className="text-2xl font-black text-[#111111] dark:text-white tabular-nums">{fmt(f.score)}</p>
          <p className="text-[9px] uppercase tracking-widest text-[#9CA3AF]">total pts</p>
        </div>
      </div>

      {/* Split: follow-up work vs calling */}
      <div className="relative mt-4">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-[#F5F5F4] dark:bg-[#2A2A2A]" style={{ width: `${max ? Math.max(8, (f.score / max) * 100) : 0}%` }}>
          <span className="h-full bg-[#8B5CF6] mac-grow-x" style={{ width: `${followPct}%` }} />
          <span className="h-full bg-[#FDBAAE] mac-grow-x" style={{ width: `${100 - followPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] mt-1.5">
          <span className="flex items-center gap-1 text-[#8B5CF6] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" /> Follow-up {fmt(f.followUpScore)}</span>
          <span className="flex items-center gap-1 text-[#E05A48] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#FDBAAE]" /> Calling {fmt(f.callingScore)}</span>
        </div>
      </div>

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Follow-up work</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1.5">{follow.map((s) => <Stat key={s.label} s={s} />)}</div>

      <p className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
        Calling{f.linkedCallers.length ? <> as <span className="normal-case tracking-normal text-[#111111] dark:text-white">{f.linkedCallers.map((c) => c.name).join(', ')}</span></> : null}
      </p>
      {f.linkedCallers.length ? (
        <div className="grid grid-cols-3 gap-2 mt-1.5">{calling.map((s) => <Stat key={s.label} s={s} />)}</div>
      ) : (
        <p className="mt-1.5 text-xs text-[#9CA3AF] italic">No cold-caller login found for this person</p>
      )}
    </SpotCard>
  )
}

function FollowUpManagers({ d, isDark, openUser }) {
  const rows = d.followUpManagers
  const w = d.weights.followUp
  if (!rows.length) return <SpotCard className="p-5"><Empty icon={UserCheck} text="No active follow-up managers" /></SpotCard>
  const max = rows[0]?.score ?? 0
  const chart = rows.map((f) => ({ name: f.name.split(' ')[0], 'Follow-ups': f.followUps, 'Status moves': f.statusMoves, Closed: f.closed, Lost: f.lost }))
  return (
    <div className="space-y-5">
      <SpotCard className="p-4 flex items-start gap-3 bg-gradient-to-r from-[#8B5CF6]/[0.07] to-transparent" delay={0}>
        <Link2 className="w-4 h-4 text-[#8B5CF6] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
          Follow-up managers often cold call too, on a separate cold-caller login. Each card adds the calling that person did
          (matched by phone number or name) to their follow-up work, so the score reflects <b className="text-[#111111] dark:text-white">everything they did</b>.
          The same calls also count on the Cold callers tab, where they're marked "Also follow-up manager".
        </p>
      </SpotCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((f, i) => <FumCard key={f.userId} f={f} max={max} delay={60 + i * 60} onOpen={() => openUser(f.userId)} />)}
      </div>

      <SpotCard className="p-5" delay={220}>
        <CardTitle title="Follow-up outcomes" subtitle="What each follow-up manager did with the hot leads this period" />
        <div className="h-[260px]">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#F1EFEC'} vertical={false} />
              <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? '#ffffff08' : '#11111106' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Follow-ups" fill="#8B5CF6" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={900} />
              <Bar dataKey="Status moves" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={900} />
              <Bar dataKey="Closed" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={900} />
              <Bar dataKey="Lost" fill="#D4D4D8" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SpotCard>

      <ScoringCard
        items={[
          { icon: MessageSquare, label: 'Follow-up comment', pts: w.followUp, color: '#8B5CF6' },
          { icon: Repeat, label: 'Status move', pts: w.statusMove, color: '#F59E0B' },
          { icon: CheckCircle2, label: 'Lead closed by them', pts: w.closed, color: '#10B981' },
          { icon: Route, label: 'Lead routed to an agent/company', pts: w.routed, color: '#0EA5E9' },
          { icon: Phone, label: 'Plus their cold-caller score', pts: 'calling', color: CORAL },
        ]}
        note="Only Reliable Touch leads count. Companies' own self-sourced leads are left out."
      />
    </div>
  )
}

/* ─── Agents ─────────────────────────────────────────────────────────────── */

function Agents({ d, isDark, openUser }) {
  const [company, setCompany] = useState('all')
  const [scope, setScope] = useState('overall') // overall | company
  const colorOf = useMemo(() => {
    const m = new Map(d.companies.map((c, i) => [c.agencyId, COMPANY_COLORS[i % COMPANY_COLORS.length]]))
    return (id) => m.get(id) ?? '#9CA3AF'
  }, [d.companies])
  const w = d.weights.agent
  const companiesWithAgents = d.companies.filter((c) => c.agents > 0)
  const filtered = company === 'all' ? d.agents : d.agents.filter((a) => a.agencyId === company)
  const rows = filtered.map((a) => ({ ...a, rank: company !== 'all' || scope === 'company' ? a.companyRank : a.rank }))
  const sorted = scope === 'company' && company === 'all'
    ? [...rows].sort((a, b) => (a.agency.localeCompare(b.agency)) || a.rank - b.rank)
    : rows
  const max = Math.max(...rows.map((r) => r.score), 0)
  const chart = filtered.filter((a) => a.score > 0).slice(0, 12).map((a) => ({ name: a.name.split(' ')[0], full: a.name, Score: a.score, agencyId: a.agencyId }))
  const awaiting = filtered.reduce((s, a) => s + a.awaitingFirstTouch, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1.5">
          {[{ agencyId: 'all', name: 'All companies' }, ...companiesWithAgents].map((c) => {
            const active = company === c.agencyId
            const tone = c.agencyId === 'all' ? '#111111' : colorOf(c.agencyId)
            return (
              <button key={c.agencyId} type="button" onClick={() => setCompany(c.agencyId)}
                className={`mac-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active ? 'text-white border-transparent shadow-sm' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white bg-white dark:bg-[#181818] hover:border-[#F95C4B]/40'
                } ${active && tone === '#111111' ? 'dark:!bg-white dark:!text-[#111111]' : ''}`}
                style={active ? { backgroundColor: tone } : undefined}>
                {c.agencyId !== 'all' && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? '#fff' : tone }} />}
                {c.name}{c.agents != null && <span className="opacity-70">· {c.agents}</span>}
              </button>
            )
          })}
        </div>
        {company === 'all' && (
          <div className="ml-auto inline-flex p-1 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-semibold">
            {[['overall', 'Rank across companies'], ['company', 'Rank within company']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setScope(k)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${scope === k ? 'bg-[#F95C4B] text-white' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <SpotCard className="p-4 flex items-start gap-3 bg-gradient-to-r from-[#0EA5E9]/[0.07] to-transparent" delay={0}>
        <Info className="w-4 h-4 text-[#0EA5E9] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
          Agents are rated only on <b className="text-[#111111] dark:text-white">leads Reliable Touch handed them</b>. A company's own self-sourced leads don't count.
          {awaiting > 0 && <> <span className="text-[#DC2626] font-semibold">{awaiting} handed-over lead{awaiting === 1 ? ' hasn\'t' : 's haven\'t'} been touched yet</span> (no comment or call).</>}
        </p>
      </SpotCard>

      {!rows.length ? <SpotCard className="p-5"><Empty icon={Handshake} text="No agents in this company yet" /></SpotCard> : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
            <SpotCard className="p-5" delay={60}>
              <CardTitle title={company === 'all' ? 'Top agents across all companies' : `Top agents at ${d.companies.find((c) => c.agencyId === company)?.name}`} subtitle="Deals closed carry the most weight" />
              <Podium entries={[...filtered].sort((a, b) => b.score - a.score).slice(0, 3).map((a) => ({
                ...a, sub: `${a.agency} · #${a.companyRank} of ${a.companySize}`,
                chips: [`${a.received} received`, `${a.closed} closed`, `${a.closeRate}% close rate`],
              }))} onOpen={(e) => openUser(e.userId)} />
            </SpotCard>
            <SpotCard className="p-5" delay={120}>
              <CardTitle title="Score by agent" subtitle="Coloured by company" />
              {chart.length ? (
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, left: 6, bottom: 0 }} barCategoryGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#F1EFEC'} horizontal={false} />
                      <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 11 }} width={70} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? '#ffffff08' : '#11111106' }} />
                      <Bar dataKey="Score" radius={[0, 6, 6, 0]} animationDuration={900}>
                        {chart.map((c) => <Cell key={c.full} fill={colorOf(c.agencyId)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty icon={Activity} text="No agent has scored this period" />}
            </SpotCard>
          </div>

          <SpotCard className="overflow-hidden" delay={160}>
            <div className="px-5 pt-5">
              <CardTitle title={scope === 'company' && company === 'all' ? 'Ranking within each company' : 'Full ranking'}
                subtitle="Response = average time from being handed a lead to the agent's first comment or call" />
            </div>
            <RankTable
              rows={sorted.map((a) => ({
                ...a,
                _sub: <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorOf(a.agencyId) }} />{a.agency}{a.isManager ? ' · manager' : ''} · #{a.companyRank} of {a.companySize} in company</span>,
              }))}
              maxScore={max}
              scoreColor={(r) => colorOf(r.agencyId)}
              onOpen={(r) => openUser(r.userId)}
              cols={[
                { key: 'received', label: 'Received' },
                { key: 'active', label: 'Active' },
                { key: 'calls', label: 'Calls' },
                { key: 'comments', label: 'Updates' },
                { key: 'closed', label: 'Closed', render: (r) => <span className={r.closed ? 'font-bold text-[#10B981]' : 'text-[#9CA3AF]'}>{r.closed}</span> },
                { key: 'lost', label: 'Lost', render: (r) => <span className={r.lost ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}>{r.lost}</span> },
                { key: 'closeRate', label: 'Close %', render: (r) => <span className="text-xs font-semibold">{r.totalHeld ? `${r.closeRate}%` : '—'}</span> },
                { key: 'resp', label: 'Response', width: '5.5rem', render: (r) => (
                  <span className={`text-xs font-semibold ${r.avgResponseHours == null ? 'text-[#9CA3AF]' : r.avgResponseHours <= 24 ? 'text-[#10B981]' : r.avgResponseHours <= 72 ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>
                    {fmtHours(r.avgResponseHours)}
                    {r.awaitingFirstTouch > 0 && <span className="block text-[9px] font-normal text-[#DC2626]" title="Handed-over leads with no comment or call yet"><AlertTriangle className="inline w-2.5 h-2.5" /> {r.awaitingFirstTouch} untouched</span>}
                  </span>
                ) },
              ]}
            />
          </SpotCard>
        </>
      )}

      <ScoringCard
        items={[
          { icon: Phone, label: 'Call on our lead', pts: w.call, color: '#3B82F6' },
          { icon: MessageSquare, label: 'Update / comment', pts: w.comment, color: '#8B5CF6' },
          { icon: Target, label: 'Site visit', pts: w.visit, color: '#F59E0B' },
          { icon: Clock, label: 'Appointment attended', pts: w.appointmentAttended, color: '#0EA5E9' },
          { icon: CheckCircle2, label: 'Listed', pts: w.listed, color: '#8B5CF6' },
          { icon: Trophy, label: 'Rented out / sold', pts: w.rentedOrSold, color: '#10B981' },
        ]}
        note="Counted for the selected period, on Reliable Touch leads only."
      />
    </div>
  )
}

/* ─── Companies ──────────────────────────────────────────────────────────── */

function CompanyCard({ c, color, delay, onAgents }) {
  const ring = 2 * Math.PI * 30
  return (
    <SpotCard delay={delay} className="p-5 relative overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1A` }}>
          <Building2 className="w-5 h-5" style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-[#111111] dark:text-white truncate">
            {c.rank === 1 && c.score > 0 && <Crown className="w-3.5 h-3.5 text-[#F59E0B]" />}{c.name}
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">#{c.rank} · {c.agents} agent{c.agents === 1 ? '' : 's'} · {c.activeAgents} active this period</p>
        </div>
        {/* Close-rate ring */}
        <div className="relative w-[72px] h-[72px] flex-shrink-0">
          <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="7" className="stroke-[#F5F5F4] dark:stroke-[#2A2A2A]" />
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="7" strokeLinecap="round" stroke={color}
              strokeDasharray={ring} strokeDashoffset={ring * (1 - c.closeRate / 100)} style={{ transition: 'stroke-dashoffset 1.1s var(--ease-mac)' }} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-sm text-[#111111] dark:text-white">{c.closeRate}%</b>
            <span className="text-[8px] uppercase tracking-wider text-[#9CA3AF]">closed</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          ['Received', c.received, 'this period'],
          ['Closed', c.closed, 'this period'],
          ['Score / agent', c.scorePerAgent, 'pts'],
          ['With agents', c.active, 'open leads'],
          ['Awaiting agent', c.awaitingAgent, 'not assigned'],
          ['Response', fmtHours(c.avgResponseHours), 'first touch'],
        ].map(([l, v, s]) => (
          <div key={l} className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] px-2.5 py-2">
            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{l}</p>
            <p className={`text-base font-bold tabular-nums ${l === 'Awaiting agent' && v > 0 ? 'text-[#DC2626]' : 'text-[#111111] dark:text-white'}`}>{typeof v === 'number' ? fmt(v) : v}</p>
            <p className="text-[9px] text-[#9CA3AF]">{s}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1EFEC] dark:border-[#2A2A2A]">
        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
          {c.topAgent ? <>Top agent <b className="text-[#111111] dark:text-white">{c.topAgent.name}</b> · {fmt(c.topAgent.score)} pts</> : 'No agent has scored yet'}
        </p>
        {c.agents > 0 && (
          <button type="button" onClick={onAgents} className="flex items-center gap-1 text-[11px] font-semibold text-[#F95C4B] hover:gap-1.5 transition-all">Agents <ChevronRight className="w-3 h-3" /></button>
        )}
      </div>
    </SpotCard>
  )
}

function Companies({ d, isDark, go }) {
  const list = d.companies
  if (!list.length) return <SpotCard className="p-5"><Empty icon={Building2} text="No companies yet" /></SpotCard>
  const colorOf = (i) => COMPANY_COLORS[i % COMPANY_COLORS.length]
  // Radar: each dimension scaled 0–100 against the best company
  const maxBy = (k) => Math.max(...list.map((c) => c[k] ?? 0), 1)
  const fastest = Math.min(...list.map((c) => c.avgResponseHours ?? Infinity))
  const dims = [
    ['Close rate', (c) => c.closeRate],
    ['Score / agent', (c) => (c.scorePerAgent / maxBy('scorePerAgent')) * 100],
    ['Volume', (c) => (c.received / maxBy('received')) * 100],
    ['Activity', (c) => (((c.calls + c.comments + c.visits) / Math.max(c.agents, 1)) / Math.max(...list.map((x) => (x.calls + x.comments + x.visits) / Math.max(x.agents, 1)), 1)) * 100],
    ['Speed', (c) => (c.avgResponseHours == null || !Number.isFinite(fastest) ? 0 : (fastest / Math.max(c.avgResponseHours, 0.1)) * 100)],
  ]
  const radar = dims.map(([label, f]) => {
    const row = { dim: label }
    list.forEach((c) => { row[c.name] = Math.round(Math.max(0, Math.min(100, f(c)))) })
    return row
  })
  const bars = list.map((c) => ({ name: c.name, Received: c.received, Closed: c.closed, Lost: c.lost, 'Awaiting agent': c.awaitingAgent }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        {list.map((c, i) => <CompanyCard key={c.agencyId} c={c} color={colorOf(i)} delay={i * 70} onAgents={() => go('agents')} />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <SpotCard className="p-5" delay={160}>
          <CardTitle title="Company comparison" subtitle="Each axis is scaled against the best company (100 = best)" />
          <div className="h-[320px]">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke={isDark ? '#2A2A2A' : '#E5E7EB'} />
                <PolarAngleAxis dataKey="dim" tick={{ ...axisTick, fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                {list.map((c, i) => (
                  <Radar key={c.agencyId} name={c.name} dataKey={c.name} stroke={colorOf(i)} fill={colorOf(i)} fillOpacity={0.18} strokeWidth={2} animationDuration={900} />
                ))}
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </SpotCard>
        <SpotCard className="p-5" delay={200}>
          <CardTitle title="Leads in, deals out" subtitle="This period, Reliable Touch leads only" />
          <div className="h-[320px]">
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#F1EFEC'} vertical={false} />
                <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? '#ffffff08' : '#11111106' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Received" fill="#0EA5E9" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900} />
                <Bar dataKey="Closed" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900} />
                <Bar dataKey="Lost" fill="#D4D4D8" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900} />
                <Bar dataKey="Awaiting agent" fill={CORAL} radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SpotCard>
      </div>
      <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" /> Companies are ranked by score per agent, so a small team that works its leads well can beat a bigger one. Close rate covers every lead we've handed them.</p>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function PerformancePage() {
  const navigate = useNavigate()
  const { theme } = useTheme() ?? {}
  const isDark = theme === 'dark'
  const [params, setParams] = useSearchParams()
  const view = TABS.some((t) => t.key === params.get('view')) ? params.get('view') : 'overview'
  const go = (key) => setParams((p) => { const n = new URLSearchParams(p); if (key === 'overview') n.delete('view'); else n.set('view', key); return n }, { replace: true })
  const [period, setPeriod] = useState('month')
  const [month, setMonth] = useState('')
  const [year, monthNum] = month ? month.split('-').map(Number) : [undefined, undefined]

  const { data: d, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['performance', 'admin-overview', period, month],
    queryFn: () => axiosClient.get('/performance/admin-overview', { params: month ? { month: monthNum, year } : { period } }).then((r) => r.data.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  const openUser = (id) => navigate(`/admin/users/${id}`, { state: { from: 'performance' } })
  // Feed the cursor position to whichever card is under it, for its light
  const trackSpotlight = (e) => {
    const card = e.target.closest?.('.spotlight')
    if (!card) return
    const r = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - r.left}px`)
    card.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div className="h-full overflow-y-auto thin-scroll bg-[#FAFAF9] dark:bg-[#0B0B0B]" onMouseMove={trackSpotlight}>
      <div className="relative p-4 sm:p-6 xl:p-8 space-y-5">
        {/* Slow aurora behind the header, in the logo's coral */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden -z-0">
          <span className="aurora w-[520px] h-[260px] -top-24 left-[8%] bg-[#F95C4B]/25 dark:bg-[#F95C4B]/20" />
          <span className="aurora w-[420px] h-[220px] -top-16 right-[12%] bg-[#FF8C7A]/30 dark:bg-[#FF8C7A]/15" style={{ animationDelay: '-7s', animationDuration: '26s' }} />
          <span className="aurora w-[360px] h-[200px] top-10 left-[45%] bg-[#8B5CF6]/15 dark:bg-[#8B5CF6]/15" style={{ animationDelay: '-14s', animationDuration: '30s' }} />
          <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FAFAF9] dark:to-[#0B0B0B]" />
        </div>
        {/* Header */}
        <div className="glass-in relative flex flex-col lg:flex-row lg:items-center gap-4" style={{ '--d': '0ms' }}>
          <div className="flex items-center gap-3.5">
            <div className="liquid-pill relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F95C4B] to-[#FF8C7A] flex items-center justify-center flex-shrink-0 shadow-[0_12px_28px_-12px_rgba(249,92,75,0.8)]">
              <Trophy className="w-6 h-6 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Performance</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                Cold callers, follow-up managers, agents and companies, rated on Reliable Touch work
                {d?.from && d?.to && <span className="text-[#9CA3AF]"> · {format(new Date(d.from), 'd MMM')} – {format(new Date(d.to), 'd MMM yyyy')}</span>}
              </p>
            </div>
          </div>
          <div className="lg:ml-auto flex items-center gap-2">
            {isFetching && !isLoading && <span className="w-4 h-4 rounded-full border-2 border-[#F95C4B]/30 border-t-[#F95C4B] animate-spin" />}
            <PeriodPicker period={period} onPeriod={(p) => { setPeriod(p); setMonth('') }} month={month} onMonth={setMonth} />
          </div>
        </div>

        <div className="glass-in relative" style={{ '--d': '80ms' }}><LiquidTabs tabs={TABS} value={view} onChange={go} /></div>

        {isError ? <ErrorBanner onRetry={refetch} /> : isLoading || !d ? (
          <div className="relative space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[128px]" />)}</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><Skeleton className="h-[340px]" /><Skeleton className="h-[340px]" /></div>
          </div>
        ) : (
          <div key={view} className={`glass-in relative transition-opacity duration-300 ${isFetching ? 'opacity-70' : ''}`} style={{ '--d': '120ms' }}>
            {view === 'overview' && <Overview d={d} isDark={isDark} go={go} />}
            {view === 'callers' && <ColdCallers d={d} isDark={isDark} openUser={openUser} />}
            {view === 'fum' && <FollowUpManagers d={d} isDark={isDark} openUser={openUser} />}
            {view === 'agents' && <Agents d={d} isDark={isDark} openUser={openUser} />}
            {view === 'companies' && <Companies d={d} isDark={isDark} go={go} />}
          </div>
        )}
      </div>
    </div>
  )
}
