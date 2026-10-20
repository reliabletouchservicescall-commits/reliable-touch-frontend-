import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'
import {
  Phone, CalendarClock, Flame, Home, ArrowRight, ArrowUpRight, ArrowDownRight,
  PhoneCall, AlertTriangle, UserX, Bell, Ban, Target, MapPin, Activity,
  CheckCircle2, UserPlus, CalendarCheck, Sparkles, X, Inbox, Clock, TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Line, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import AnimatedNumber from './AnimatedNumber'
import SouthAfricaMap from './SouthAfricaMap'
import capeTownCoast from '../../assets/images/cape-town-coast.jpg'
import sandtonSkyline from '../../assets/images/sandton-skyline.jpg'

// Shared building blocks for the admin and agency dashboards — one look, one set of
// macOS-style motions (.mac-* in index.css), whichever role is looking.

/* ─── Brand palette (from the logo: coral, black, white) ─────────────────── */
export const CORAL = '#F95C4B'
export const CORAL_2 = '#FF8C7A'
export const CORAL_3 = '#FDBAAE'
export const STATUS_COLORS = {
  cold: '#9CA3AF', warm: '#F59E0B', hot: '#EF4444', still_negotiating: '#FF8C7A',
  listed: '#8B5CF6', rented_out: '#10B981', sold: CORAL, lost: '#D4D4D8',
}
export const STATUS_LABEL = {
  cold: 'Cold', warm: 'Warm', hot: 'Hot', still_negotiating: 'Negotiating',
  listed: 'Listed', rented_out: 'Rented', sold: 'Sold', lost: 'Lost',
}

const QUOTES = [
  'More conversations. More opportunities. More deals.',
  'Every call is a door. Knock on more of them.',
  'The fortune is in the follow-up.',
  'Great listings start with a great first call.',
]

/* ─── Small building blocks ──────────────────────────────────────────────── */

export function Card({ className = '', delay = 0, children, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`mac-in bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] ${className}`}
      style={{ '--d': `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function CardTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-[15px] font-bold text-[#111111] dark:text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function LinkButton({ to, children }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:text-[#E84B3A] whitespace-nowrap"
    >
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
    </button>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

export function ChartTooltip({ active, payload, label, labelFormat }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl bg-white/95 dark:bg-[#111111]/95 backdrop-blur border border-[#E5E7EB] dark:border-[#2A2A2A] min-w-[140px]">
      {label != null && <p className="font-semibold text-[#111111] dark:text-white mb-1">{labelFormat ? labelFormat(label) : label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? p.payload?.fill }} />
          <span className="text-[#6B7280] dark:text-[#A1A1AA]">{p.name}</span>
          <span className="ml-auto pl-3 font-bold text-[#111111] dark:text-white">{Number(p.value ?? 0).toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

export const axisTick = { fontSize: 10, fill: '#9CA3AF' }

export function ErrorBanner({ onRetry }) {
  return (
    <div className="mac-in flex items-center gap-3 p-4 rounded-2xl bg-[#DC2626]/8 border border-[#DC2626]/25 text-sm text-[#DC2626]">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">Couldn't load the dashboard numbers. Check the connection to the server.</span>
      <button type="button" onClick={onRetry} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#DC2626] text-white hover:opacity-90">Retry</button>
    </div>
  )
}

/* ─── Hero & milestone ───────────────────────────────────────────────────── */

// `stats` = [{ icon, label, value, to? }] — the frosted chips along the bottom of the photo
export function Hero({ user, now, subtitle = "Here's what's happening with your leads today.", stats = [], eyebrow }) {
  const navigate = useNavigate()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const quote = QUOTES[now.getDate() % QUOTES.length]
  return (
    <div className="mac-in relative overflow-hidden rounded-2xl min-h-[220px] bg-[#111111] text-white" style={{ '--d': '0ms' }}>
      <img src={capeTownCoast} alt="Cape Town coastline at sunset" className="mac-ken-burns absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/95 via-[#111111]/70 to-[#111111]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#F95C4B]/25 to-transparent" />
      <div className="relative h-full p-6 sm:p-7 flex flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F95C4B] mb-1">{eyebrow}</p>}
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">{greeting}, {user?.firstName ?? 'there'}</h1>
            <p className="text-sm text-white/75 mt-1">{subtitle}</p>
            <p className="inline-flex items-center gap-1.5 mt-3 text-xs text-white/80 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur">
              <CalendarClock className="w-3.5 h-3.5" /> {format(now, 'EEEE, d MMMM yyyy')}
            </p>
          </div>
          <blockquote className="hidden md:block flex-shrink-0 max-w-[220px] text-right">
            <p className="text-sm italic text-white/90 leading-relaxed">&ldquo;{quote}&rdquo;</p>
            <p className="text-[11px] text-[#F95C4B] font-semibold mt-1">— Reliable Touch</p>
          </blockquote>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((s, i) => {
            const Tag = s.to ? 'button' : 'span'
            return (
              <Tag key={s.label} type={s.to ? 'button' : undefined} onClick={s.to ? () => navigate(s.to) : undefined}
                className={`mac-pop inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/12 backdrop-blur text-xs border border-white/15 ${s.to ? 'mac-press hover:bg-white/20 transition-colors' : ''}`}
                style={{ '--d': `${300 + i * 80}ms` }}>
                <s.icon className="w-3.5 h-3.5 text-[#F95C4B]" />
                <span className="font-bold"><AnimatedNumber value={s.value ?? 0} /></span>
                <span className="text-white/70">{s.label}</span>
              </Tag>
            )
          })}
        </div>
      </div>
      <span className="absolute bottom-2 right-3 text-[9px] text-white/40">Photo: Julie Holmes · Pexels</span>
    </div>
  )
}

export function Milestone({ milestone, to }) {
  const navigate = useNavigate()
  const pct = milestone ? Math.min(100, Math.round((milestone.current / milestone.target) * 100)) : 0
  return (
    <Card delay={60} className={`p-5 flex flex-col justify-between text-left ${to ? 'mac-lift mac-press hover:border-[#F95C4B]/40' : ''}`}
      as={to ? 'button' : 'div'} type={to ? 'button' : undefined} onClick={to ? () => navigate(to) : undefined}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center mac-float">
          <Target className="w-4 h-4 text-[#F95C4B]" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Next milestone</p>
      </div>
      <div className="mt-4">
        <p className="text-lg font-bold text-[#111111] dark:text-white leading-snug">
          {milestone ? `${milestone.target.toLocaleString()} ${milestone.unit ?? 'closed deals this quarter'}` : '—'}
        </p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">{milestone?.caption ?? 'Listed, rented out or sold since the quarter began'}</p>
      </div>
      <div className="mt-5 w-full">
        <div className="h-2.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
          <div className="mac-grow-x h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${CORAL}, ${CORAL_2})`, '--d': '300ms' }} />
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="font-bold text-[#F95C4B]"><AnimatedNumber value={milestone?.current ?? 0} /> / {milestone?.target?.toLocaleString() ?? '—'}</span>
          <span className="text-[#6B7280] dark:text-[#A1A1AA] font-semibold">{pct}%</span>
        </div>
      </div>
    </Card>
  )
}

