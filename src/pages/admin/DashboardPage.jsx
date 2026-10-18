import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Users, Phone, CalendarClock, Flame, Home, ArrowRight, ArrowUpRight, ArrowDownRight, RefreshCw,
  PhoneCall, AlertTriangle, UserX, Bell, Ban, Target, TrendingUp, MapPin, Building2, Activity,
  CheckCircle2, UserPlus, CalendarCheck, Sparkles, X, Trophy, Clock,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import { contactRequestsApi } from '../../services/contactRequestsApi'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import SouthAfricaMap from '../../components/dashboard/SouthAfricaMap'
import FinancePanel from '../../components/dashboard/FinancePanel'
import capeTownCoast from '../../assets/images/cape-town-coast.jpg'
import sandtonSkyline from '../../assets/images/sandton-skyline.jpg'

/* ─── Brand palette (from the logo: coral, black, white) ─────────────────── */
const CORAL = '#F95C4B'
const CORAL_2 = '#FF8C7A'
const CORAL_3 = '#FDBAAE'
const STATUS_COLORS = {
  cold: '#9CA3AF', warm: '#F59E0B', hot: '#EF4444', still_negotiating: '#FF8C7A',
  listed: '#8B5CF6', rented_out: '#10B981', sold: CORAL, lost: '#D4D4D8',
}
const STATUS_LABEL = {
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

function Card({ className = '', delay = 0, children, as: Tag = 'div', ...rest }) {
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

function CardTitle({ title, subtitle, action }) {
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

function LinkButton({ to, children }) {
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

function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

function ChartTooltip({ active, payload, label, labelFormat }) {
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

const axisTick = { fontSize: 10, fill: '#9CA3AF' }

/* ─── Hero ───────────────────────────────────────────────────────────────── */

function Hero({ user, kpis, now }) {
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const quote = QUOTES[now.getDate() % QUOTES.length]
  return (
    <div className="mac-in relative overflow-hidden rounded-2xl min-h-[220px] bg-[#111111] text-white" style={{ '--d': '0ms' }}>
      <img src={capeTownCoast} alt="Cape Town coastline at sunset" className="mac-ken-burns absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/95 via-[#111111]/70 to-[#111111]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#F95C4B]/25 to-transparent" />
      <div className="relative h-full p-6 sm:p-7 flex flex-col justify-between gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">{greeting}, {user?.firstName ?? 'there'}</h1>
            <p className="text-sm text-white/75 mt-1">Here's what's happening with your leads today.</p>
            <p className="inline-flex items-center gap-1.5 mt-3 text-xs text-white/80 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur">
              <CalendarClock className="w-3.5 h-3.5" /> {format(now, 'EEEE, d MMMM yyyy')}
            </p>
          </div>
          <blockquote className="hidden md:block max-w-[220px] text-right">
            <p className="text-sm italic text-white/90 leading-relaxed">&ldquo;{quote}&rdquo;</p>
            <p className="text-[11px] text-[#F95C4B] font-semibold mt-1">— Reliable Touch</p>
          </blockquote>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: PhoneCall, label: 'calls today', value: kpis?.callsToday },
            { icon: Flame, label: 'hot leads', value: kpis?.qualified },
            { icon: CalendarCheck, label: 'visits today', value: kpis?.apptsToday },
          ].map((s, i) => (
            <span key={s.label} className="mac-pop inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/12 backdrop-blur text-xs border border-white/15" style={{ '--d': `${300 + i * 80}ms` }}>
              <s.icon className="w-3.5 h-3.5 text-[#F95C4B]" />
              <span className="font-bold"><AnimatedNumber value={s.value ?? 0} /></span>
              <span className="text-white/70">{s.label}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="absolute bottom-2 right-3 text-[9px] text-white/40">Photo: Julie Holmes · Pexels</span>
    </div>
  )
}

function Milestone({ milestone }) {
  const pct = milestone ? Math.min(100, Math.round((milestone.current / milestone.target) * 100)) : 0
  return (
    <Card delay={60} className="p-5 flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center mac-float">
          <Target className="w-4 h-4 text-[#F95C4B]" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Next milestone</p>
      </div>
      <div className="mt-4">
        <p className="text-lg font-bold text-[#111111] dark:text-white leading-snug">
          {milestone ? `${milestone.target.toLocaleString()} closed deals this quarter` : '—'}
        </p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Listed, rented out or sold since the quarter began</p>
      </div>
      <div className="mt-5">
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

function Kpi({ icon: Icon, label, value, sub, to, delay, tone = CORAL, trend }) {
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
        <AnimatedNumber value={value ?? 0} />
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

function Pipeline({ stages, isDark }) {
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
          return (
            <div
              key={s.key}
              className="mac-slide-in flex-1 min-w-[88px] pl-5 pr-4 py-3 transition-transform duration-300 hover:-translate-y-0.5"
              style={{ backgroundColor: bg, color: fg, clipPath: clip, '--d': `${120 + i * 70}ms`, borderRadius: first ? '12px 0 0 12px' : last ? '0 12px 12px 0' : 0 }}
            >
              <p className="text-[11px] font-semibold opacity-80 whitespace-nowrap">{s.label}</p>
              <p className="text-lg font-bold tracking-tight"><AnimatedNumber value={s.count} /></p>
            </div>
          )
        })}
      </div>
      {/* Stage-to-stage conversion */}
      <div className="flex gap-1 mt-2">
        {stages.map((s, i) => {
          const prev = stages[i - 1]
          const conv = prev && prev.count ? Math.round((s.count / prev.count) * 1000) / 10 : null
          return (
            <p key={s.key} className="flex-1 min-w-[88px] text-center text-[10px] text-[#9CA3AF]">
              {conv != null ? <>↳ <span className="font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{conv}%</span> of {prev.label.toLowerCase()}</> : 'start'}
            </p>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Charts ─────────────────────────────────────────────────────────────── */

const TEMP_COLORS = { hot: CORAL, warm: '#F59E0B', cold: '#9CA3AF', still_negotiating: CORAL_3, closed: '#111111', lost: '#E5E7EB' }

function TemperatureDonut({ temperature, total, isDark }) {
  const data = temperature.filter((t) => t.count > 0)
  const color = (k) => (k === 'closed' && isDark ? '#F5F5F4' : k === 'lost' && isDark ? '#3F3F46' : TEMP_COLORS[k])
  return (
    <div className="flex flex-col sm:flex-row lg:flex-col 2xl:flex-row items-center gap-5">
      <div className="relative w-[170px] h-[170px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={56} outerRadius={80} paddingAngle={2} cornerRadius={6} stroke="none" animationDuration={900} animationEasing="ease-out">
              {data.map((d) => <Cell key={d.key} fill={color(d.key)} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xl font-bold text-[#111111] dark:text-white"><AnimatedNumber value={total} /></p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">Total leads</p>
        </div>
      </div>
      <ul className="flex-1 w-full min-w-0 space-y-2">
        {temperature.map((t, i) => (
          <li key={t.key} className="mac-slide-in flex items-center gap-2 text-xs" style={{ '--d': `${200 + i * 50}ms` }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color(t.key) }} />
            <span className="text-[#111111] dark:text-white whitespace-nowrap">{t.label}</span>
            <span className="ml-auto text-[#6B7280] dark:text-[#A1A1AA] tabular-nums">{t.pct}%</span>
            <span className="w-12 text-right font-semibold text-[#111111] dark:text-white tabular-nums">{t.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IntentBars({ intent }) {
  const max = Math.max(1, ...intent.map((i) => i.count))
  const colors = { rental: CORAL, sale: '#111111', none: '#D4D4D8' }
  return (
    <div className="space-y-5 pt-2">
      {intent.map((i, idx) => (
        <div key={i.key}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-[#111111] dark:text-white">{i.label}</span>
            <span className="text-[#6B7280] dark:text-[#A1A1AA] tabular-nums"><span className="font-semibold text-[#111111] dark:text-white">{i.pct}%</span> ({i.count.toLocaleString()})</span>
          </div>
          <div className="h-3 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
            <div
              className={`mac-grow-x h-full rounded-full ${i.key === 'sale' ? 'dark:!bg-[#F5F5F4]' : ''}`}
              style={{ width: `${(i.count / max) * 100}%`, backgroundColor: colors[i.key], '--d': `${200 + idx * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DailyActivityChart({ daily, isDark }) {
  const ink = isDark ? '#F5F5F4' : '#111111'
  return (
    <div className="mac-reveal">
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={daily} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CORAL} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CORAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#EEECEA'} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={axisTick} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis yAxisId="calls" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis yAxisId="leads" orientation="right" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip labelFormat={(d) => format(new Date(d), 'EEE, d MMM')} />} />
        <Area yAxisId="calls" type="monotone" dataKey="calls" name="Calls" stroke={CORAL} strokeWidth={2.5} fill="url(#callsFill)" isAnimationActive={false} />
        <Line yAxisId="leads" type="monotone" dataKey="leads" name="Leads created" stroke={ink} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line yAxisId="leads" type="monotone" dataKey="closed" name="Deals closed" stroke="#10B981" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}

function WeeklyTrendChart({ weekly, isDark }) {
  const ink = isDark ? '#F5F5F4' : '#111111'
  return (
    <div className="mac-reveal" style={{ '--d': '350ms' }}>
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2A2A' : '#EEECEA'} vertical={false} />
        <XAxis dataKey="weekStart" tickFormatter={(d) => format(new Date(d), 'd MMM')} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip labelFormat={(d) => `Week of ${format(new Date(d), 'd MMM')}`} />} />
        <Line type="monotone" dataKey="created" name="Leads created" stroke={CORAL} strokeWidth={3} dot={{ r: 3, fill: CORAL, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="closed" name="Deals closed" stroke={ink} strokeWidth={2.5} dot={{ r: 3, fill: ink, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
    </div>
  )
}

function CallsByHourChart({ hours, isDark }) {
  const peak = Math.max(...hours.map((h) => h.calls))
  return (
    <div className="mac-rise" style={{ '--d': '400ms' }}>
    <ResponsiveContainer width="100%" height={230}>
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

function ProvincePanel({ provinces, isDark }) {
  const navigate = useNavigate()
  const [metric, setMetric] = useState('leads')
  const [selected, setSelected] = useState(null)
  const list = provinces?.list ?? []
  const total = list.reduce((s, p) => s + p[metric], 0) || 1
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute right-0 top-0 z-10 flex items-center gap-1 p-1 rounded-lg bg-[#F5F5F4]/90 dark:bg-[#202020]/90 backdrop-blur w-fit">
          {[['leads', 'Leads'], ['contacts', 'Contacts']].map(([k, label]) => (
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
          <button type="button" onClick={() => navigate('/admin/areas')}
            className="mt-3 w-full flex items-start gap-2 p-2.5 rounded-xl text-left text-[11px] bg-[#F59E0B]/8 border border-[#F59E0B]/25 text-[#92400E] dark:text-[#F59E0B] hover:bg-[#F59E0B]/12 transition-colors">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span><b>{provinces.unmapped.leads.toLocaleString()} leads</b> and {provinces.unmapped.contacts.toLocaleString()} contacts sit in areas with no recognisable province. Set a region on those areas to place them on the map.</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Tables & feeds ─────────────────────────────────────────────────────── */

const LEAD_TABS = [
  { key: 'all', label: 'All leads', test: () => true },
  { key: 'hot', label: 'Hot', test: (l) => l.status === 'hot' },
  { key: 'followup', label: 'Follow-up due', test: (l) => l.followUpDate && new Date(l.followUpDate) <= new Date() },
  { key: 'unassigned', label: 'No agent yet', test: (l) => !l.agent && !l.agency },
]

function RecentLeads({ leads }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const rows = (leads ?? []).filter(LEAD_TABS.find((t) => t.key === tab).test).slice(0, 8)
  return (
    <>
      <div className="flex gap-1 border-b border-[#E5E7EB] dark:border-[#2A2A2A] mb-1 overflow-x-auto">
        {LEAD_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`relative px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.key ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'}`}>
            {t.label}
            {tab === t.key && <span className="mac-grow-x absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#F95C4B]" />}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
              {['Owner / Property', 'Area', 'Intent', 'Status', 'Follow-up', 'Agent / Agency', 'Created'].map((h) => (
                <th key={h} className="text-left font-semibold px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody key={tab}>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-[#9CA3AF]">Nothing here right now</td></tr>
            ) : rows.map((l, i) => {
              const color = STATUS_COLORS[l.status] ?? '#9CA3AF'
              const overdue = l.followUpDate && new Date(l.followUpDate) < new Date()
              return (
                <tr key={l._id} onClick={() => navigate(`/admin/leads/${l._id}`)}
                  className="mac-in cursor-pointer border-t border-[#F5F5F4] dark:border-[#202020] hover:bg-[#FAFAF9] dark:hover:bg-[#1C1C1C] transition-colors"
                  style={{ '--d': `${i * 40}ms` }}>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="font-semibold text-[#111111] dark:text-white truncate">{l.landlordName}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">{l.propertyAddress}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">{l.area ?? '—'}{l.province ? <span className="block text-[10px] text-[#9CA3AF]">{l.province}</span> : null}</td>
                  <td className="px-3 py-2.5">
                    {l.listingType ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.listingType === 'rental' ? 'bg-[#F95C4B]/10 text-[#F95C4B]' : 'bg-[#111111]/8 dark:bg-white/10 text-[#111111] dark:text-white'}`}>
                        {l.listingType === 'rental' ? 'Rent' : 'Sell'}
                      </span>
                    ) : <span className="text-[#9CA3AF]">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color, backgroundColor: `${color}1A` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />{STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${overdue ? 'text-[#DC2626] font-semibold' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                    {l.followUpDate ? format(new Date(l.followUpDate), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] dark:text-[#A1A1AA] max-w-[170px]">
                    {l.agent || l.agency ? (
                      <><p className="text-[#111111] dark:text-white truncate">{l.agent ?? '—'}</p><p className="text-[10px] truncate">{l.agency}</p></>
                    ) : <span className="text-[#F59E0B] font-medium">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[#9CA3AF] whitespace-nowrap">{formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function TopAgencies({ agencies }) {
  const navigate = useNavigate()
  if (!agencies?.length) return <p className="text-xs text-[#9CA3AF] py-8 text-center">No agency has been given leads yet</p>
  const max = Math.max(...agencies.map((a) => a.leads))
  return (
    <ul className="space-y-1">
      {agencies.map((a, i) => (
        <li key={String(a.agencyId)}>
          <button type="button" onClick={() => navigate(`/admin/agencies/${a.agencyId}`)}
            className="mac-slide-in w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#FAFAF9] dark:hover:bg-[#202020] transition-colors text-left"
            style={{ '--d': `${150 + i * 60}ms` }}>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${i === 0 ? 'bg-[#F95C4B] text-white' : 'bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]'}`}>
              {i === 0 ? <Trophy className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{a.name}</p>
                <span className={`text-xs font-bold tabular-nums ${a.conversion >= 20 ? 'text-[#16A34A]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{a.conversion}%</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
                  <div className="mac-grow-x h-full rounded-full bg-[#F95C4B]" style={{ width: `${(a.leads / max) * 100}%`, '--d': `${300 + i * 60}ms` }} />
                </div>
                <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap tabular-nums">{a.leads} leads · {a.closed} closed</span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

const TASK_ICONS = {
  callbacks: { icon: PhoneCall, color: CORAL },
  overdue: { icon: AlertTriangle, color: '#DC2626' },
  unworked: { icon: Phone, color: '#111111' },
  unassigned: { icon: UserX, color: '#F59E0B' },
  requests: { icon: Bell, color: '#8B5CF6' },
  blocks: { icon: Ban, color: '#6B7280' },
}

function TodaysTasks({ tasks }) {
  const navigate = useNavigate()
  return (
    <ul className="space-y-2">
      {tasks.map((t, i) => {
        const meta = TASK_ICONS[t.key] ?? { icon: Sparkles, color: CORAL }
        return (
          <li key={t.key}>
            <button type="button" onClick={() => navigate(t.to)}
              className="mac-in mac-lift w-full flex items-center gap-3 p-3 rounded-xl border border-[#F1EFEC] dark:border-[#2A2A2A] hover:border-[#F95C4B]/30 text-left"
              style={{ '--d': `${100 + i * 60}ms` }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 dark:!bg-white/5" style={{ backgroundColor: `${meta.color}12` }}>
                <meta.icon className={`w-4 h-4 ${meta.color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color: meta.color }} />
              </span>
              <span className="flex-1 text-xs font-medium text-[#111111] dark:text-white">{t.label}</span>
              <span className={`text-sm font-bold tabular-nums ${t.count ? 'text-[#111111] dark:text-white' : 'text-[#D4D4D8] dark:text-[#3F3F46]'}`}>
                <AnimatedNumber value={t.count} />
              </span>
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

function RecentActivity({ events }) {
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

function NationalCard({ provinces }) {
  const navigate = useNavigate()
  const live = (provinces?.list ?? []).filter((p) => p.leads > 0).length
  return (
    <div className="mac-in relative overflow-hidden rounded-2xl min-h-[300px] bg-[#111111] text-white" style={{ '--d': '360ms' }}>
      <img src={sandtonSkyline} alt="Sandton skyline at dusk" className="mac-ken-burns absolute inset-0 w-full h-full object-cover object-[center_70%]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/55 to-[#111111]/10" />
      <div className="relative h-full min-h-[300px] p-5 flex flex-col justify-end">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F95C4B]">Next stop</p>
        <h3 className="text-xl font-bold leading-tight mt-1">The whole of South Africa</h3>
        <p className="text-xs text-white/75 mt-1.5">
          Leads in <b className="text-white">{live}</b> of 9 provinces so far. More cities, more agents, more opportunities.
        </p>
        <button type="button" onClick={() => navigate('/admin/areas')}
          className="mac-press mt-4 self-start flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-[#111111] hover:bg-[#F95C4B] hover:text-white transition-colors">
          <MapPin className="w-3.5 h-3.5" /> Manage coverage <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="absolute top-2 right-3 text-[9px] text-white/50">Photo: Kelly · Pexels</span>
    </div>
  )
}

function ContactRequests() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['contact-requests-pending'],
    queryFn: () => contactRequestsApi.list({ status: 'pending', limit: 10 }),
    staleTime: 30_000,
  })
  const update = useMutation({
    mutationFn: ({ id, status }) => contactRequestsApi.updateStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-requests-pending'] }),
  })
  const requests = data?.requests ?? []
  if (!requests.length) return null
  return (
    <Card delay={200} className="overflow-hidden border-[#F95C4B]/25">
      <div className="flex items-center gap-3 px-5 py-3 bg-[#F95C4B]/5 border-b border-[#F95C4B]/15">
        <Bell className="w-4 h-4 text-[#F95C4B]" />
        <span className="text-sm font-bold text-[#111111] dark:text-white flex-1">Cold callers asking for more contacts</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F95C4B] text-white">{requests.length}</span>
      </div>
      <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
        {requests.map((req) => (
          <li key={req._id} className="flex items-center gap-3 px-5 py-3">
            <span className="w-8 h-8 rounded-full bg-[#F95C4B]/15 flex items-center justify-center text-[11px] font-bold text-[#F95C4B]">
              {`${req.requestedBy?.firstName?.[0] ?? ''}${req.requestedBy?.lastName?.[0] ?? ''}`.toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#111111] dark:text-white">
                {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                <span className="text-xs font-normal text-[#9CA3AF] ml-2">{formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</span>
              </p>
              {req.message && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate italic">&ldquo;{req.message}&rdquo;</p>}
            </div>
            <button onClick={() => navigate('/admin/contacts')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">Assign</button>
            <button onClick={() => update.mutate({ id: req._id, status: 'fulfilled' })} disabled={update.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20">Fulfilled</button>
            <button onClick={() => update.mutate({ id: req._id, status: 'dismissed' })} disabled={update.isPending} title="Dismiss"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10"><X className="w-3.5 h-3.5" /></button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { theme } = useTheme() ?? {}
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const freshRef = useRef(false) // set by the refresh button to bypass the server's 60s cache

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { data: o, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => axiosClient.get('/reports/overview', { params: freshRef.current ? { fresh: 'true' } : undefined }).then((r) => r.data.data),
    staleTime: 55_000,
    refetchInterval: 60_000,
  })

  const [finance, setFinance] = useState({ commissions: [], renewals: [], loading: true })
  useEffect(() => {
    Promise.allSettled([axiosClient.get('/commissions?limit=5'), axiosClient.get('/lease-renewals?limit=5')]).then(([c, r]) => {
      setFinance({
        commissions: c.status === 'fulfilled' ? c.value.data?.data?.commissions ?? [] : [],
        renewals: r.status === 'fulfilled' ? r.value.data?.data?.renewals ?? [] : [],
        loading: false,
      })
    })
  }, [])

  function refreshNow() {
    freshRef.current = true
    refetch().finally(() => { freshRef.current = false })
  }

  const k = o?.kpis
  const kpiCards = useMemo(() => [
    { icon: Users, label: 'Total leads', value: k?.totalLeads, sub: `${(k?.leadsThisWeek ?? 0).toLocaleString()} this week`, trend: k?.leadsWeekChangePct, to: '/admin/leads' },
    { icon: Phone, label: 'Needs calling', value: k?.needsCalling, sub: 'Contacts never called', to: '/admin/contacts', tone: '#111111' },
    { icon: CalendarClock, label: 'Follow-ups due', value: k?.followUpsDue, sub: `Today ${k?.followUpsToday ?? 0} · Overdue ${(k?.followUpsOverdue ?? 0).toLocaleString()}`, to: '/admin/leads', tone: '#F59E0B' },
    { icon: Flame, label: 'Qualified (hot)', value: k?.qualified, sub: 'Ready for an agent', to: '/admin/leads', tone: '#EF4444' },
    { icon: Home, label: 'Listed / rented / sold', value: k?.closedThisMonth, sub: 'Closed this month', to: '/admin/leads', tone: '#10B981' },
  ], [k])

  return (
    <div className="p-4 sm:p-6 xl:p-8">
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <Hero user={user} kpis={k} now={now} />
            {!o ? <Skeleton className="min-h-[220px]" /> : <Milestone milestone={o?.milestone} />}
          </div>

          {isError && !o && (
            <div className="mac-in flex items-center gap-3 p-4 rounded-2xl bg-[#DC2626]/8 border border-[#DC2626]/25 text-sm text-[#DC2626]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">Couldn't load the dashboard numbers. Check the connection to the server.</span>
              <button type="button" onClick={() => refetch()} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#DC2626] text-white hover:opacity-90">Retry</button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4">
            {!o
              ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[140px]" />)
              : kpiCards.map((c, i) => <Kpi key={c.label} delay={80 + i * 60} {...c} />)}
          </div>

          <Card delay={140} className="p-5">
            <CardTitle title="Lead pipeline" subtitle="From first contact to a closed deal — and how many make each step" action={<LinkButton to="/admin/leads">View all leads</LinkButton>} />
            {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} />}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 content-start">
              <Card delay={200} className="p-5">
                <CardTitle title="Lead temperature" subtitle="Where every lead stands right now" />
                {!o ? <Skeleton className="h-[170px]" /> : <TemperatureDonut temperature={o.temperature} total={o.kpis.totalLeads} isDark={isDark} />}
              </Card>
              <Card delay={240} className="p-5">
                <CardTitle title="Property intent" subtitle="What owners want to do" />
                {!o ? <Skeleton className="h-[170px]" /> : <IntentBars intent={o.intent} />}
              </Card>
            </div>
            <Card delay={180} className="p-5">
              <CardTitle title="Leads by province" subtitle="Hover or tap a province · darker coral = more leads" action={<LinkButton to="/admin/areas">Areas</LinkButton>} />
              {!o ? <Skeleton className="h-[360px]" /> : <ProvincePanel provinces={o.provinces} isDark={isDark} />}
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card delay={260} className="p-5">
              <CardTitle title="Daily activity — last 30 days" subtitle="Calls (left axis) against leads created and deals closed (right axis)" action={<LinkButton to="/admin/call-logs">Call logs</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : <DailyActivityChart daily={o.charts.daily} isDark={isDark} />}
            </Card>
            <Card delay={300} className="p-5">
              <CardTitle title="Weekly trend — 12 weeks" subtitle="New leads vs deals closed each week" action={<LinkButton to="/admin/performance">Performance</LinkButton>} />
              {!o ? <Skeleton className="h-[250px]" /> : <WeeklyTrendChart weekly={o.charts.weekly} isDark={isDark} />}
            </Card>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-6">
            <Card delay={320} className="p-5">
              <CardTitle title="When calls happen" subtitle="Calls by hour of day, last 30 days — peak hour in full coral" />
              {!o ? <Skeleton className="h-[230px]" /> : <CallsByHourChart hours={o.charts.callsByHour} isDark={isDark} />}
            </Card>
            <Card delay={340} className="p-5">
              <CardTitle title="Top performing agencies" subtitle="By leads handed over · conversion = listed, rented or sold" action={<LinkButton to="/admin/agencies">All agencies</LinkButton>} />
              {!o ? <Skeleton className="h-[230px]" /> : <TopAgencies agencies={o.topAgencies} />}
            </Card>
          </div>

          <Card delay={360} className="p-5">
            <CardTitle title="Recent leads" subtitle="The newest leads in the system" action={<LinkButton to="/admin/leads">View all</LinkButton>} />
            {!o ? <Skeleton className="h-[300px]" /> : <RecentLeads leads={o.recentLeads} />}
          </Card>

          <ContactRequests />

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Finance
            </h2>
            <FinancePanel commissions={finance.commissions} renewals={finance.renewals} loading={finance.loading} navigate={navigate} />
          </div>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <aside className="space-y-6 min-w-0">
          <Card delay={120} className="p-5">
            <CardTitle
              title="Today's tasks"
              action={(
                <button type="button" onClick={refreshNow} title="Refresh now"
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]">
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  {dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm') : ''}
                </button>
              )}
            />
            {!o ? <Skeleton className="h-[300px]" /> : <TodaysTasks tasks={o.tasks} />}
          </Card>
          <Card delay={240} className="p-5">
            <CardTitle title="Recent activity" subtitle="Across the whole system" action={<Clock className="w-4 h-4 text-[#9CA3AF]" />} />
            {!o ? <Skeleton className="h-[320px]" /> : <RecentActivity events={o.activity} />}
          </Card>
          <NationalCard provinces={o?.provinces} />
          <p className="text-center text-[10px] text-[#9CA3AF] flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Reliable Touch Services · Lead generation · Cold calling · Follow-up · Distribution
          </p>
        </aside>
      </div>
    </div>
  )
}