/* ─── KPI cards ──────────────────────────────────────────────────────────── */

export function Kpi({ icon: Icon, label, value, sub, to, delay, tone = CORAL, trend, suffix }) {
  const navigate = useNavigate()
  return (
    <Card as="button" type="button" delay={delay} onClick={() => navigate(to)} className="mac-lift mac-press group text-left p-4 hover:border-[#F95C4B]/40">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone === '#111111' ? 'dark:!bg-white/10' : ''}`} style={{ backgroundColor: `${tone}14` }}>
          <Icon className={`w-5 h-5 ${tone === '#111111' ? 'dark:!text-white' : ''}`} style={{ color: tone }} strokeWidth={1.8} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-[#D4D4D8] dark:text-[#3F3F46] group-hover:text-[#F95C4B] transition-colors" />
      </div>
      <p className="text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] mt-3">{label}</p>
      <p className="text-[26px] leading-tight font-bold text-[#111111] dark:text-white tracking-tight">
        <AnimatedNumber value={value ?? 0} format={suffix === '%' ? (n) => (Math.round(n * 10) / 10).toLocaleString() : undefined} />
        {suffix && <span className="text-lg ml-0.5">{suffix}</span>}
      </p>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
        {trend != null && (
          <span className={`inline-flex items-center font-semibold ${trend >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(trend)}%
          </span>
        )}
        <span className="truncate">{sub}</span>
      </div>
    </Card>
  )
}

/* ─── Pipeline ───────────────────────────────────────────────────────────── */

const STAGE_STYLE = [
  { bg: '#F1EFEC', fg: '#111111', darkBg: '#2A2A2A', darkFg: '#FFFFFF' },
  { bg: CORAL_3,   fg: '#111111' },
  { bg: CORAL_2,   fg: '#111111' },
  { bg: CORAL,     fg: '#FFFFFF' },
  { bg: '#C93A2B', fg: '#FFFFFF' },
  { bg: '#111111', fg: '#FFFFFF', darkBg: '#FFFFFF', darkFg: '#111111' },
]

// `stageTo` (optional) maps a stage key to a screen — those stages become buttons
export function Pipeline({ stages, isDark, stageTo }) {
  const navigate = useNavigate()
  return (
    <div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const st = STAGE_STYLE[i] ?? STAGE_STYLE[0]
          const bg = isDark && st.darkBg ? st.darkBg : st.bg
          const fg = isDark && st.darkFg ? st.darkFg : st.fg
          const first = i === 0, last = i === stages.length - 1
          const clip = first
            ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
            : last
              ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)'
              : 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)'
          const to = stageTo?.[s.key]
          const Tag = to ? 'button' : 'div'
          return (
            <Tag
              key={s.key}
              type={to ? 'button' : undefined}
              onClick={to ? () => navigate(to) : undefined}
              title={to ? `Open ${s.label.toLowerCase()}` : undefined}
              className={`mac-slide-in flex-1 min-w-[88px] pl-5 pr-4 py-3 text-left transition-transform duration-300 hover:-translate-y-0.5 ${to ? 'mac-press cursor-pointer' : ''}`}
              style={{ backgroundColor: bg, color: fg, clipPath: clip, '--d': `${120 + i * 70}ms`, borderRadius: first ? '12px 0 0 12px' : last ? '0 12px 12px 0' : 0 }}
            >
              <p className="text-[11px] font-semibold opacity-80 whitespace-nowrap">{s.label}</p>
              <p className="text-lg font-bold tracking-tight"><AnimatedNumber value={s.count} /></p>
            </Tag>
          )
        })}
      </div>
      {/* Stage-to-stage conversion */}
      <div className="flex gap-1 mt-2">
        {stages.map((s, i) => {
          const prev = stages[i - 1]
          const conv = prev && prev.count ? Math.round((s.count / prev.count) * 1000) / 10 : null
          // A stage can outgrow the one before it (e.g. deals closed without a logged
          // visit) — a ">100%" step reads as an error, so just say it's not a subset.
          return (
            <p key={s.key} className="flex-1 min-w-[88px] text-center text-[10px] text-[#9CA3AF]">
              {i === 0 ? 'start' : conv != null && conv <= 100
                ? <>↳ <span className="font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{conv}%</span> of {prev.label.toLowerCase()}</>
                : <>↳ not all via {prev.label.toLowerCase()}</>}
            </p>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Charts ─────────────────────────────────────────────────────────────── */

const TEMP_COLORS = { hot: CORAL, warm: '#F59E0B', cold: '#9CA3AF', still_negotiating: CORAL_3, closed: '#111111', lost: '#E5E7EB' }

// `onPick(key)` (optional) makes each legend row a button
export function TemperatureDonut({ temperature, total, isDark, onPick }) {
  const color = (k) => (k === 'closed' && isDark ? '#F5F5F4' : k === 'lost' && isDark ? '#3F3F46' : TEMP_COLORS[k])
  return <Donut items={temperature} total={total} color={color} centerLabel="Total leads" onPick={onPick} />
}

// Generic donut + legend. `items` = [{ key, label, count, pct }], `color(key)` -> fill.
export function Donut({ items, total, color, centerLabel, onPick }) {
  const temperature = items
  const data = items.filter((t) => t.count > 0)
  return (
    <div className="flex flex-col sm:flex-row lg:flex-col 2xl:flex-row items-center gap-5">
      <div className="relative w-[170px] h-[170px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={56} outerRadius={80} paddingAngle={2} cornerRadius={6} stroke="none" animationDuration={900} animationEasing="ease-out"
              onClick={onPick ? (d) => onPick(d?.key ?? d?.payload?.key) : undefined} className={onPick ? 'cursor-pointer' : ''}>
              {data.map((d) => <Cell key={d.key} fill={color(d.key)} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xl font-bold text-[#111111] dark:text-white"><AnimatedNumber value={total} /></p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{centerLabel}</p>
        </div>
      </div>
      <ul className="flex-1 w-full min-w-0 space-y-1">
        {temperature.map((t, i) => {
          const Tag = onPick ? 'button' : 'div'
          return (
            <li key={t.key} className="mac-slide-in" style={{ '--d': `${200 + i * 50}ms` }}>
              <Tag type={onPick ? 'button' : undefined} onClick={onPick ? () => onPick(t.key) : undefined}
                className={`w-full flex items-center gap-2 text-xs px-1.5 py-1 rounded-lg ${onPick ? 'hover:bg-[#FAFAF9] dark:hover:bg-[#202020] transition-colors' : ''}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color(t.key) }} />
                <span className="text-[#111111] dark:text-white whitespace-nowrap">{t.label}</span>
                <span className="ml-auto text-[#6B7280] dark:text-[#A1A1AA] tabular-nums">{t.pct}%</span>
                <span className="w-12 text-right font-semibold text-[#111111] dark:text-white tabular-nums">{t.count.toLocaleString()}</span>
              </Tag>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function IntentBars({ intent, onPick }) {
  const max = Math.max(1, ...intent.map((i) => i.count))
  const colors = { rental: CORAL, sale: '#111111', none: '#D4D4D8' }
  return (
    <div className="space-y-5 pt-2">
      {intent.map((i, idx) => {
        const clickable = onPick && i.key !== 'none'
        const Tag = clickable ? 'button' : 'div'
        return (
          <Tag key={i.key} type={clickable ? 'button' : undefined} onClick={clickable ? () => onPick(i.key) : undefined}
            className={`block w-full text-left ${clickable ? 'group' : ''}`}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={`font-medium text-[#111111] dark:text-white ${clickable ? 'group-hover:text-[#F95C4B] transition-colors' : ''}`}>{i.label}</span>
              <span className="text-[#6B7280] dark:text-[#A1A1AA] tabular-nums"><span className="font-semibold text-[#111111] dark:text-white">{i.pct}%</span> ({i.count.toLocaleString()})</span>
            </div>
            <div className="h-3 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
              <div
                className={`mac-grow-x h-full rounded-full ${i.key === 'sale' ? 'dark:!bg-[#F5F5F4]' : ''}`}
                style={{ width: `${(i.count / max) * 100}%`, backgroundColor: colors[i.key], '--d': `${200 + idx * 120}ms` }}
              />
            </div>
          </Tag>
        )
      })}
    </div>
  )
}

// Recharts' own entry animations leave lines/areas/bars blank on first paint, so every
// series has isAnimationActive={false} and the wrapper does a CSS reveal instead.
// `series` = [{ key, name, color, kind: 'area' | 'line', axis: 'left' | 'right', dashed, dots, width }]
// — 'ink' as a colour means near-black in light mode and near-white in dark mode.
export function TrendChart({ data, xKey, series, isDark, xFormat, labelFormat, height = 250, delay = 0, rightAxis = false }) {
  const ink = isDark ? '#F5F5F4' : '#111111'
  const col = (c) => (c === 'ink' ? ink : c)
  return (
    <div className="mac-reveal" style={{ '--d': `${delay}ms` }}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: rightAxis ? 4 : 8, bottom: 0, left: -14 }}>
          <defs>
            {series.filter((s) => s.kind === 'area').map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={col(s.color)} stopOpacity={0.35} />
                <stop offset="100%" stopColor={col(s.color)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#EEECEA'} vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFormat} tick={axisTick} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis yAxisId="left" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          {rightAxis && <YAxis yAxisId="right" orientation="right" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />}
          <Tooltip content={<ChartTooltip labelFormat={labelFormat} />} />
          {series.map((s) => (s.kind === 'area' ? (
            <Area key={s.key} yAxisId={s.axis === 'right' && rightAxis ? 'right' : 'left'} type="monotone" dataKey={s.key} name={s.name}
              stroke={col(s.color)} strokeWidth={s.width ?? 2.5} fill={`url(#fill-${s.key})`} isAnimationActive={false} />
          ) : (
            <Line key={s.key} yAxisId={s.axis === 'right' && rightAxis ? 'right' : 'left'} type="monotone" dataKey={s.key} name={s.name}
              stroke={col(s.color)} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? '4 3' : undefined}
              dot={s.dots ? { r: 3, fill: col(s.color), strokeWidth: 0 } : false} activeDot={s.dots ? { r: 6 } : undefined} isAnimationActive={false} />
          )))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ChartLegend({ series, isDark }) {
  const ink = isDark ? '#F5F5F4' : '#111111'
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color === 'ink' ? ink : s.color, opacity: s.dashed ? 0.7 : 1 }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

export function CallsByHourChart({ hours, isDark, height = 230 }) {
  const peak = Math.max(...hours.map((h) => h.calls))
  return (
    <div className="mac-rise" style={{ '--d': '400ms' }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={hours} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#EEECEA'} vertical={false} />
          <XAxis dataKey="hour" tickFormatter={(h) => h.slice(0, 2)} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(249, 92, 75, 0.06)' }} />
          <Bar dataKey="calls" name="Calls" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {hours.map((h) => <Cell key={h.hour} fill={h.calls === peak && peak > 0 ? CORAL : CORAL_3} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Provinces ──────────────────────────────────────────────────────────── */

// `provinceTo(name)` (optional): picking a province offers a jump to its leads.
// `fixAreasTo` (optional): where the "areas with no province" warning sends you.
export function ProvincePanel({ provinces, isDark, provinceTo, fixAreasTo, metrics = [['leads', 'Leads'], ['contacts', 'Contacts']] }) {
  const navigate = useNavigate()
  const [metric, setMetric] = useState(metrics[0][0])
  const [selected, setSelected] = useState(null)
  const list = provinces?.list ?? []
  const total = list.reduce((s, p) => s + p[metric], 0) || 1
  const sel = list.find((p) => p.name === selected)
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute right-0 top-0 z-10 flex items-center gap-1 p-1 rounded-lg bg-[#F5F5F4]/90 dark:bg-[#202020]/90 backdrop-blur w-fit">
          {metrics.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMetric(k)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${metric === k ? 'bg-white dark:bg-[#111111] text-[#F95C4B] shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="max-w-[560px] mx-auto">
          <SouthAfricaMap provinces={list} metric={metric} isDark={isDark} selected={selected} onSelect={setSelected} />
        </div>
      </div>
      {provinceTo && sel && (
        <button type="button" onClick={() => navigate(provinceTo(sel.name))}
          className="mac-pop mac-press w-full flex items-center gap-3 p-3 rounded-xl bg-[#F95C4B]/8 border border-[#F95C4B]/25 hover:bg-[#F95C4B]/12 text-left transition-colors">
          <MapPin className="w-4 h-4 text-[#F95C4B] flex-shrink-0" />
          <span className="flex-1 text-xs text-[#111111] dark:text-white">
            <b>{sel.name}</b> · {sel.leads.toLocaleString()} leads · {sel.hot.toLocaleString()} hot · {sel.closed.toLocaleString()} closed
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#F95C4B] whitespace-nowrap">View leads <ArrowRight className="w-3.5 h-3.5" /></span>
        </button>
      )}
      <div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 gap-x-4 gap-y-0.5">
          {list.map((p, i) => {
            const share = Math.round((p[metric] / total) * 1000) / 10
            const isSel = selected === p.name
            return (
              <li key={p.name}>
                <button type="button" onClick={() => setSelected(isSel ? null : p.name)}
                  className={`mac-slide-in w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${isSel ? 'bg-[#F95C4B]/10' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#202020]'}`}
                  style={{ '--d': `${150 + i * 40}ms` }}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p[metric] ? CORAL : isDark ? '#3F3F46' : '#E5E7EB', opacity: p[metric] ? 0.35 + 0.65 * Math.sqrt(p[metric] / (list[0]?.[metric] || 1)) : 1 }} />
                  <span className={`text-left ${isSel ? 'font-semibold text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>{p.name}</span>
                  <span className="ml-auto text-[10px] text-[#9CA3AF] tabular-nums">{share ? `${share}%` : ''}</span>
                  <span className="w-14 text-right font-semibold tabular-nums text-[#111111] dark:text-white">{p[metric].toLocaleString()}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {provinces?.unmapped?.leads > 0 && (
          <button type="button" onClick={fixAreasTo ? () => navigate(fixAreasTo) : undefined} disabled={!fixAreasTo}
            className="mt-3 w-full flex items-start gap-2 p-2.5 rounded-xl text-left text-[11px] bg-[#F59E0B]/8 border border-[#F59E0B]/25 text-[#92400E] dark:text-[#F59E0B] enabled:hover:bg-[#F59E0B]/12 transition-colors">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span><b>{provinces.unmapped.leads.toLocaleString()} lead{provinces.unmapped.leads === 1 ? '' : 's'}</b> and {provinces.unmapped.contacts.toLocaleString()} contact{provinces.unmapped.contacts === 1 ? '' : 's'} sit in areas with no recognisable province.{fixAreasTo ? ' Set a region on those areas to place them on the map.' : ''}</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Tasks, activity & photo card ───────────────────────────────────────── */

const TASK_ICONS = {
  callbacks: { icon: PhoneCall, color: CORAL },
  overdue: { icon: AlertTriangle, color: '#DC2626' },
  due_today: { icon: CalendarClock, color: '#F59E0B' },
  unworked: { icon: Phone, color: '#111111' },
  unassigned: { icon: UserX, color: '#F59E0B' },
  no_agent: { icon: UserX, color: '#F59E0B' },
  pool: { icon: Inbox, color: '#8B5CF6' },
  hot: { icon: Flame, color: '#EF4444' },
  no_date: { icon: CalendarClock, color: '#8B5CF6' },
  never: { icon: Clock, color: '#DC2626' },
  visits: { icon: CalendarCheck, color: '#10B981' },
  requests: { icon: Bell, color: '#8B5CF6' },
  blocks: { icon: Ban, color: '#6B7280' },
}

export function TodaysTasks({ tasks }) {
  const navigate = useNavigate()
  return (
    <ul className="space-y-2">
      {tasks.map((t, i) => {
        const meta = TASK_ICONS[t.key] ?? { icon: Sparkles, color: CORAL }
        return (
          <li key={t.key}>
            <button type="button" onClick={() => navigate(t.to)}
              className="mac-in mac-lift mac-press group w-full flex items-center gap-3 p-3 rounded-xl border border-[#F1EFEC] dark:border-[#2A2A2A] hover:border-[#F95C4B]/30 text-left"
              style={{ '--d': `${100 + i * 60}ms` }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 dark:!bg-white/5" style={{ backgroundColor: `${meta.color}12` }}>
                <meta.icon className={`w-4 h-4 ${meta.color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color: meta.color }} />
              </span>
              <span className="flex-1 text-xs font-medium text-[#111111] dark:text-white">{t.label}</span>
              <span className={`text-sm font-bold tabular-nums ${t.count ? 'text-[#111111] dark:text-white' : 'text-[#D4D4D8] dark:text-[#3F3F46]'}`}>
                <AnimatedNumber value={t.count} />
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4D4D8] dark:text-[#3F3F46] group-hover:text-[#F95C4B] transition-colors" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

const ACTIVITY_META = {
  lead_created: { icon: UserPlus, color: CORAL },
  lead_assigned: { icon: ArrowRight, color: '#111111' },
  appointment: { icon: CalendarCheck, color: '#10B981' },
  status_hot: { icon: Flame, color: '#EF4444' },
  status_listed: { icon: Home, color: '#8B5CF6' },
  status_rented_out: { icon: CheckCircle2, color: '#10B981' },
  status_sold: { icon: CheckCircle2, color: CORAL },
  status_lost: { icon: X, color: '#9CA3AF' },
}

export function RecentActivity({ events }) {
  if (!events?.length) return <p className="text-xs text-[#9CA3AF] py-6 text-center">No activity yet</p>
  return (
    <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-[#F1EFEC] dark:before:bg-[#2A2A2A]">
      {events.map((e, i) => {
        const meta = ACTIVITY_META[e.type] ?? { icon: Activity, color: CORAL }
        return (
          <li key={`${e.type}-${e.at}-${i}`} className="mac-slide-in relative flex gap-3" style={{ '--d': `${150 + i * 50}ms` }}>
            <span className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-[#181818] border-2" style={{ borderColor: `${meta.color}55` }}>
              <meta.icon className={`w-3.5 h-3.5 ${meta.color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color: meta.color }} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-semibold text-[#111111] dark:text-white">{e.title}</p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{e.detail}{e.by ? ` · by ${e.by}` : ''}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// The Sandton-skyline call-to-action card at the bottom of the right rail
export function PhotoCard({ eyebrow, title, text, to, buttonLabel, icon: Icon = MapPin }) {
  const navigate = useNavigate()
  return (
    <div className="mac-in relative overflow-hidden rounded-2xl min-h-[300px] bg-[#111111] text-white" style={{ '--d': '360ms' }}>
      <img src={sandtonSkyline} alt="Sandton skyline at dusk" className="mac-ken-burns absolute inset-0 w-full h-full object-cover object-[center_70%]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/55 to-[#111111]/10" />
      <div className="relative h-full min-h-[300px] p-5 flex flex-col justify-end">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F95C4B]">{eyebrow}</p>
        <h3 className="text-xl font-bold leading-tight mt-1">{title}</h3>
        <p className="text-xs text-white/75 mt-1.5">{text}</p>
        <button type="button" onClick={() => navigate(to)}
          className="mac-press mt-4 self-start flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-[#111111] hover:bg-[#F95C4B] hover:text-white transition-colors">
          <Icon className="w-3.5 h-3.5" /> {buttonLabel} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="absolute top-2 right-3 text-[9px] text-white/50">Photo: Kelly · Pexels</span>
    </div>
  )
}

/* ─── Map card with a Mine / Company switch ──────────────────────────────── */

// `scopes` = [{ key, label, provinces, metrics?, provinceTo?, fixAreasTo? }]
export function ScopedProvinceCard({ title = 'Leads by province', subtitle, scopes, isDark, delay = 180, loading }) {
  const [scope, setScope] = useState(scopes[0]?.key)
  const cur = scopes.find((x) => x.key === scope) ?? scopes[0]
  return (
    <Card delay={delay} className="p-5">
      <CardTitle
        title={title}
        subtitle={subtitle ?? 'Tap a province · darker coral = more'}
        action={scopes.length > 1 && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F5F4] dark:bg-[#202020]">
            {scopes.map((x) => (
              <button key={x.key} type="button" onClick={() => setScope(x.key)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${scope === x.key ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                {x.label}
              </button>
            ))}
          </div>
        )}
      />
      {loading || !cur?.provinces ? <Skeleton className="h-[360px]" /> : (
        <div key={cur.key} className="mac-in">
          <ProvincePanel provinces={cur.provinces} isDark={isDark} metrics={cur.metrics} provinceTo={cur.provinceTo} fixAreasTo={cur.fixAreasTo} />
        </div>
      )}
    </Card>
  )
}

/* ─── Calls ──────────────────────────────────────────────────────────────── */

export const OUTCOME_META = {
  interested:         { label: 'Interested',          color: '#10B981' },
  callback_requested: { label: 'Call back',           color: CORAL },
  voicemail:          { label: 'Voicemail',           color: '#F59E0B' },
  no_answer:          { label: 'No answer',           color: '#9CA3AF' },
  not_interested:     { label: 'Not interested',      color: '#6B7280' },
  wrong_number:       { label: 'Wrong number',        color: '#A1A1AA' },
  remove_me:          { label: 'Asked to be removed', color: '#DC2626' },
}

export function CallOutcomes({ outcomes }) {
  if (!outcomes?.total) return <p className="text-xs text-[#9CA3AF] py-8 text-center">No calls logged in the last 30 days</p>
  const max = Math.max(...outcomes.list.map((o) => o.count))
  return (
    <ul className="space-y-2.5">
      {outcomes.list.map((o, i) => {
        const meta = OUTCOME_META[o.key] ?? { label: o.key, color: '#9CA3AF' }
        return (
          <li key={o.key} className="mac-slide-in" style={{ '--d': `${200 + i * 50}ms` }}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-2 text-[#111111] dark:text-white">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
              </span>
              <span className="text-[#6B7280] dark:text-[#A1A1AA] tabular-nums">
                <span className="font-semibold text-[#111111] dark:text-white">{o.count.toLocaleString()}</span> · {o.pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
              <div className="mac-grow-x h-full rounded-full" style={{ width: `${(o.count / max) * 100}%`, backgroundColor: meta.color, '--d': `${260 + i * 60}ms` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ─── Upcoming visits ────────────────────────────────────────────────────── */

// `leadPath(id)` opens the visit's lead; `allTo` is the appointments screen
export function UpcomingVisits({ visits, showAgent, leadPath, allTo }) {
  const navigate = useNavigate()
  if (!visits?.length) {
    return (
      <div className="text-center py-6">
        <CalendarCheck className="w-6 h-6 mx-auto text-[#D4D4D8] dark:text-[#3F3F46]" />
        <p className="text-xs text-[#9CA3AF] mt-2">No visits booked yet</p>
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {visits.map((v, i) => {
        const d = new Date(v.scheduledDate)
        const when = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE d MMM')
        return (
          <li key={v._id}>
            <button type="button" onClick={() => navigate(v.leadId ? leadPath(v.leadId) : allTo)}
              className="mac-in mac-lift mac-press w-full flex items-center gap-3 p-2.5 rounded-xl border border-[#F1EFEC] dark:border-[#2A2A2A] hover:border-[#F95C4B]/30 text-left"
              style={{ '--d': `${120 + i * 60}ms` }}>
              <span className={`w-11 flex-shrink-0 rounded-lg py-1 text-center ${isToday(d) ? 'bg-[#F95C4B] text-white' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white'}`}>
                <span className="block text-[9px] font-semibold uppercase opacity-80">{format(d, 'MMM')}</span>
                <span className="block text-sm font-bold leading-tight">{format(d, 'd')}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-[#111111] dark:text-white truncate">{v.landlordName}</span>
                <span className="block text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{when} · {v.scheduledTime}{showAgent && v.agent ? ` · ${v.agent}` : ''}</span>
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.status === 'confirmed' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>
                {v.status === 'confirmed' ? 'Confirmed' : 'Scheduled'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ─── Where we are as a company ──────────────────────────────────────────── */

const COMPANY_WEEKLY = [
  { key: 'created', name: 'Leads created', color: CORAL, kind: 'line', dots: true, width: 3 },
  { key: 'closed',  name: 'Deals closed',  color: 'ink', kind: 'line', dots: true, width: 2.5 },
]

// Aggregate company numbers for roles that don't see the whole book — no records, no names.
export function CompanySnapshot({ company, isDark, delay = 0 }) {
  const k = company?.kpis
  const m = company?.milestone
  const pctDone = m ? Math.min(100, Math.round((m.current / m.target) * 100)) : 0
  const tiles = [
    { label: 'Total leads', value: k?.totalLeads, sub: k?.leadsWeekChangePct != null ? `${k.leadsWeekChangePct >= 0 ? '+' : ''}${k.leadsWeekChangePct}% new vs last week` : null },
    { label: 'New this week', value: k?.leadsThisWeek },
    { label: 'Hot right now', value: k?.qualified },
    { label: 'Closed this month', value: k?.closedThisMonth },
    { label: 'Contacts in the system', value: k?.contacts },
  ]
  return (
    <Card delay={delay} className="overflow-hidden">
      <div className="relative px-5 pt-5 pb-4 bg-gradient-to-r from-[#111111] to-[#2A1512] text-white">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#F95C4B]/25 blur-2xl mac-float" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F95C4B] flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Reliable Touch</p>
            <h3 className="text-lg font-bold tracking-tight mt-0.5">Where we are as a company</h3>
            <p className="text-xs text-white/65">Everyone's work adds up here — yours included</p>
          </div>
          {m && (
            <div className="min-w-[220px]">
              <div className="flex justify-between text-[11px] text-white/70 mb-1.5">
                <span>Quarter goal · {m.target.toLocaleString()} closed deals</span>
                <span className="font-semibold text-white">{m.current.toLocaleString()} · {pctDone}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                <div className="mac-grow-x h-full rounded-full" style={{ width: `${pctDone}%`, background: `linear-gradient(90deg, ${CORAL}, ${CORAL_2})`, '--d': '300ms' }} />
              </div>
            </div>
          )}
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 mt-4">
          {tiles.map((t, i) => (
            <div key={t.label} className="mac-pop rounded-xl bg-white/8 border border-white/10 px-3 py-2.5 backdrop-blur" style={{ '--d': `${200 + i * 60}ms` }}>
              <p className="text-[10px] uppercase tracking-wider text-white/55">{t.label}</p>
              <p className="text-xl font-bold tracking-tight"><AnimatedNumber value={t.value ?? 0} /></p>
              {t.sub && <p className="text-[10px] text-white/55">{t.sub}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 space-y-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#111111] dark:text-white mb-3">Company pipeline</p>
          {company ? <Pipeline stages={company.pipeline} isDark={isDark} /> : <Skeleton className="h-20" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#111111] dark:text-white mb-1">Leads created vs deals closed · 12 weeks</p>
          {company ? (
            <>
              <TrendChart data={company.weekly} xKey="weekStart" series={COMPANY_WEEKLY} isDark={isDark} height={200} delay={300}
                xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => `Week of ${format(new Date(d), 'd MMM')}`} />
              <ChartLegend series={COMPANY_WEEKLY} isDark={isDark} />
            </>
          ) : <Skeleton className="h-[170px]" />}
        </div>
      </div>
    </Card>
  )
}
